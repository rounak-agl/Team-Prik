"""ValidatorAgent — the single deterministic safety chokepoint. Clamps every
proposed price into [min_price, max_price], enforces max_surge/max_discount,
and asserts the result is in-bounds. No price reaches the Writer unvalidated.
This is why an LLM can never cause a disqualifying out-of-bounds fare."""
from __future__ import annotations
from .base import Agent
from pricing_core import PriceRules


def _round10(x): return int(round(x / 10.0) * 10)


class ValidatorAgent(Agent):
    name = "Validator"

    def run(self, bb) -> None:
        capped = 0
        for ts in bb.targets():
            d = ts.decision
            r = ts.rules
            rules = PriceRules(float(r["min_price"]), float(r["max_price"]),
                               float(r["max_surge_pct"]), float(r["max_discount_pct"]))
            base = d.base_fare
            price = float(d.proposed)

            max_surge = base * (1 + rules.max_surge_pct / 100.0)
            max_disc  = base * (1 - rules.max_discount_pct / 100.0)
            was = price
            price = min(price, max_surge)
            price = max(price, max_disc)
            price = min(price, rules.max_price)
            price = max(price, rules.min_price)
            price = _round10(price)
            # final guarantee
            assert rules.min_price <= price <= rules.max_price, "price_rules violated"

            d.final_price = price
            d.capped = (price != was)
            d.surge_pct = round((price - base) / base * 100.0, 1)
            d.changed = (price != round(d.old_price))
            if d.capped:
                capped += 1
        bb.log(self.name, f"validated {len(bb.targets())} prices, clamped {capped}; 0 bound violations")
