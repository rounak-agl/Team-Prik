"""ClickHouseStore — historical reads (booking curves, LY anchors, ticket
history) and our NEW feature/decision tables. ClickHouse existing tables are
read-only to us, but we ARE allowed to CREATE new tables, so decision logs and
feature stores live here under a dedicated prefix.
"""
from __future__ import annotations

import os
from datetime import datetime

import config

DECISIONS_TABLE = "fs_pricing_decisions"   # our new table (we create it)
CHANGELOG = os.path.join(os.path.dirname(__file__), "..", "CLICKHOUSE_CHANGES.md")


class ClickHouseStore:
    def __init__(self):
        import clickhouse_connect
        self.client = clickhouse_connect.get_client(**config.clickhouse_config())
        self.db = config.clickhouse_config()["database"]

    def query(self, sql: str, params: dict | None = None):
        return self.client.query(sql, parameters=params or {},
                                 settings={"max_execution_time": 15}).result_rows

    def ping(self) -> str:
        return str(self.client.query("SELECT version()").result_rows[0][0])

    # ── change-log: append every DDL we run (hackathon hygiene) ───────────────
    def _record_change(self, action: str, detail: str) -> None:
        try:
            with open(CHANGELOG, "a", encoding="utf-8") as f:
                f.write(f"- [{datetime.now():%Y-%m-%d %H:%M:%S}] {action}: {detail}\n")
        except Exception:
            pass

    def _table_exists(self, name: str) -> bool:
        rows = self.query(
            "SELECT count() FROM system.tables WHERE database = {db:String} "
            "AND name = {n:String}", {"db": self.db, "n": name})
        return bool(rows and rows[0][0])

    def create_feature_table(self, name: str, ddl: str) -> None:
        """Create a new fs_* table (idempotent) and log it on first creation."""
        if self._table_exists(name):
            return
        self.client.command(ddl)
        self._record_change("CREATE TABLE", f"{self.db}.{name}")

    # ── our writable decision/audit table (new table — allowed) ───────────────
    def ensure_decisions_table(self) -> None:
        self.create_feature_table(DECISIONS_TABLE, f'''
            CREATE TABLE IF NOT EXISTS {DECISIONS_TABLE} (
                ts             DateTime DEFAULT now(),
                trip_id        Int64,
                day_type       String,
                strategy       String,
                model_class    String,
                new_class      String,
                tier_step      Int8,
                adjustment_pct Int16,
                old_price      Float64,
                new_price      Float64,
                surge_pct      Float64,
                capped         UInt8,
                reason         String
            ) ENGINE = MergeTree ORDER BY (ts, trip_id)
        ''')
        # migrate an older copy of the table (smoke test created the v1 schema)
        for col, typ in (("model_class", "String"), ("new_class", "String"),
                         ("tier_step", "Int8"), ("adjustment_pct", "Int16")):
            try:
                self.client.command(
                    f"ALTER TABLE {DECISIONS_TABLE} ADD COLUMN IF NOT EXISTS {col} {typ}")
            except Exception:
                pass

    def log_decision(self, d) -> None:
        self.client.insert(
            DECISIONS_TABLE,
            [[d.trip_id, getattr(d, "day_type", ""), d.strategy, d.model_class,
              d.new_class, d.tier_step, d.adjustment_pct, d.old_price,
              d.final_price, d.surge_pct, int(d.capped), d.reason]],
            column_names=["trip_id", "day_type", "strategy", "model_class",
                          "new_class", "tier_step", "adjustment_pct", "old_price",
                          "new_price", "surge_pct", "capped", "reason"],
        )

    def last_decision(self):
        """Most recent changed decision (trip_id, model_class, new_class, adjustment_pct)
        for durable undo. Returns None if the log is empty."""
        rows = self.query(
            f"""SELECT trip_id, model_class, new_class, adjustment_pct
                FROM {DECISIONS_TABLE} ORDER BY ts DESC LIMIT 1""")
        if not rows:
            return None
        r = rows[0]
        return int(r[0]), str(r[1]), str(r[2]), int(r[3])

    # ── demand from last-year occupancy (DD-01 style), windowed + fallback ────
    def ly_demand_score(self, service_number: str, journey_date):
        """0..100 demand proxy = avg daily occupancy of this service. Tries a
        ±7-day window around the same date last year (journey_date-364); if that
        window has no data, falls back to the service's trailing-90-day average.
        Windowed avoids the single-exact-date gaps that returned None before."""
        from datetime import timedelta

        def windowed(a, b):
            rows = self.query(
                '''SELECT round(avg(occ)) FROM (
                       SELECT Journey_Date,
                              countIf(Ticket_Status = 'A') * 100.0 / max(total_seats) AS occ
                       FROM freshbus_operations.bus_ticket_data
                       WHERE Service_Number = {sn:String}
                         AND Journey_Date BETWEEN {a:Date} AND {b:Date}
                       GROUP BY Journey_Date
                       HAVING max(total_seats) > 0)''',
                {"sn": service_number, "a": a, "b": b})
            val = rows[0][0] if rows else None
            if val is None:
                return None
            f = float(val)
            if f != f:               # NaN (ClickHouse avg over empty set) → no data
                return None
            return max(0, min(100, int(f)))

        ly = journey_date - timedelta(days=364)
        return (windowed(ly - timedelta(days=7), ly + timedelta(days=7))
                or windowed(journey_date - timedelta(days=90), journey_date - timedelta(days=1)))

    # ── BATCHED demand for many services in ONE query (fast; avoids N round-trips) ──
    def ly_demand_scores(self, service_numbers) -> dict:
        """{service_number: 0..100} avg daily occupancy over the trailing 60 days,
        for all given services in a single query. Robust + fast demand proxy."""
        sns = sorted({s for s in service_numbers if s})
        if not sns:
            return {}
        inlist = ",".join("'" + s.replace("'", "''") + "'" for s in sns)
        rows = self.query(
            f"""SELECT Service_Number, round(avg(daily_occ)) AS score FROM (
                    SELECT Service_Number, Journey_Date,
                           countIf(Ticket_Status = 'A') * 100.0 / max(total_seats) AS daily_occ
                    FROM freshbus_operations.bus_ticket_data
                    WHERE Service_Number IN ({inlist})
                      AND Journey_Date >= today() - 60 AND Journey_Date < today()
                    GROUP BY Service_Number, Journey_Date
                    HAVING max(total_seats) > 0
                ) GROUP BY Service_Number"""
        )
        out: dict = {}
        for r in rows:
            sn, sc = r[0], r[1]
            if sc is not None and sc == sc:        # skip NaN
                out[sn] = max(0, min(100, int(sc)))
        return out

    # ── DURABLE feature store: precomputed per-service features ───────────────
    FEATURE_TABLE = "fs_service_features"

    def ensure_feature_store(self) -> None:
        """Create the durable per-service feature table (idempotent)."""
        self.create_feature_table(self.FEATURE_TABLE, f'''
            CREATE TABLE IF NOT EXISTS {self.FEATURE_TABLE} (
                service_number   String,
                final_occ_median Float64,
                journeys         UInt32,
                fare_p25         Float64,
                fare_median      Float64,
                fare_p75         Float64,
                occ_fare_corr    Float64,
                built_at         DateTime DEFAULT now()
            ) ENGINE = ReplacingMergeTree(built_at) ORDER BY service_number
        ''')

    def rebuild_service_features(self, days: int = 150) -> int:
        """The 'nightly' job: aggregate bus_ticket_data into fs_service_features —
        per-service final-occ median + journey count + fare band + occupancy↔fare
        correlation (elasticity proxy). ReplacingMergeTree dedups on service_number.
        Returns the number of services written."""
        self.ensure_feature_store()
        self.client.command(f'''
            INSERT INTO {self.FEATURE_TABLE}
                (service_number, final_occ_median, journeys, fare_p25, fare_median,
                 fare_p75, occ_fare_corr)
            SELECT Service_Number, round(median(occ)), count(),
                   round(quantile(0.25)(fare)), round(median(fare)),
                   round(quantile(0.75)(fare)), corr(occ, fare)
            FROM (
                SELECT Service_Number, Journey_Date,
                       countIf(Ticket_Status = 'A') * 100.0 / max(total_seats) AS occ,
                       avgIf(Seat_fare, Ticket_Status = 'A') AS fare
                FROM freshbus_operations.bus_ticket_data
                WHERE Journey_Date >= today() - {int(days)} AND Journey_Date < today()
                GROUP BY Service_Number, Journey_Date
                HAVING max(total_seats) > 0 AND fare > 0
            ) GROUP BY Service_Number
        ''')
        self._record_change("REBUILD", f"{self.FEATURE_TABLE} ({days}d window)")
        rows = self.query(f"SELECT count() FROM {self.FEATURE_TABLE} FINAL")
        return int(rows[0][0]) if rows else 0

    def _elasticity(self, corr) -> float:
        """occ↔fare correlation → 0..100 elasticity (high = price-sensitive).
        Negative corr (occupancy falls as fare rises) ⇒ elastic. NaN ⇒ neutral."""
        if corr is None or corr != corr:        # NaN guard
            return 50.0
        return max(0.0, min(100.0, 50.0 - float(corr) * 50.0))

    def service_features(self, service_numbers) -> dict:
        """{service_number: {final_occ_median, journeys, elasticity, fare_median}}
        from the DURABLE store (latest build). {} if the table is empty/absent."""
        sns = sorted({s for s in service_numbers if s})
        if not sns:
            return {}
        inlist = ",".join("'" + s.replace("'", "''") + "'" for s in sns)
        rows = self.query(
            f"""SELECT service_number, final_occ_median, journeys, occ_fare_corr, fare_median
                FROM {self.FEATURE_TABLE} FINAL WHERE service_number IN ({inlist})""")
        out: dict = {}
        for sn, med, jrn, corr, faremed in rows:
            out[sn] = {"final_occ_median": max(0, min(100, int(med))),
                       "journeys": int(jrn), "elasticity": self._elasticity(corr),
                       "fare_median": float(faremed or 0)}
        return out

    def history_features(self, service_numbers) -> dict:
        """Prefer the DURABLE store (precomputed, incl. elasticity); fall back to a
        live bus_ticket_data scan (no elasticity) if the store isn't built yet."""
        try:
            r = self.service_features(service_numbers)
        except Exception:
            r = {}
        if r:
            return r
        return {sn: {**v, "elasticity": 50.0}
                for sn, v in self.history_signals(service_numbers).items()}

    # ── BATCHED history signals: typical final occupancy + how much history ───
    def history_signals(self, service_numbers, days: int = 150) -> dict:
        """{service_number: {'final_occ_median': 0..100, 'journeys': int}} in ONE
        query. final_occ_median = the service's typical end-state occupancy over
        the trailing `days`; journeys = how many past journeys we observed (depth
        / confidence proxy). Feeds metrics.history -> pace_percentile + history_depth.
        Verified live 2026-06-17: medians 80-95%, ~150 journeys for daily services."""
        sns = sorted({s for s in service_numbers if s})
        if not sns:
            return {}
        inlist = ",".join("'" + s.replace("'", "''") + "'" for s in sns)
        rows = self.query(
            f"""SELECT Service_Number,
                       round(median(occ)) AS final_occ_median,
                       count() AS journeys
                FROM (
                    SELECT Service_Number, Journey_Date,
                           countIf(Ticket_Status = 'A') * 100.0 / max(total_seats) AS occ
                    FROM freshbus_operations.bus_ticket_data
                    WHERE Service_Number IN ({inlist})
                      AND Journey_Date >= today() - {int(days)} AND Journey_Date < today()
                    GROUP BY Service_Number, Journey_Date
                    HAVING max(total_seats) > 0
                ) GROUP BY Service_Number"""
        )
        out: dict = {}
        for r in rows:
            sn, med, jrn = r[0], r[1], r[2]
            if med is not None and med == med:        # skip NaN
                out[sn] = {"final_occ_median": max(0, min(100, int(med))),
                           "journeys": int(jrn)}
        return out

    # ── BATCHED competitor market stats (APSRTC live scrape) ──────────────────
    def competitor_market(self):
        """Per (route, journey_date) for all FUTURE journeys: median/min/max fare,
        #services, sellout fraction — using the LATEST capture per service. ONE
        query; matched to our trips by metrics.competitor (city-pair + date).
        Source aprstc_scraping_data is live (verified 2026-06-17). redbus/abhibus
        scrapes are stale (~2025-07) and intentionally excluded."""
        return self.query(
            """SELECT route, journey_date,
                      round(median(price)) AS med, min(price) AS minp, max(price) AS maxp,
                      count() AS n_services,
                      countIf(seats = 0) / count() AS sellout_frac
               FROM (
                   SELECT route, journey_date, service_number,
                          argMax(ticket_price, capture_date)    AS price,
                          argMax(available_seats, capture_date) AS seats
                   FROM freshbus_operations.aprstc_scraping_data
                   WHERE journey_date >= today() AND journey_date <= today() + 30
                   GROUP BY route, journey_date, service_number
               )
               WHERE price > 0
               GROUP BY route, journey_date"""
        )

    # ── BATCHED look-to-book funnel (live demand) ─────────────────────────────
    def ltb_signals(self, service_ids, days: int = 14) -> dict:
        """{(service_id, journey_date): {'looks','block','books'}} for our active
        window, in ONE query. Source looks_to_books is live (verified 2026-06-17,
        covers all active service_ids). Feeds metrics.ltb -> visit_momentum + LTB-08."""
        sids = sorted({int(s) for s in service_ids if s is not None})
        if not sids:
            return {}
        inlist = ",".join(str(s) for s in sids)
        rows = self.query(
            f"""SELECT service_id, journey_date,
                       sum(looks) AS looks, sum(block) AS block, sum(books) AS books
                FROM freshbus_operations.looks_to_books
                WHERE service_id IN ({inlist})
                  AND journey_date >= today() AND journey_date <= today() + {int(days)}
                GROUP BY service_id, journey_date"""
        )
        out: dict = {}
        for sid, jd, looks, block, books in rows:
            out[(int(sid), jd)] = {"looks": int(looks or 0),
                                   "block": int(block or 0), "books": int(books or 0)}
        return out

    # ── example historical read (booking-curve / velocity feature) ────────────
    def booking_velocity_24h(self, service_number: str, journey_date) -> int:
        # bus_ticket_data is seat-grain with Booked_date_time. # VERIFY join key.
        rows = self.query(
            '''SELECT count() FROM freshbus_operations.bus_ticket_data
               WHERE Service_Number = {sn:String} AND Journey_Date = {jd:Date}
                 AND Ticket_Status = 'A'
                 AND Booked_date_time >= now() - INTERVAL 24 HOUR''',
            {"sn": service_number, "jd": journey_date})
        return int(rows[0][0]) if rows else 0
