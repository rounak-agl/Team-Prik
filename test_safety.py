"""Safety tests for the two-lever output (classification + adjustment %):
  1. Strong surge → tier ↑1 + adjustment capped at +20%.
  2. Distress → negative adjustment (discount), within ±20%.
  3. Across a fuzz: adjustment ∈ [-20,20], tier step ∈ {-1,0,+1}, price in bounds.
"""
from __future__ import annotations
from signals import Signals
from pricing_core import propose, PriceRules, ADJ_CAP, tier_index, TIERS


def _sig(occ, lead, demand, fest=False, vel=0, total=40):
    booked = round(occ / 100 * total)
    return Signals(1, occ, lead, demand, fest, vel, total, booked, total - booked,
                   round(occ / max(1, 60), 2), "absolute")


def _enforce(d, base, rules):
    adj = max(-ADJ_CAP, min(int(d.adjustment_pct), ADJ_CAP))
    p = base * (1 + adj / 100)
    p = min(p, base * (1 + rules.max_surge_pct / 100))
    p = max(p, base * (1 - rules.max_discount_pct / 100))
    p = min(p, rules.max_price); p = max(p, rules.min_price)
    return int(round(p / 10) * 10)


def test_surge_steps_tier_and_caps_adjustment():
    d = propose(_sig(85, 4, 72), 650, 650, "Medium")   # net +35% > cap
    assert d.adjustment_pct == 20, d.adjustment_pct
    assert d.tier_step == 1 and d.new_class == "High"


def test_distress_discounts_via_negative_adjustment():
    d = propose(_sig(30, 2, 40), 500, 500, "Medium")
    assert d.adjustment_pct < 0, d.adjustment_pct      # discount, not 0
    assert -ADJ_CAP <= d.adjustment_pct <= 0


def test_levers_within_bounds_fuzz():
    rules = PriceRules(400, 1200, 60, 30)
    for occ in range(0, 101, 5):
        for lead in range(0, 31, 2):
            for dem in range(0, 101, 10):
                for mc in TIERS:
                    d = propose(_sig(occ, lead, dem, fest=(dem > 80)), 650, 650, mc)
                    assert -ADJ_CAP <= d.adjustment_pct <= ADJ_CAP
                    assert d.tier_step in (-1, 0, 1)
                    assert abs(tier_index(d.new_class) - tier_index(mc)) <= 1
                    final = _enforce(d, 650, rules)
                    assert rules.min_price <= final <= rules.max_price


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} tests passed.")
