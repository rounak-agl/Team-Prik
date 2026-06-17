"""PostgresRepo — read-only access to the live production app DB, exposing the
same interface the agents use (matches MemoryRepo). Postgres is READ-ONLY:
the connection is opened read-only and writes raise.

Schema confirmed live (Postgres 16): Trips(29) / TripSeats(21) /
ServiceAnalyticsData(12) / Routes(13) / ReservedTicketSeats(24).
"""
from __future__ import annotations
import os
from datetime import date, datetime

import config

WINDOW_DAYS = int(os.environ.get("PRICING_WINDOW_DAYS", "14"))   # only price trips within N days
MAX_TRIPS   = int(os.environ.get("PRICING_MAX_TRIPS", "2000"))   # safety cap per cycle
DEFAULT_MAX_SURGE_PCT = float(os.environ.get("DEFAULT_MAX_SURGE_PCT", "60"))
DEFAULT_MAX_DISCOUNT_PCT = float(os.environ.get("DEFAULT_MAX_DISCOUNT_PCT", "30"))
DEFAULT_FLOOR_FRAC = 0.6     # floor = 60% of base if no configured limit
DEFAULT_CEILING_FRAC = 2.0   # ceiling = 200% of base if no configured limit


class PostgresRepo:
    def __init__(self, today: date | None = None):
        import psycopg2
        import psycopg2.extras
        self._rows = psycopg2.extras.RealDictCursor
        self.conn = psycopg2.connect(config.postgres_dsn())
        self.conn.set_session(readonly=True, autocommit=True)   # hard read-only
        self.today = today or date.today()
        self._route_cache: dict = {}

    def _q(self, sql, args=()):
        with self.conn.cursor(cursor_factory=self._rows) as cur:
            cur.execute(sql, args)
            return [dict(r) for r in cur.fetchall()]

    # ── trips (windowed + capped) ─────────────────────────────────────────────
    def active_trips(self) -> list[dict]:
        rows = self._q(
            '''SELECT id, "serviceId", "journeyDate", "staticBaseFare", "basicCost",
                      "asp", kilometers, "fareClassification", "serviceNumber", "serviceName",
                      "sourceId", "destinationId", "srpPosition"
               FROM "Trips"
               WHERE active = TRUE
                 AND "journeyDate" >= %s
                 AND "journeyDate" <= %s
               ORDER BY "journeyDate"
               LIMIT %s''',
            (self.today, self.today.fromordinal(self.today.toordinal() + WINDOW_DAYS), MAX_TRIPS))
        out = []
        for r in rows:
            base = r.get("staticBaseFare") or r.get("asp") or r.get("basicCost") or 0
            sid = r["serviceId"]
            self._route_cache[sid] = {
                "id": sid, "origin": r.get("serviceName") or r.get("serviceNumber") or str(sid),
                "destination": "", "distance_km": r.get("kilometers"), "route_tier": "standard"}
            out.append({
                "id": r["id"], "route_id": sid, "service_id": sid,
                "departure_date": r["journeyDate"], "base_fare": float(base),
                "kilometers": r.get("kilometers"), "fare_classification": r.get("fareClassification"),
                "service_number": r.get("serviceNumber"), "service_name": r.get("serviceName"),
                "srp_position": r.get("srpPosition"),
                "status": "active",
            })
        return out

    # ── seats: booked = not available, excluding broken ───────────────────────
    def seats(self, trip_id: int) -> list[dict]:
        rows = self._q(
            '''SELECT id, fare, available, "hasStaticFare", discount
               FROM "TripSeats"
               WHERE "tripId" = %s AND active = TRUE
                 AND (broken = FALSE OR broken IS NULL)''', (trip_id,))
        return [{
            "id": r["id"],
            "is_booked": not bool(r["available"]),
            "price": float(r["fare"]) if r.get("fare") is not None else None,
            "has_static_fare": bool(r.get("hasStaticFare")),
            "discount": float(r["discount"]) if r.get("discount") is not None else 0.0,
        } for r in rows]

    # ── velocity source is ClickHouse (bus_ticket_data); none from PG ─────────
    def bookings(self, trip_id: int) -> list[dict]:
        # ReservedTicketSeats has no tripId; per-trip booking timestamps would
        # need a ReservedTickets join. v1 sources velocity from ClickHouse
        # (ClickHouseStore.booking_velocity_24h via service_number+journey_date).
        return []

    # ── demand: no demand_calendar in prod → neutral for v1 ───────────────────
    def demand(self, route_id: int, on: date) -> dict | None:
        return None   # TODO: derive demand_score from LY same-day occupancy (ClickHouse)

    # ── price rules: ServiceAnalyticsData seat-class limits → floor/ceiling ────
    def price_rules(self, service_id: int) -> dict:
        floor = ceiling = None
        try:
            r = self._q(
                '''SELECT "seaterLowerLimit", "sleeperLowerLimit", "sharedSleeperLowerLimit",
                          "seaterUpperLimit", "sleeperUpperLimit", "sharedSleeperUpperLimit"
                   FROM "ServiceAnalyticsData" WHERE "serviceId" = %s
                   ORDER BY id DESC LIMIT 1''', (service_id,))
            if r:
                lows = [r[k] for k in ("seaterLowerLimit","sleeperLowerLimit","sharedSleeperLowerLimit") if r.get(k)]
                ups  = [r[k] for k in ("seaterUpperLimit","sleeperUpperLimit","sharedSleeperUpperLimit") if r.get(k)]
                floor = min(lows) if lows else None
                ceiling = max(ups) if ups else None
        except Exception:
            pass
        return {
            "route_id": service_id,
            "min_price": float(floor) if floor else None,    # None → validator uses base*frac
            "max_price": float(ceiling) if ceiling else None,
            "max_surge_pct": DEFAULT_MAX_SURGE_PCT,
            "max_discount_pct": DEFAULT_MAX_DISCOUNT_PCT,
            "_default_floor_frac": DEFAULT_FLOOR_FRAC,
            "_default_ceiling_frac": DEFAULT_CEILING_FRAC,
        }

    def route(self, route_id: int) -> dict:
        return self._route_cache.get(route_id, {
            "id": route_id, "origin": str(route_id), "destination": "",
            "distance_km": None, "route_tier": "standard"})

    def current_price(self, trip_id: int) -> float:
        un = [s for s in self.seats(trip_id) if not s["is_booked"] and s["price"]]
        return float(un[0]["price"]) if un else 0.0

    # ── writes forbidden on Postgres ──────────────────────────────────────────
    def update_unsold_seat_prices(self, trip_id, price):
        raise RuntimeError("Postgres is read-only — fares write via the admin API, not here.")

    def log_price_change(self, trip_id, old, new, reason):
        raise RuntimeError("Postgres is read-only — decisions log to ClickHouse fs_pricing_decisions.")
