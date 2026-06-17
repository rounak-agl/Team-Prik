"""Offline backtest simulator + bounded revenue optimizer.

Replays historical journeys (ClickHouse bus_ticket_data) and estimates the
revenue the agent's pricing would have produced vs the baseline, under a
constant-elasticity demand model. For each journey, at a decision lead L:

  * baseline sold ~cf(L) of final demand at the realized fare F0;
  * the agent reprices the REMAINING inventory by its net % move (adjustment %
    + a per-tier-step increment);
  * remaining bookings respond on a LINEAR demand curve anchored at (F0, demand)
    with local slope ε (the service's elasticity feature), capped at remaining
    capacity. Linear demand has a finite interior revenue optimum, so even
    inelastic demand yields a sensible bounded raise (not "raise forever").

Three numbers per run: baseline revenue, AGENT (heuristic) revenue, and a bounded
OPTIMIZER ceiling (best ±20% move under the same model). The gap baseline→agent
is the simulated lift; agent→optimizer is the headroom the heuristic leaves.

IMPORTANT: this is a SIMULATION under a demand-model assumption (constant
elasticity), not a guarantee — it shows directional lift and where the levers
help, pending a live A/B. Run: `python3 backtest.py [N] [lead_days]`.
"""
from __future__ import annotations
import os
from datetime import datetime

from signals import Signals, classify_day
from pricing_core import propose
from metrics.history import _curve_fraction

REPORT = os.path.join(os.path.dirname(__file__), "..", "docs", "BACKTEST.md")
TIER_PCT = 5.0          # assumed EPK price increment per classification step
DECISION_LEAD = 3       # days before departure the agent acts
OPT_LO, OPT_HI = 0.70, 1.30   # optimizer search = the agent's full lever range (±20% + 1 tier)


def _elasticity_eps(score: float) -> float:
    """elasticity 0..100 (high=sensitive) → constant-elasticity exponent ε.
    50→1.0 (unit), 0→0.4 (inelastic), 100→1.6 (elastic)."""
    return 0.4 + (score / 100.0) * 1.2


def _agent_multiplier(sig: Signals, fare: float) -> tuple[float, str]:
    d = propose(sig, base_fare=fare, current_price=fare, model_class="Medium")
    mult = (1.0 + d.adjustment_pct / 100.0) * (1.0 + d.tier_step * TIER_PCT / 100.0)
    act = "raise" if mult > 1.001 else "cut" if mult < 0.999 else "hold"
    return mult, act


def _revenue(mult: float, F0: float, B0: float, cap: float, eps: float, cf: float) -> float:
    """Revenue when the REMAINING inventory at lead L is repriced by `mult`, under
    a LINEAR demand curve q = D·(1 − ε·(mult−1)) anchored at the realized point."""
    sold_by_L = B0 * cf
    remaining_demand = max(0.0, B0 - sold_by_L)
    remaining_cap = max(0.0, cap - sold_by_L)
    q = remaining_demand * max(0.0, 1.0 - eps * (mult - 1.0))
    q = max(0.0, min(q, remaining_cap))
    return sold_by_L * F0 + q * (F0 * mult)


def _optimal_multiplier(F0, B0, cap, eps, cf):
    best_m, best_r = 1.0, _revenue(1.0, F0, B0, cap, eps, cf)
    m = OPT_LO
    while m <= OPT_HI + 1e-9:
        r = _revenue(m, F0, B0, cap, eps, cf)
        if r > best_r:
            best_r, best_m = r, m
        m += 0.02
    return best_m, best_r


def run(n: int = 500, lead: int = DECISION_LEAD) -> dict:
    from repository import get_ch_store
    ch = get_ch_store()
    if ch is None:
        raise SystemExit("backtest needs ClickHouse (live data)")

    rows = ch.query(
        f"""SELECT Service_Number, Journey_Date, max(total_seats) AS cap,
                   countIf(Ticket_Status='A') AS bookings,
                   avgIf(Seat_fare, Ticket_Status='A') AS fare
            FROM freshbus_operations.bus_ticket_data
            WHERE Journey_Date >= today() - 150 AND Journey_Date < today()
            GROUP BY Service_Number, Journey_Date
            HAVING cap > 0 AND bookings > 0 AND fare > 0
            ORDER BY rand() LIMIT {int(n)}""")
    feats = ch.service_features([r[0] for r in rows])
    cf = _curve_fraction(lead)

    R0 = Ra = Ro = 0.0
    acts = {"raise": 0, "cut": 0, "hold": 0}
    used = 0
    for sn, jd, cap, bookings, fare in rows:
        cap, B0, F0 = float(cap), float(bookings), float(fare)
        if cap <= 0 or B0 <= 0 or F0 <= 0:
            continue
        final_occ = min(100.0, B0 / cap * 100.0)
        occ_L = final_occ * cf
        booked_L = round(cap * occ_L / 100.0)
        score = feats.get(sn, {}).get("final_occ_median", 50)
        eps = _elasticity_eps(feats.get(sn, {}).get("elasticity", 50.0))
        sig = Signals(trip_id=0, occupancy_pct=round(occ_L, 1), lead_days=lead,
                      demand_score=int(score), is_festival=False, velocity_per_day=0.0,
                      seats_total=int(cap), seats_booked=booked_L,
                      seats_unsold=int(cap) - booked_L, pace_ratio=1.0,
                      day_type=classify_day(int(score), False))
        mult, act = _agent_multiplier(sig, F0)
        acts[act] += 1
        _, ro = _optimal_multiplier(F0, B0, cap, eps, cf)
        R0 += _revenue(1.0, F0, B0, cap, eps, cf)
        Ra += _revenue(mult, F0, B0, cap, eps, cf)
        Ro += ro
        used += 1

    agent_lift = (Ra / R0 - 1.0) * 100.0 if R0 else 0.0
    opt_lift = (Ro / R0 - 1.0) * 100.0 if R0 else 0.0
    return {"journeys": used, "lead": lead, "baseline": R0, "agent": Ra,
            "optimizer": Ro, "agent_lift_pct": agent_lift, "opt_lift_pct": opt_lift,
            "actions": acts}


def _write_report(res: dict, stamp: str) -> None:
    a = res["actions"]
    try:
        with open(REPORT, "w", encoding="utf-8") as f:
            f.write(f"""# Backtest — simulated revenue lift

_Run {stamp} · {res['journeys']} historical journeys · decision lead {res['lead']}d_

| scenario | revenue (₹, simulated) | lift vs baseline |
|--|--|--|
| Baseline (realized fare) | {res['baseline']:,.0f} | — |
| **Agent (heuristic levers)** | {res['agent']:,.0f} | **{res['agent_lift_pct']:+.2f}%** |
| Optimizer (bounded ceiling) | {res['optimizer']:,.0f} | {res['opt_lift_pct']:+.2f}% |

Agent actions: raise {a['raise']} · cut {a['cut']} · hold {a['hold']}.

**Model & caveats:** LINEAR demand q = D·(1 − ε·(m−1)), ε from each service's
`fs_service_features` elasticity; only the inventory unsold by lead {res['lead']}d
(≈{(1-_curve_fraction(res['lead']))*100:.0f}% of demand) is repriced; tier steps modelled as ±{TIER_PCT:.0f}% EPK; lever range
{OPT_LO:.2f}–{OPT_HI:.2f}×. This is a SIMULATION, not a guarantee — the demand model is an
assumption; a live A/B is the real proof. The optimizer row is the model's
revenue-max within the lever range; the agent→optimizer gap is heuristic headroom
(the LLM Reasoner refines the heuristic toward it).
""")
    except Exception as e:
        print(f"[backtest] report write skipped: {e}")


def main_n(n: int = 500, lead: int = DECISION_LEAD):
    res = run(n, lead)
    print("\n── BACKTEST (simulated) ──")
    print(f"  journeys: {res['journeys']}  | decision lead: {res['lead']}d")
    print(f"  baseline  revenue: ₹{res['baseline']:,.0f}")
    print(f"  AGENT     revenue: ₹{res['agent']:,.0f}  ({res['agent_lift_pct']:+.2f}%)")
    print(f"  optimizer ceiling: ₹{res['optimizer']:,.0f}  ({res['opt_lift_pct']:+.2f}%)")
    print(f"  actions: {res['actions']}")
    _write_report(res, f"{datetime.now():%Y-%m-%d %H:%M}")
    print(f"  report → {REPORT}")
    return res


if __name__ == "__main__":
    import sys
    _n = int(sys.argv[1]) if len(sys.argv) > 1 else 500
    _lead = int(sys.argv[2]) if len(sys.argv) > 2 else DECISION_LEAD
    main_n(_n, _lead)
