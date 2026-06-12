"""Pricing math — the PricingAgent *proposes* a price here; the ValidatorAgent
*enforces* bounds separately. Separating propose/enforce is what makes the
multi-agent split meaningful and keeps a single deterministic safety chokepoint.

Reproduces the brief's worked example (₹650, 85% occ, 4d, demand 72 → ₹880).
"""
from __future__ import annotations
from dataclasses import dataclass, field

from signals import Signals

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
    proposed: float = 0.0          # PricingAgent's raw proposal (pre-validation)
    final_price: float = 0.0       # ValidatorAgent's enforced price
    surge_pct: float = 0.0
    components: dict = field(default_factory=dict)
    strategy: str = "balanced"
    capped: bool = False
    reason: str = ""
    changed: bool = False


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
    """Operational day-type → strategy (per the ops policy).
    absolute = hold (balanced additive, no extra surge); low = lean discount;
    pseudo = balanced but reacts to pace per-service."""
    if sig.day_type == "low":
        return "conservative"
    if sig.day_type == "pseudo":
        return "aggressive" if sig.pace_ratio >= 1.15 else "conservative" if sig.pace_ratio <= 0.85 else "balanced"
    return "balanced"   # absolute demand day: hold via additive premiums


def _round10(x): return int(round(x/10.0)*10)


def propose(sig: Signals, base_fare: float, current_price: float) -> Decision:
    """Compute a raw proposed price (NOT yet clamped to price_rules)."""
    strat = strategy_for(sig)
    factor = STRATEGY_FACTOR[strat]

    occ, lead = _occ_premium(sig.occupancy_pct), _lead_premium(sig.lead_days)
    dem, vel = _demand_premium(sig.demand_score, sig.is_festival), _velocity_premium(sig.velocity_per_day, sig.seats_total)
    distress = _distress(sig.occupancy_pct, sig.lead_days)

    if distress < 0:
        net = distress
        comp = {"distress": distress}
    else:
        premium = (occ + lead + vel + max(dem, 0.0)) * factor
        net = premium + min(dem, 0.0)
        comp = {"occupancy": occ, "lead": lead, "demand": dem, "velocity": vel}

    proposed = _round10(base_fare * (1.0 + net))
    d = Decision(trip_id=sig.trip_id, base_fare=base_fare, old_price=current_price,
                 proposed=proposed, components=comp, strategy=strat)
    return d
