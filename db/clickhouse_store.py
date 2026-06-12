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
