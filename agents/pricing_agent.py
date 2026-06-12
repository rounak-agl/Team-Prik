"""PricingAgent — proposes the TWO levers per targeted trip:
classification move (≤1 step from the model's tier) + fare adjustment %.
Proposes only; the ValidatorAgent enforces the bounds."""
from __future__ import annotations
from .base import Agent
from pricing_core import propose


class PricingAgent(Agent):
    name = "PricingAgent"

    def run(self, bb) -> None:
        for ts in bb.targets():
            base = float(ts.trip["base_fare"])
            cur = next((float(s["price"]) for s in ts.seats if not s["is_booked"] and s["price"]), base)
            model_class = ts.trip.get("fare_classification") or ""
            ts.decision = propose(ts.signals, base, cur, model_class)
            d = ts.decision
            step = {1: "↑", -1: "↓", 0: "="}[d.tier_step]
            bb.log(self.name, f"trip {d.trip_id}: class {d.model_class or '?'} {step} {d.new_class}, "
                              f"adj +{d.adjustment_pct}% ({ts.signals.day_type} day)")
