"""CollectorAgent — gathers raw state for every active trip into the blackboard.
Deterministic (no LLM). Reads live state from Postgres (RO); demand is derived
from historical occupancy in ClickHouse via ONE batched query (fast). Set
SKIP_LY_DEMAND=1 to bypass the ClickHouse demand lookup entirely."""
from __future__ import annotations
import os
from datetime import date, datetime

from .base import Agent
from blackboard import TripState
from signals import compute
from metrics.history import build_extras
from metrics import competitor as comp


class CollectorAgent(Agent):
    name = "Collector"

    def __init__(self, repo, today: date | None = None, ch_store=None):
        self.repo = repo
        self.today = today or date.today()
        self.ch = ch_store

    def run(self, bb) -> None:
        trips = self.repo.active_trips()
        skip_ly = os.environ.get("SKIP_LY_DEMAND") == "1"

        # ONE batched ClickHouse query each for demand + history across all services.
        demand_by_service: dict = {}
        history_by_service: dict = {}
        if self.ch is not None and not skip_ly:
            sns = [t.get("service_number") for t in trips if t.get("service_number")]
            try:
                demand_by_service = self.ch.ly_demand_scores(sns)
            except Exception as e:
                print(f"[collector] LY demand batch skipped: {e}", flush=True)
            try:
                history_by_service = self.ch.history_signals(sns)
            except Exception as e:
                print(f"[collector] history batch skipped: {e}", flush=True)

        # ONE batched query for competitor (APSRTC) market stats; matched in-loop.
        comp_index: dict = {}
        if self.ch is not None and not skip_ly:
            try:
                comp_index = comp.build_market_index(self.ch.competitor_market())
            except Exception as e:
                print(f"[collector] competitor batch skipped: {e}", flush=True)

        ly_used = 0
        hist_used = 0
        comp_used = 0
        for trip in trips:
            tid = trip["id"]
            seats = self.repo.seats(tid)
            bookings = self.repo.bookings(tid)
            dep = trip["departure_date"]
            dep = dep.date() if isinstance(dep, datetime) else dep
            demand = self.repo.demand(trip["route_id"], dep)
            sn = trip.get("service_number")
            if demand is None and sn in demand_by_service:
                demand = {"demand_score": demand_by_service[sn], "is_festival": False}
                ly_used += 1
            rules = self.repo.price_rules(trip["route_id"])
            sig = compute(trip, seats, bookings, demand, today=self.today)
            extras = build_extras(history_by_service.get(sn), sig.occupancy_pct, sig.lead_days)
            if extras:
                hist_used += 1
            if comp_index:
                cx = comp.build_extras(comp.parse_our_pair(trip.get("service_name")),
                                       dep, trip.get("base_fare"), comp_index)
                if cx:
                    extras.update(cx)
                    comp_used += 1
            bb.trips[tid] = TripState(trip=trip, seats=seats, bookings=bookings,
                                      demand=demand, rules=rules, signals=sig,
                                      extras=extras)

        extra = (f" (demand from LY for {ly_used})" if ly_used
                 else " (LY demand skipped)" if skip_ly else "")
        extra += f", history for {hist_used}" if hist_used else ""
        extra += f", competitor for {comp_used}" if comp_used else ""
        bb.log(self.name, f"collected {len(bb.trips)} active trips{extra}")
