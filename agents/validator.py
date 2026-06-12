"""ValidatorAgent — the single deterministic safety chokepoint for BOTH levers:
  * classification moves at most ±1 step from the model's tier (else reverts),
  * adjustment % stays within [0, ADJ_CAP],
  * the resulting price stays within price_rules [floor, ceiling] and the
    surge/discount caps.
No decision reaches the Writer unvalidated, so neither lever can break bounds."""
from __future__ import annotations
from .base import Agent
from pricing_core import PriceRules, ADJ_CAP, tier_index, move_tier


def _round10(x): return int(round(x / 10.0) * 10)


class ValidatorAgent(Agent):
    name = "Validator"

    def run(self, bb) -> None:
        capped = 0
        for ts in bb.targets():
            d = ts.decision
            r = ts.rules
            base = d.base_fare

            # ── lever 1: classification ≤ 1 step from the model tier ──────────
            mi, ni = tier_index(d.model_class), tier_index(d.new_class)
            if mi >= 0 and ni >= 0:
                if abs(ni - mi) > 1:                   # clamp toward intended direction
                    step = 1 if ni > mi else -1
                    d.new_class = move_tier(d.model_class, step)
                    d.tier_step = step
                    capped += 1
                else:
                    d.tier_step = ni - mi

            # ── lever 2: adjustment % within cap, resulting price within rules ─
            min_p = r.get("min_price") or base * float(r.get("_default_floor_frac", 0.6))
            max_p = r.get("max_price") or base * float(r.get("_default_ceiling_frac", 2.0))
            rules = PriceRules(float(min_p), float(max_p),
                               float(r["max_surge_pct"]), float(r["max_discount_pct"]))

            adj = max(-ADJ_CAP, min(int(d.adjustment_pct), ADJ_CAP))   # ±cap
            price = base * (1.0 + adj / 100.0)
            was = price
            price = min(price, base * (1 + rules.max_surge_pct / 100.0))
            price = max(price, base * (1 - rules.max_discount_pct / 100.0))
            price = min(price, rules.max_price)
            price = max(price, rules.min_price)
            price = _round10(price)
            assert rules.min_price <= price <= rules.max_price, "price_rules violated"

            if price != was:
                capped += 1
            # reflect any clamp back into the adjustment % we actually apply
            adj = round((price / base - 1.0) * 100) if base else 0
            d.adjustment_pct = max(-ADJ_CAP, min(adj, ADJ_CAP))
            d.final_price = price
            d.surge_pct = round((price - base) / base * 100.0, 1) if base else 0.0
            d.capped = (price != was)
            d.changed = (d.new_class != d.model_class) or (price != round(d.old_price))
            if not d.reason:                       # keep the LLM's reason if it set one
                d.reason = _reason(ts, d)
        bb.log(self.name, f"validated {len(bb.targets())} (both levers), adjusted {capped}; 0 bound violations")


def _reason(ts, d) -> str:
    s = ts.signals
    if "distress" in d.components:
        drv = f"low occupancy {s.occupancy_pct:.0f}% with {s.lead_days}d left"
    else:
        bits = []
        if d.components.get("occupancy"): bits.append(f"{s.occupancy_pct:.0f}% full")
        if d.components.get("lead"):      bits.append(f"{s.lead_days}d out")
        if d.components.get("demand"):    bits.append("festival" if s.is_festival else f"demand {s.demand_score}")
        if d.components.get("velocity"):  bits.append("selling fast")
        drv = ", ".join(bits) or "no demand pressure"
    cls = f"class {d.model_class}→{d.new_class}" if d.tier_step else f"class {d.new_class} (hold)"
    return f"{s.day_type} day, {drv} → {cls}, {d.adjustment_pct:+d}% adj."
