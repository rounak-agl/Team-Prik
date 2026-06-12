"""PostgresRepo — read-only access to the live production app DB, exposing the
same interface the agents use (matches MemoryRepo). Postgres is READ-ONLY: this
class only ever issues SELECTs; price writes go through the fare API / ClickHouse
results table, never a Postgres write.

Schema mapping (from the provided production schema dump). Columns are camelCase
so they MUST be double-quoted in Postgres. Mappings marked `# VERIFY` are the
ones to confirm against the live DB via check_connections.py before trusting.
"""
from __future__ import annotations
import os
from datetime import date, datetime

import config

# Fallback price-rule caps when ServiceAnalyticsData limits are unavailable.
DEFAULT_MAX_SURGE_PCT = float(os.environ.get("DEFAULT_MAX_SURGE_PCT", "60"))
DEFAULT_MAX_DISCOUNT_PCT = float(os.environ.get("DEFAULT_MAX_DISCOUNT_PCT", "30"))
DEFAULT_FLOOR_FRAC = 0.6      # floor = 60% of base if no configured limit
DEFAULT_CEILING_FRAC = 2.0   # ceiling = 200% of base if no configured limit


class PostgresRepo:
    def __init__(self, today: date | None = None):
        import psycopg2
        import psycopg2.extras
        self._pg = psycopg2
        self._rows = psycopg2.extras.RealDictCursor
        self.conn = psycopg2.connect(config.postgres_dsn())
        self.conn.set_session(readonly=True, autocommit=True)  # hard read-only
        self.today = today or date.today()
        self._route_cache: dict = {}

    def _q(self, sql: str, args=()):
        with self.conn.cursor(cursor_factory=self._rows) as cur:
            cur.execute(sql, args)
            return [dict(r) for r in cur.fetchall()]

    # ── trips ────────────────────────────────────────────────────────────────
    def active_trips(self) -> list[dict]:
        rows = self._q(
            '''SELECT id, "serviceId", "journeyDate", "staticBaseFare", "basicCost",
                      "asp", kilometers, "fareClassification", "serviceNumber",
                      "sourceId", "destinationId"
               FROM "Trips"
               WHERE active = TRUE AND "journeyDate" >= %s
               ORDER BY "journeyDate"''', (self.today,))
        out = []
        for r in rows:
            base = r.get("staticBaseFare") or r.get("asp") or r.get("basicCost") or 0
            out.append({
                "id": r["id"],
                "route_id": r["serviceId"],          # key we thread to demand/price_rules # VERIFY
                "service_id": r["serviceId"],
                "departure_date": r["journeyDate"],
                "base_fare": float(base),
                "kilometers": r.get("kilometers"),
                "fare_classification": r.get("fareClassification"),
                "service_number": r.get("serviceNumber"),
                "source_id": r.get("sourceId"),
                "destination_id": r.get("destinationId"),
                "status": "active",
            })
        return out

    # ── seats ──────────────────────────────────────────────────────────────--
    def seats(self, trip_id: int) -> list[dict]:
        rows = self._q(
            '''SELECT id, fare, available, "availablityStatus", "hasStaticFare", discount
               FROM "TripSeats" WHERE "tripId" = %s AND active = TRUE''', (trip_id,))
        return [{
            "id": r["id"],
            "is_booked": not bool(r["available"]),     # available=False → sold/blocked # VERIFY
            "price": float(r["fare"]) if r.get("fare") is not None else None,
            "has_static_fare": bool(r.get("hasStaticFare")),
            "discount": float(r["discount"]) if r.get("discount") is not None else 0.0,
        } for r in rows]

    # ── bookings (for velocity) ───────────────────────────────────────────────
    def bookings(self, trip_id: int) -> list[dict]:
        # Booking timestamps for the trip → velocity. # VERIFY table/columns.
        try:
            rows = self._q(
                '''SELECT "createdAt" FROM "ReservedTicketSeats"
                   WHERE "tripId" = %s''', (trip_id,))
            return [{"created_at": r["createdAt"]} for r in rows]
        except Exception:
            return []   # velocity degrades gracefully if mapping differs

    # ── demand ────────────────────────────────────────────────────────────────
    def demand(self, route_id: int, on: date) -> dict | None:
        # No demand_calendar in the production schema. # TODO: derive from
        # ClickHouse history (LY same-day occupancy) or a demand source.
        return None

    # ── price rules (floor/ceiling/caps) ──────────────────────────────────────
    def price_rules(self, service_id: int) -> dict:
        # Per-service seat-class limits → trip floor/ceiling. # VERIFY columns.
        floor = ceiling = None
        try:
            r = self._q(
                '''SELECT "seaterLowerLimit", "sleeperLowerLimit", "sharedSleeperLowerLimit",
                          "seaterUpperLimit", "sleeperUpperLimit", "sharedSleeperUpperLimit"
                   FROM "ServiceAnalyticsData" WHERE "serviceId" = %s
                   ORDER BY id DESC LIMIT 1''', (service_id,))
            if r:
                lows = [r[k] for k in ("seaterLowerLimit", "sleeperLowerLimit", "sharedSleeperLowerLimit") if r.get(k)]
                ups  = [r[k] for k in ("seaterUpperLimit", "sleeperUpperLimit", "sharedSleeperUpperLimit") if r.get(k)]
                floor = min(lows) if lows else None
                ceiling = max(ups) if ups else None
        except Exception:
            pass
        return {
            "route_id": service_id,
            "min_price": float(floor) if floor else None,     # None → caller uses base*DEFAULT_FLOOR_FRAC
            "max_price": float(ceiling) if ceiling else None,
            "max_surge_pct": DEFAULT_MAX_SURGE_PCT,
            "max_discount_pct": DEFAULT_MAX_DISCOUNT_PCT,
            "_default_floor_frac": DEFAULT_FLOOR_FRAC,
            "_default_ceiling_frac": DEFAULT_CEILING_FRAC,
        }

    # ── display helper ─────────────────────────────────────────────────────────
    def route(self, route_id: int) -> dict:
        return self._route_cache.get(route_id, {
            "id": route_id, "origin": "?", "destination": "?",
            "distance_km": None, "route_tier": "standard"})

    def current_price(self, trip_id: int) -> float:
        un = [s for s in self.seats(trip_id) if not s["is_booked"] and s["price"]]
        return float(un[0]["price"]) if un else 0.0

    # ── writes are NOT permitted on Postgres ──────────────────────────────────
    def update_unsold_seat_prices(self, trip_id, price):
        raise RuntimeError("Postgres is read-only — route price writes through the fare API.")

    def log_price_change(self, trip_id, old, new, reason):
        raise RuntimeError("Postgres is read-only — log to the ClickHouse results table instead.")
