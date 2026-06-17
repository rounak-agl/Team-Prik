"""Composite metrics + guardrail flags — the ONLY metrics that reach the LLM
(per the Excel: 6 CMP composites + GRD-07/08/09 + LTB-08).

Each composite is a weighted rollup of underlying inputs. Inputs we can compute
from live signals are derived here; inputs from not-yet-wired families
(competitor, LTB, SRP, elasticity, history percentiles) default to NEUTRAL (50),
so the same formulas get richer as those families come online.
"""
from __future__ import annotations
from .weights import WEIGHTS

NEUTRAL = 50.0


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def _wsum(weights: dict, inputs: dict) -> float:
    return sum(w * inputs.get(k, NEUTRAL) for k, w in weights.items())


# ── input derivations (LIVE / DERIVED tiers) ─────────────────────────────────
def _pace_percentile(pace_ratio: float) -> float:
    # pace 0.5→0, 1.0→50, 1.5→100
    return _clamp((pace_ratio - 0.5) * 100.0)


def _velocity_percentile(velocity: float, seats_total: int) -> float:
    if not seats_total:
        return 0.0
    return _clamp((velocity / seats_total) * 250.0)   # frac sold/24h, scaled


def _lead_pressure(lead_days: int) -> float:
    if lead_days <= 0:  return 100.0
    if lead_days <= 1:  return 90.0
    if lead_days <= 3:  return 70.0
    if lead_days <= 7:  return 45.0
    if lead_days <= 15: return 25.0
    return 10.0


def _empty_risk(occ: float, lead_days: int) -> float:
    # low occupancy close to departure → high risk of an empty bus
    if lead_days <= 1:  return _clamp(100.0 - occ)
    if lead_days <= 3:  return _clamp(85.0 - occ)
    if lead_days <= 7:  return _clamp((65.0 - occ) * 0.7)
    return _clamp((45.0 - occ) * 0.4)


def _runrate_pressure(occ: float, lead_days: int, target: float = 80.0) -> float:
    need = max(0.0, target - occ)               # points still to fill
    urgency = _lead_pressure(lead_days) / 100.0
    return _clamp(need * urgency)


def _signal_agreement(occ: float, pace: float, demand: float) -> float:
    def sign(hi, lo, v): return 1 if v >= hi else -1 if v <= lo else 0
    signs = [sign(60, 40, occ), sign(1.1, 0.9, pace), sign(65, 45, demand)]
    nonzero = [s for s in signs if s != 0]
    if not nonzero:
        return NEUTRAL
    agree = max(nonzero.count(1), nonzero.count(-1))
    return _clamp(agree / len(nonzero) * 100.0)


def derive_inputs(sig, extras: dict | None = None) -> dict:
    """Compute composite inputs from live signals; neutral-default the rest.
    `extras` lets later phases inject competitor/LTB/SRP/history values."""
    e = extras or {}
    occ, lead, demand = sig.occupancy_pct, sig.lead_days, sig.demand_score
    inputs = {
        # demand heat
        "pace_percentile": _pace_percentile(sig.pace_ratio),
        "velocity_percentile": _velocity_percentile(sig.velocity_per_day, sig.seats_total),
        "visit_momentum": NEUTRAL,            # LTB family (not wired) → neutral
        "demand_score": float(demand),
        # competitive pressure (competitor family → neutral until wired)
        "fare_gap_vs_median": NEUTRAL,
        "price_rank": NEUTRAL,
        "competitor_sellouts": 0.0,
        "share_trend": NEUTRAL,
        # urgency
        "lead_pressure": _lead_pressure(lead),
        "runrate_pressure": _runrate_pressure(occ, lead),
        "empty_risk": _empty_risk(occ, lead),
        # confidence
        "data_freshness": float(e.get("data_freshness", 100.0)),
        "signal_agreement": _signal_agreement(occ, sig.pace_ratio, demand),
        "history_depth": NEUTRAL,             # DURABLE percentiles (not wired) → neutral
        # pricing state (LIVE): discount already offered on unsold seats (DSC-01)
        "discount_depth": float(e.get("discount_depth", 0.0)),
        # price sensitivity (DURABLE store, ELA): 0..100, high = elastic
        "elasticity": float(e.get("elasticity", NEUTRAL)),
        # opportunity
        "unsold_fraction": (sig.seats_unsold / sig.seats_total) if sig.seats_total else 0.0,
    }
    inputs.update(e)                          # explicit extras override defaults
    return inputs


# ── composites + flags (the LLM-context layer) ───────────────────────────────
def compute(sig, extras: dict | None = None, staleness: float = 0.0) -> dict:
    e = extras or {}
    ip = derive_inputs(sig, e)

    heat = _clamp(_wsum(WEIGHTS["demand_heat"], ip))
    pressure = _clamp(_wsum(WEIGHTS["competitive_pressure"], ip))
    urgency = _clamp(_wsum(WEIGHTS["urgency"], ip))
    confidence = _clamp(_wsum(WEIGHTS["confidence"], ip))

    # Price action: heat lifts, competitive pressure damps, urgency pushes in the
    # direction occupancy implies (full bus near departure → up; empty → down).
    w = WEIGHTS["price_action"]
    direction = 1.0 if sig.occupancy_pct >= 60 else -1.0
    # urgency only AMPLIFIES (in the occupancy-implied direction) when elevated;
    # low urgency is neutral, never a drag.
    price_action = (w["heat"] * (heat - 50)
                    + w["pressure"] * (pressure - 50)
                    + direction * w["urgency"] * max(0.0, urgency - 50))
    # DSC-01: the down-lever is already partly pulled — damp further cuts (not raises)
    # up to 60% when fully discounted, so we don't pile discount onto discount.
    dd = ip.get("discount_depth", 0.0)
    if price_action < 0 and dd > 0:
        price_action *= max(0.0, 1.0 - (dd / 100.0) * 0.6)
    # ELA: elastic demand → cuts are effective / raises lose volume; inelastic →
    # raises are safe / cuts waste margin. Modulate magnitude by ±30%.
    el = ip.get("elasticity", 50.0)
    if price_action > 0:          # raising
        price_action *= max(0.0, 1.0 + (50.0 - el) / 100.0 * 0.3)
    elif price_action < 0:        # cutting
        price_action *= max(0.0, 1.0 + (el - 50.0) / 100.0 * 0.3)
    price_action = _clamp(price_action, -100.0, 100.0)

    opportunity = _clamp(heat * ip["unsold_fraction"])

    # guardrail flags
    anomaly = not (0 <= sig.occupancy_pct <= 100 and 0 <= sig.demand_score <= 100
                   and sig.pace_ratio >= 0)
    disagreement = _clamp(100.0 - ip["signal_agreement"])
    high_interest_no_booking = bool(e.get("high_interest_no_booking", False))

    return {
        "demand_heat": round(heat, 1),                 # CMP-01
        "competitive_pressure": round(pressure, 1),     # CMP-02
        "urgency": round(urgency, 1),                   # CMP-03
        "price_action": round(price_action, 1),         # CMP-04
        "confidence": round(confidence, 1),             # CMP-05
        "opportunity": round(opportunity, 1),           # CMP-06 (ranked across fleet)
        "staleness": round(_clamp(staleness), 1),       # GRD-07
        "signal_disagreement": round(disagreement, 1),  # GRD-08
        "anomaly": anomaly,                             # GRD-09
        "high_interest_no_booking": high_interest_no_booking,  # LTB-08
        "discount_depth": round(ip.get("discount_depth", 0.0), 1),  # DSC-01 (pricing state)
        "elasticity": round(ip.get("elasticity", NEUTRAL), 1),       # ELA (price sensitivity)
    }
