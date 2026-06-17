"""Tests for the backtest simulator's pure demand/revenue math (no DB).

    python3 test_backtest.py
"""
from __future__ import annotations
from backtest import _revenue, _optimal_multiplier, _elasticity_eps, OPT_LO, OPT_HI

# a half-sold journey at lead 3: cap 40, final bookings 36, fare 600, cf≈0.72
CAP, B0, F0, CF = 40.0, 36.0, 600.0, 0.72


def test_elasticity_mapping_bounds():
    assert _elasticity_eps(0) < _elasticity_eps(50) < _elasticity_eps(100)
    assert abs(_elasticity_eps(50) - 1.0) < 1e-9          # neutral = unit elastic


def test_optimizer_never_below_baseline():
    for score in (0, 30, 50, 80, 100):
        eps = _elasticity_eps(score)
        base = _revenue(1.0, F0, B0, CAP, eps, CF)
        _, best = _optimal_multiplier(F0, B0, CAP, eps, CF)
        assert best >= base - 1e-6                         # optimum can't lose vs hold


def test_inelastic_raises_elastic_cuts():
    m_inel, _ = _optimal_multiplier(F0, B0, CAP, _elasticity_eps(10), CF)   # inelastic
    m_elas, _ = _optimal_multiplier(F0, B0, CAP, _elasticity_eps(95), CF)   # elastic
    assert m_inel > 1.0 and m_elas < 1.0
    assert OPT_LO - 1e-6 <= m_inel <= OPT_HI + 1e-6
    assert OPT_LO - 1e-6 <= m_elas <= OPT_HI + 1e-6


def test_linear_demand_has_interior_optimum():
    # unit-elastic demand → revenue-max multiplier is ~1.0 (no change), not the bound
    m, _ = _optimal_multiplier(F0, B0, CAP, _elasticity_eps(50), CF)
    assert abs(m - 1.0) <= 0.06


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for fn in fns:
        fn(); print(f"PASS {fn.__name__}")
    print(f"\nAll {len(fns)} backtest tests passed.")
