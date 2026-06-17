"""Tests for the composite metric layer — bounds + directionality.

    python3 test_metrics.py
"""
from __future__ import annotations
from signals import Signals
from metrics import compute_composites
from metrics.history import history_depth, pace_percentile, build_extras


def _sig(occ, lead, demand, pace, vel=0, total=40):
    booked = round(occ / 100 * total)
    return Signals(1, occ, lead, demand, False, vel, total, booked, total - booked, pace, "pseudo")


def test_all_bounded():
    for occ in (0, 50, 100):
        for lead in (0, 5, 20):
            for dem in (0, 50, 100):
                for pace in (0.4, 1.0, 1.6):
                    c = compute_composites(_sig(occ, lead, dem, pace))
                    for k in ("demand_heat", "competitive_pressure", "urgency",
                              "confidence", "opportunity"):
                        assert 0 <= c[k] <= 100, (k, c[k])
                    assert -100 <= c["price_action"] <= 100


def test_hot_trip_high_heat_positive_action():
    c = compute_composites(_sig(occ=92, lead=5, demand=90, pace=1.4, vel=18))
    assert c["demand_heat"] >= 65
    assert c["price_action"] > 0          # hot + full → push up


def test_distressed_trip_high_urgency_negative_action():
    c = compute_composites(_sig(occ=20, lead=1, demand=40, pace=0.6))
    assert c["urgency"] >= 60              # empty + near departure
    assert c["price_action"] < 0          # low occupancy near departure → down


def test_anomaly_flag():
    bad = _sig(occ=240, lead=2, demand=50, pace=1.0)   # impossible occupancy
    assert compute_composites(bad)["anomaly"] is True
    assert compute_composites(_sig(60, 5, 60, 1.0))["anomaly"] is False


def test_opportunity_scales_with_unsold():
    full = compute_composites(_sig(95, 5, 90, 1.3))      # little unsold
    empty = compute_composites(_sig(30, 5, 90, 1.3))     # lots unsold, still hot demand
    assert empty["opportunity"] >= full["opportunity"]


def test_history_depth_monotonic_and_bounded():
    assert history_depth(0) == 0
    assert history_depth(30) < history_depth(60)
    assert history_depth(1000) == 100        # capped


def test_pace_percentile_directional():
    # at departure (lead 0) curve fraction = 1.0, so expected == final median
    ahead = pace_percentile(current_occ=95, lead_days=0, final_occ_median=80)
    behind = pace_percentile(current_occ=60, lead_days=0, final_occ_median=95)
    on = pace_percentile(current_occ=80, lead_days=0, final_occ_median=80)
    assert ahead > 50 and behind < 50 and on == 50
    assert 0 <= ahead <= 100 and 0 <= behind <= 100


def test_history_extras_override_neutral():
    sig = _sig(occ=90, lead=0, demand=50, pace=1.0)
    base = compute_composites(sig, None)
    # strong history (filled, deep) lifts confidence above the neutral default
    extras = build_extras({"final_occ_median": 95, "journeys": 120}, 90, 0)
    enr = compute_composites(sig, extras)
    assert enr["confidence"] > base["confidence"]


def test_build_extras_empty_when_no_history():
    assert build_extras(None, 50, 5) == {}


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} metric tests passed.")
