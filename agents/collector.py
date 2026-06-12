"""CollectorAgent — gathers raw state for every active trip into the blackboard.
Deterministic (no LLM). In production this reads Postgres (RO) + ClickHouse;
here it reads the seeded repo through the same interface."""
from __future__ import annotations
from datetime import date, datetime

from .base import Agent
from blackboard import TripState
from signals import compute


class CollectorAgent(Agent):
    name = "Collector"

    def __init__(self, repo, today: date | None = None):
        self.repo = repo
        self.today = today or date.today()

    def run(self, bb) -> None:
        for trip in self.repo.active_trips():
            tid = trip["id"]
            seats = self.repo.seats(tid)
            bookings = self.repo.bookings(tid)
            dep = trip["departure_date"]
            dep = dep.date() if isinstance(dep, datetime) else dep
            demand = self.repo.demand(trip["route_id"], dep)
            rules = self.repo.price_rules(trip["route_id"])
            sig = compute(trip, seats, bookings, demand, today=self.today)
            bb.trips[tid] = TripState(trip=trip, seats=seats, bookings=bookings,
                                      demand=demand, rules=rules, signals=sig)
        bb.log(self.name, f"collected {len(bb.trips)} active trips")
