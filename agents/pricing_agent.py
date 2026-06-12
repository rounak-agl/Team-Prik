"""PricingAgent — proposes a price per targeted trip using the deterministic
pricing core (occupancy + lead + demand + velocity, day-type strategy, distress
discount). It only PROPOSES; the ValidatorAgent enforces price_rules. This keeps
the math explainable and the safety guarantee in one place."""
from __future__ import annotations
from .base import Agent
from pricing_core import propose


class PricingAgent(Agent):
    name = "PricingAgent"

    def run(self, bb) -> None:
        for ts in bb.targets():
            base = float(ts.trip["base_fare"])
            cur = next((float(s["price"]) for s in ts.seats if not s["is_booked"]), base)
            ts.decision = propose(ts.signals, base, cur)
            d = ts.decision
            bb.log(self.name, f"trip {d.trip_id}: propose ₹{d.proposed} "
                              f"({ts.signals.day_type} day, {d.strategy})")
