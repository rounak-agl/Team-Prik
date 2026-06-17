"""History-derived composite inputs (DURABLE tier).

From each service's past journeys (ClickHouse bus_ticket_data) we get a typical
final occupancy + how many journeys of history we have. From those we derive,
per trip:
  - pace_percentile   — current occupancy vs the service's expected occupancy at
                        this lead (its historical final occ scaled by the curve).
  - history_depth     — confidence proxy: more past journeys = more trust.

These override the neutral defaults in metrics.composites via the `extras` dict.
"""
from __future__ import annotations


def _clamp(x, lo=0.0, hi=100.0):
    return max(lo, min(hi, x))


def _curve_fraction(lead_days: int) -> float:
    """Fraction of final occupancy typically reached by this lead time."""
    if lead_days >= 15: return 0.25
    if lead_days >= 7:  return 0.50
    if lead_days >= 3:  return 0.72
    if lead_days >= 1:  return 0.88
    return 1.0


def history_depth(journeys: int) -> float:
    """0..100 — ~60 past journeys → full confidence."""
    return _clamp(journeys / 0.6)


def pace_percentile(current_occ: float, lead_days: int, final_occ_median: float) -> float:
    """Where current occupancy sits vs the service's expected occupancy at this
    lead. >50 = ahead of pace, <50 = behind."""
    expected = final_occ_median * _curve_fraction(lead_days)
    return _clamp(50.0 + (current_occ - expected) * 1.5)


def trip_extras(current_occ: float, lead_days: int, sig_signals) -> dict:
    """Stub kept for symmetry; real values come from build_extras below."""
    return {}


def build_extras(hist: dict | None, occ: float, lead: int) -> dict:
    """hist = {'final_occ_median': .., 'journeys': ..} for this service, or None."""
    if not hist:
        return {}
    return {
        "history_depth": history_depth(hist.get("journeys", 0)),
        "pace_percentile": pace_percentile(occ, lead, hist.get("final_occ_median", 50)),
    }
