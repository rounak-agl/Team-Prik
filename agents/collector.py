"""CollectorAgent — gathers raw state for every active trip into the blackboard.
Deterministic (no LLM). Reads live state from Postgres (RO); when Postgres has no
demand_calendar, derives demand_score from last-year same-day occupancy in
ClickHouse (per the chosen demand source)."""
from __future__ import annotations
from datetime import date, datetime

from .base import Agent
from blackboard import TripState
from signals import compute


class CollectorAgent(Agent):
    name = "Collector"

    def __init__(self, repo, today: date | None = None, ch_store=None):
        self.repo = repo
        self.today = today or date.today()
        self.ch = ch_store

    def run(self, bb) -> None:
        ly_used = 0
        for trip in self.repo.active_trips():
            tid = trip["id"]
            seats = self.repo.seats(tid)
            bookings = self.repo.bookings(tid)
            dep = trip["departure_date"]
            dep = dep.date() if isinstance(dep, datetime) else dep
            demand = self.repo.demand(trip["route_id"], dep)
            # derive demand from LY occupancy if not provided and ClickHouse is up
            if demand is None and self.ch is not None and trip.get("service_number"):
                try:
                    score = self.ch.ly_demand_score(trip["service_number"], dep)
                    if score is not None:
                        demand = {"demand_score": score, "is_festival": False}
                        ly_used += 1
                except Exception:
                    pass
            rules = self.repo.price_rules(trip["route_id"])
            sig = compute(trip, seats, bookings, demand, today=self.today)
            bb.trips[tid] = TripState(trip=trip, seats=seats, bookings=bookings,
                                      demand=demand, rules=rules, signals=sig)
        extra = f" (demand from LY for {ly_used})" if ly_used else ""
        bb.log(self.name, f"collected {len(bb.trips)} active trips{extra}")
