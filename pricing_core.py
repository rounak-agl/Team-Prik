"""Pricing math — the agent's TWO outputs (aligned with the FreshBus admin API):

  1. Model Classification  — confirm the model's tier, or move it ±1 step.
  2. Bus Fare Adjustment %  — the "score": an integer % on base fare, 0..ADJ_CAP.

The PricingAgent *proposes* both; the ValidatorAgent *enforces* the bounds
(≤1 tier step, adjustment within cap, resulting price within price_rules).

Because the admin `fare_adjustment` endpoint is increase-only (≥0), downward
moves are expressed by stepping the classification DOWN; upward moves use the
adjustment % (capped) plus a tier-up when more than the cap is wanted.
"""
from __future__ import annotations
from dataclasses import dataclass, field

from signals import Signals

# 8-tier FareClassifications enum (exact API values)
TIERS = ["Super_Low", "Low", "Medium", "High", "Super_High",
         "Ultra_High", "Special_High", "Festive"]
ADJ_CAP = 20                      # ±20% — user-set max adjustment
STRATEGY_FACTOR = {"conservative": 0.6, "balanced": 1.0, "aggressive": 1.4}


@dataclass
class PriceRules:
    min_price: float
    max_price: float
    max_surge_pct: float
    max_discount_pct: float


@dataclass
class Decision:
    trip_id: int
    base_fare: float
    old_price: float
    model_class: str = ""          # model's current classification (input)
    new_class: str = ""            # our classification (output lever 1)
    tier_step: int = 0             # -1 / 0 / +1
    adjustment_pct: int = 0        # output lever 2 (the "score"), 0..ADJ_CAP
    proposed_price: float = 0.0
    final_price: float = 0.0
    surge_pct: float = 0.0
    components: dict = field(default_factory=dict)
    strategy: str = "balanced"
    day_type: str = ""
    source: str = "rule"           # "rule" (deterministic) or "llm" (Reasoner)
    capped: bool = False
    reason: str = ""
    changed: bool = False


def tier_index(c: str) -> int:
    n = (c or "").strip().lower().replace(" ", "_")
    norm = {t.lower(): i for i, t in enumerate(TIERS)}
    return norm.get(n, -1)


def move_tier(c: str, step: int) -> str:
    i = tier_index(c)
    if i < 0:
        return c or "Medium"
    return TIERS[max(0, min(i + step, len(TIERS) - 1))]


def _occ_premium(o):  return 0.30 if o>=90 else 0.20 if o>=80 else 0.10 if o>=65 else 0.05 if o>=50 else 0.0
def _lead_premium(d): return 0.20 if d<=1 else 0.15 if d<=3 else 0.10 if d<=7 else 0.05 if d<=15 else 0.0
def _demand_premium(s, f): return 0.15 if (f or s>=85) else 0.05 if s>=70 else 0.0 if s>=50 else -0.05
def _velocity_premium(v, n):
    if not n: return 0.0
    frac = v/n
    return 0.10 if frac>=0.40 else 0.05 if frac>=0.25 else 0.0
def _distress(o, d):
    if d<=1 and o<50: return -0.20
    if d<=2 and o<35: return -0.15
    if d<=3 and o<25: return -0.10
    return 0.0


def strategy_for(sig: Signals) -> str:
    if sig.day_type == "low":
        return "conservative"
    if sig.day_type == "pseudo":
        return "aggressive" if sig.pace_ratio >= 1.15 else "conservative" if sig.pace_ratio <= 0.85 else "balanced"
    return "balanced"


def _round10(x): return int(round(x/10.0)*10)


def propose(sig: Signals, base_fare: float, current_price: float, model_class: str) -> Decision:
    """Compute the two levers (classification move + adjustment %)."""
    model_class = (model_class or "").strip() or "Medium"   # null tier in prod → mid default
    factor = STRATEGY_FACTOR[strategy_for(sig)]
    occ, lead = _occ_premium(sig.occupancy_pct), _lead_premium(sig.lead_days)
    dem, vel = _demand_premium(sig.demand_score, sig.is_festival), _velocity_premium(sig.velocity_per_day, sig.seats_total)
    distress = _distress(sig.occupancy_pct, sig.lead_days)

    if distress < 0:
        net = distress
        comp = {"distress": distress}
    else:
        net = (occ + lead + vel + max(dem, 0.0)) * factor + min(dem, 0.0)
        comp = {"occupancy": occ, "lead": lead, "demand": dem, "velocity": vel}

    pct = round(net * 100)
    if pct >= 0:
        adjustment_pct = min(pct, ADJ_CAP)             # 0..cap
        tier_step = 1 if pct > ADJ_CAP else 0           # need more than cap → tier up
    else:
        tier_step = -1                                  # discount → step tier down (API adj is ≥0)
        adjustment_pct = 0

    new_class = move_tier(model_class, tier_step)
    if tier_index(new_class) == tier_index(model_class):
        tier_step = 0                                   # couldn't move (boundary) / no model tier

    proposed = _round10(base_fare * (1.0 + adjustment_pct / 100.0))
    return Decision(
        trip_id=sig.trip_id, base_fare=base_fare, old_price=current_price,
        model_class=model_class or "", new_class=new_class, tier_step=tier_step,
        adjustment_pct=adjustment_pct, proposed_price=proposed, components=comp,
        strategy=strategy_for(sig), day_type=sig.day_type,
    )
