"""PlannerAgent — gates which trips need a pricing action this cycle and
prioritises them. Deterministic gate (cheap, reliable); the LLM is not on this
path. A trip is a target if it's off-pace, near a demand inflection, hot, or
distressed — otherwise it's a no-op (don't churn prices for nothing)."""
from __future__ import annotations
from .base import Agent


class PlannerAgent(Agent):
    name = "Planner"

    def run(self, bb) -> None:
        n = 0
        for ts in bb.trips.values():
            s = ts.signals
            off_pace   = abs(s.pace_ratio - 1.0) >= 0.15
            hot        = s.occupancy_pct >= 85
            distressed = s.lead_days <= 3 and s.occupancy_pct < 50
            festival   = s.is_festival
            soft_day   = s.day_type == "low"
            ts.is_target = bool(off_pace or hot or distressed or festival or soft_day)
            # priority: urgency from how far off-pace + how little time remains
            ts.priority = abs(s.pace_ratio - 1.0) + max(0, (14 - s.lead_days)) / 14.0
            if ts.is_target:
                n += 1
        order = sorted(bb.targets(), key=lambda t: t.priority, reverse=True)
        ids = ", ".join(str(t.trip["id"]) for t in order)
        bb.log(self.name, f"{n}/{len(bb.trips)} trips need action (priority order: {ids})")
