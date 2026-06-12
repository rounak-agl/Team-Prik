"""Data access — seeded in-memory so the system runs end-to-end with zero setup.
Swap to a PostgresRepo later by matching this interface. Includes the brief's
worked example so the demo reproduces ₹880 exactly.
"""
from __future__ import annotations
from datetime import date, datetime, timedelta


class MemoryRepo:
    def __init__(self, today: date | None = None):
        self.today = today or date.today()
        self._history: list[dict] = []
        self._seed()

    def _seed(self):
        t = self.today
        self.routes = {
            1: dict(id=1, origin="HYDERABAD", destination="BANGALORE", distance_km=570, route_tier="premium"),
            2: dict(id=2, origin="BANGALORE", destination="TIRUPATI",  distance_km=250, route_tier="standard"),
        }
        self.demand_rows = {
            (1, t + timedelta(days=4)):  dict(demand_score=72, is_festival=False),
            (2, t + timedelta(days=2)):  dict(demand_score=40, is_festival=False),
            (2, t + timedelta(days=6)):  dict(demand_score=92, is_festival=True),
            (1, t + timedelta(days=20)): dict(demand_score=55, is_festival=False),
        }
        self.rules = {
            1: dict(route_id=1, min_price=400, max_price=1200, max_surge_pct=60, max_discount_pct=30),
            2: dict(route_id=2, min_price=250, max_price=900,  max_surge_pct=60, max_discount_pct=30),
        }
        # (id, route, days_out, base, total, booked, recent_frac)
        specs = [
            (101, 1, 4,  650, 40, 34, 0.0),   # worked example → ₹880
            (102, 2, 2,  500, 40, 12, 0.3),   # distressed → discount
            (103, 2, 6,  500, 40, 22, 0.6),   # festival + velocity → surge
            (104, 1, 20, 650, 40, 6,  0.0),   # far/soft → hold
        ]
        self.trips, self.seats_by_trip, self.bookings_by_trip = {}, {}, {}
        sid = 1
        for tid, rid, days_out, base, total, booked, recent in specs:
            self.trips[tid] = dict(id=tid, route_id=rid, departure_date=t + timedelta(days=days_out),
                                   base_fare=base, status="active")
            recent_cut = booked * recent
            seats, bks = [], []
            for i in range(total):
                cls = "window" if i % 3 == 0 else ("last_row" if i >= total-2 else "aisle")
                bkd = i < booked
                seats.append(dict(id=sid, trip_id=tid, seat_class=cls, is_booked=bkd, price=base))
                if bkd:
                    hrs = 6 if i < recent_cut else 40
                    bks.append(dict(id=sid, trip_id=tid, created_at=datetime.now()-timedelta(hours=hrs)))
                sid += 1
            self.seats_by_trip[tid] = seats
            self.bookings_by_trip[tid] = bks

    def active_trips(self):       return [t for t in self.trips.values() if t["status"] == "active"]
    def seats(self, tid):         return self.seats_by_trip.get(tid, [])
    def bookings(self, tid):      return self.bookings_by_trip.get(tid, [])
    def route(self, rid):         return self.routes[rid]
    def demand(self, rid, on):    return self.demand_rows.get((rid, on))
    def price_rules(self, rid):   return self.rules[rid]

    def current_price(self, tid):
        un = [s for s in self.seats(tid) if not s["is_booked"]]
        return float(un[0]["price"]) if un else float(self.trips[tid]["base_fare"])

    def update_unsold_seat_prices(self, tid, price):
        n = 0
        for s in self.seats_by_trip.get(tid, []):
            if not s["is_booked"]:
                s["price"] = price; n += 1
        return n

    def log_price_change(self, tid, old, new, reason):
        self._history.append(dict(trip_id=tid, old_price=old, new_price=new,
                                  reason=reason, changed_at=datetime.now()))

    def price_history(self):      return self._history
