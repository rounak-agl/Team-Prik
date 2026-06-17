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
from metrics import ltb


class CollectorAgent(Agent):
    name = "Collector"

    def __init__(self, repo, today: date | None = None, ch_store=None, mem=None):
        self.repo = repo
        self.today = today or date.today()
        self.ch = ch_store
        self.mem = mem        # MemoryManager: caches families per tier + velocity deque

    def run(self, bb) -> None:
        trips = self.repo.active_trips()
        skip_ly = os.environ.get("SKIP_LY_DEMAND") == "1"
        sns = [t.get("service_number") for t in trips if t.get("service_number")]
        sids = [t.get("route_id") for t in trips if t.get("route_id") is not None]

        demand_by_service: dict = {}
        history_by_service: dict = {}
        comp_index: dict = {}
        ltb_index: dict = {}
        if not skip_ly and (self.mem is not None or self.ch is not None):
            # Through the MemoryManager (tiered cache) when present, else direct CH.
            src = self.mem
            try:
                demand_by_service = (src.demand(sns) if src else self.ch.ly_demand_scores(sns))
            except Exception as e:
                print(f"[collector] demand batch skipped: {e}", flush=True)
            try:
                history_by_service = (src.history(sns) if src else self.ch.history_signals(sns))
            except Exception as e:
                print(f"[collector] history batch skipped: {e}", flush=True)
            try:
                comp_index = (src.competitor_index() if src
                              else comp.build_market_index(self.ch.competitor_market()))
            except Exception as e:
                print(f"[collector] competitor batch skipped: {e}", flush=True)
            try:
                ltb_index = (src.ltb_index(sids) if src else self.ch.ltb_signals(sids))
            except Exception as e:
                print(f"[collector] LTB batch skipped: {e}", flush=True)

        ly_used = 0
        hist_used = 0
        comp_used = 0
        ltb_used = 0
        vel_used = 0
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
            if ltb_index:
                lx = ltb.build_extras(ltb_index.get((trip.get("route_id"), dep)),
                                      sig.lead_days, sig.occupancy_pct)
                if lx:
                    extras.update(lx)
                    ltb_used += 1
            # DEQUE tier: track booking velocity across cycles → velocity_percentile
            if self.mem is not None:
                self.mem.observe_bookings(tid, sig.seats_booked)
                vp = self.mem.velocity_percentile(tid)
                if vp is not None:
                    extras["velocity_percentile"] = vp
                    vel_used += 1
            bb.trips[tid] = TripState(trip=trip, seats=seats, bookings=bookings,
                                      demand=demand, rules=rules, signals=sig,
                                      extras=extras)

        extra = (f" (demand from LY for {ly_used})" if ly_used
                 else " (LY demand skipped)" if skip_ly else "")
        extra += f", history for {hist_used}" if hist_used else ""
        extra += f", competitor for {comp_used}" if comp_used else ""
        extra += f", LTB for {ltb_used}" if ltb_used else ""
        extra += f", velocity for {vel_used}" if vel_used else ""
        bb.log(self.name, f"collected {len(bb.trips)} active trips{extra}")
