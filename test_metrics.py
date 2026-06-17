"""Tests for the composite metric layer — bounds + directionality.

    python3 test_metrics.py
"""
from __future__ import annotations
from signals import Signals
from metrics import compute_composites
from metrics.history import history_depth, pace_percentile, build_extras
from metrics import competitor as comp
from metrics import ltb


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


# ── competitor family ────────────────────────────────────────────────────────
def test_competitor_pair_parsing_and_aliases():
    assert comp.parse_our_pair("Guntur To Visakhapatnam 12:00") == ("guntur", "visakhapatnam")
    assert comp.parse_our_pair("Bangalore to Coimbattore") == ("bangalore", "coimbatore")  # alias
    assert comp.parse_apsrtc_pair("Tirupathi - Bangalore") == frozenset({"tirupati", "bangalore"})
    assert comp.parse_our_pair("not a route") is None


def test_competitor_fare_gap_banded():
    assert comp.fare_gap_score(500, 500) == 50          # parity
    assert comp.fare_gap_score(900, 300) <= 90          # 3x pricier but BANDED (not >>90)
    assert comp.fare_gap_score(300, 900) >= 10          # cheaper -> low pressure, banded
    assert comp.fare_gap_score(0, 500) == 50            # missing -> neutral


def test_competitor_extras_and_unmatched():
    import datetime as _dt
    d = _dt.date(2026, 6, 20)
    idx = comp.build_market_index([("Tirupati - Bangalore", d, 400, 300, 500, 6, 0.5)])
    ex = comp.build_extras(("bangalore", "tirupati"), d, 800, idx)   # unordered match
    assert ex and ex["fare_gap_vs_median"] > 50 and ex["competitor_sellouts"] == 50.0
    assert comp.build_extras(("bangalore", "chennai"), d, 800, idx) == {}   # route not covered


def test_competitor_sellouts_relieve_pressure():
    sig = _sig(occ=70, lead=4, demand=60, pace=1.0)
    pricey = {"fare_gap_vs_median": 80, "price_rank": 90, "competitor_sellouts": 0}
    sold_out = {**pricey, "competitor_sellouts": 100}
    assert (compute_composites(sig, sold_out)["competitive_pressure"]
            < compute_composites(sig, pricey)["competitive_pressure"])


# ── LTB funnel family (capacity-independent: absolute look volume) ───────────
def test_ltb_visit_momentum_monotonic():
    assert ltb.visit_momentum(0) == 0
    assert ltb.visit_momentum(200) < ltb.visit_momentum(2000)   # more looks -> hotter
    assert 0 <= ltb.visit_momentum(50000) <= 100


def test_ltb_high_interest_no_booking_gated_by_lead():
    # near departure, heavy looks, ~no bookings, unsold -> flag
    assert ltb.high_interest_no_booking(looks=2000, books=2, lead_days=1, occupancy_pct=40) is True
    # same interest far out -> NOT flagged (early browsing is normal)
    assert ltb.high_interest_no_booking(looks=2000, books=2, lead_days=12, occupancy_pct=40) is False
    # near departure but already full -> NOT flagged
    assert ltb.high_interest_no_booking(looks=2000, books=2, lead_days=1, occupancy_pct=90) is False
    # too few looks to be meaningful -> NOT flagged
    assert ltb.high_interest_no_booking(looks=50, books=0, lead_days=1, occupancy_pct=40) is False


def test_ltb_build_extras_lifts_heat_and_empty_passthrough():
    sig = _sig(occ=50, lead=5, demand=50, pace=1.0)
    base = compute_composites(sig, None)
    enr = compute_composites(sig, ltb.build_extras(
        {"looks": 5000, "block": 60, "books": 30}, sig.lead_days, sig.occupancy_pct))
    assert enr["demand_heat"] > base["demand_heat"]      # strong visit_momentum lifts heat
    assert ltb.build_extras(None, 5, 50) == {}


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} metric tests passed.")
