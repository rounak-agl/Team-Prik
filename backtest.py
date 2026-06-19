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
REPORT_LLM = os.path.join(os.path.dirname(__file__), "..", "docs", "BACKTEST_LLM.md")
TIER_PCT = 5.0          # assumed EPK price increment per classification step
DECISION_LEAD = 3       # days before departure the agent acts
OPT_LO, OPT_HI = 0.70, 1.30   # optimizer search = the agent's full lever range (±20% + 1 tier)


def _elasticity_eps(score: float) -> float:
    """elasticity 0..100 (high=sensitive) → constant-elasticity exponent ε.
    50→1.0 (unit), 0→0.4 (inelastic), 100→1.6 (elastic)."""
    return 0.4 + (score / 100.0) * 1.2


def _mult_from(adjustment_pct: int, tier_step: int) -> float:
    return (1.0 + adjustment_pct / 100.0) * (1.0 + tier_step * TIER_PCT / 100.0)


def _agent_multiplier(sig: Signals, fare: float) -> tuple[float, str]:
    d = propose(sig, base_fare=fare, current_price=fare, model_class="Medium")
    mult = _mult_from(d.adjustment_pct, d.tier_step)
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
            ORDER BY cityHash64(Service_Number, toString(Journey_Date)) LIMIT {int(n)}""")
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


def _build_state(rows, feats, cf, lead):
    """Reconstruct per-journey (signals, composites, rule decision) — the same
    inputs a live cycle feeds the Reasoner. Returns list of dicts."""
    import json
    from metrics import compute_composites
    from metrics.history import build_extras as hist_extras
    out = []
    for i, (sn, jd, cap, bookings, fare) in enumerate(rows):
        cap, B0, F0 = float(cap), float(bookings), float(fare)
        if cap <= 0 or B0 <= 0 or F0 <= 0:
            continue
        final_occ = min(100.0, B0 / cap * 100.0)
        occ_L = final_occ * cf
        booked_L = round(cap * occ_L / 100.0)
        h = feats.get(sn)
        score = (h or {}).get("final_occ_median", 50)
        sig = Signals(trip_id=i, occupancy_pct=round(occ_L, 1), lead_days=lead,
                      demand_score=int(score), is_festival=False, velocity_per_day=0.0,
                      seats_total=int(cap), seats_booked=booked_L,
                      seats_unsold=int(cap) - booked_L, pace_ratio=1.0,
                      day_type=classify_day(int(score), False))
        extras = hist_extras(h, occ_L, lead)
        comp = compute_composites(sig, extras)
        rule = propose(sig, base_fare=F0, current_price=F0, model_class="Medium")
        out.append({"i": i, "sn": sn, "cap": cap, "B0": B0, "F0": F0,
                    "eps": _elasticity_eps((h or {}).get("elasticity", 50.0)),
                    "sig": sig, "comp": comp, "rule": rule})
    return out


def _llm_decisions(states):
    """Route the reconstructed states through Gemini (the real Reasoner prompt) and
    return {i: (adjustment_pct, tier_step)}. Falls back to {} if LLM unavailable."""
    import json
    import llm
    from reasoner_prompt import REASONER_PROMPT
    from pricing_core import tier_index, ADJ_CAP
    if not llm.available():
        return {}
    MED = tier_index("Medium")
    payload = []
    for s in states:
        sig, comp, rule = s["sig"], s["comp"], s["rule"]
        payload.append({"trip": s["i"], "current_class": "Medium",
                        "occupancy_pct": sig.occupancy_pct, "lead_days": sig.lead_days,
                        "demand": sig.demand_score, "festival": sig.is_festival,
                        "pace": sig.pace_ratio, "day_type": sig.day_type,
                        "rule_class": rule.new_class, "rule_adjustment_pct": rule.adjustment_pct,
                        "scores": comp})
    out = {}
    for k in range(0, len(payload), 40):
        batch = payload[k:k + 40]
        resp = llm.complete("Trips:\n" + json.dumps(batch), system=REASONER_PROMPT,
                            json_mode=True, max_tokens=90 * len(batch) + 300)
        if not resp:
            continue
        try:
            obj = json.loads(resp)
            decs = obj.get("decisions", obj) if isinstance(obj, dict) else obj
        except Exception:
            continue
        for item in (decs or []):
            try:
                i = int(item["trip"])
                cls = str(item.get("classification") or "Medium")
                ci = tier_index(cls)
                step = 0 if ci < 0 else max(-1, min(1, ci - MED))
                adj = max(-ADJ_CAP, min(int(item.get("adjustment_pct", 0)), ADJ_CAP))
                out[i] = (adj, step)
            except Exception:
                continue
    return out


def run_llm(n: int = 100, lead: int = DECISION_LEAD) -> dict:
    """LIVE TEST: rules vs LLM vs optimizer on real historical journeys (no apply)."""
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
            ORDER BY cityHash64(Service_Number, toString(Journey_Date)) LIMIT {int(n)}""")
    feats = ch.service_features([r[0] for r in rows])
    cf = _curve_fraction(lead)
    states = _build_state(rows, feats, cf, lead)
    llm_decs = _llm_decisions(states)

    R0 = Rr = Rl = Ro = 0.0
    acts = {"raise": 0, "cut": 0, "hold": 0}
    llm_used = 0
    for s in states:
        F0, B0, cap, eps = s["F0"], s["B0"], s["cap"], s["eps"]
        rule_mult = _mult_from(s["rule"].adjustment_pct, s["rule"].tier_step)
        if s["i"] in llm_decs:
            adj, step = llm_decs[s["i"]]
            llm_mult = _mult_from(adj, step)
            llm_used += 1
        else:
            llm_mult = rule_mult
        acts["raise" if llm_mult > 1.001 else "cut" if llm_mult < 0.999 else "hold"] += 1
        _, ro = _optimal_multiplier(F0, B0, cap, eps, cf)
        R0 += _revenue(1.0, F0, B0, cap, eps, cf)
        Rr += _revenue(rule_mult, F0, B0, cap, eps, cf)
        Rl += _revenue(llm_mult, F0, B0, cap, eps, cf)
        Ro += ro
    return {"journeys": len(states), "lead": lead, "llm_used": llm_used,
            "baseline": R0, "rule": Rr, "llm": Rl, "optimizer": Ro,
            "rule_lift_pct": (Rr / R0 - 1) * 100 if R0 else 0,
            "llm_lift_pct": (Rl / R0 - 1) * 100 if R0 else 0,
            "opt_lift_pct": (Ro / R0 - 1) * 100 if R0 else 0,
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


def _write_llm_report(res: dict, stamp: str) -> None:
    a = res["actions"]
    try:
        with open(REPORT_LLM, "w", encoding="utf-8") as f:
            f.write(f"""# Live test — rules vs LLM vs optimizer

_Run {stamp} · {res['journeys']} real historical journeys · decision lead {res['lead']}d · LLM decided {res['llm_used']}_

| pricer | revenue (₹, simulated) | lift vs baseline |
|--|--|--|
| Baseline (realized fare) | {res['baseline']:,.0f} | — |
| Rule baseline (`propose`) | {res['rule']:,.0f} | {res['rule_lift_pct']:+.2f}% |
| **Agent + LLM (Gemini)** | {res['llm']:,.0f} | **{res['llm_lift_pct']:+.2f}%** |
| Optimizer ceiling | {res['optimizer']:,.0f} | {res['opt_lift_pct']:+.2f}% |

LLM actions: raise {a['raise']} · cut {a['cut']} · hold {a['hold']}.

**Read:** rule→LLM gap is the LLM's MARGINAL contribution; LLM→optimizer gap is
remaining headroom. Same demand model + caveats as `BACKTEST.md` — a SIMULATION
on live data (no production apply), not a guarantee. The LLM and rules are scored
on identical journeys, composites, and demand model, so the delta is apples-to-apples.
""")
    except Exception as e:
        print(f"[backtest] LLM report write skipped: {e}")


def main_llm(n: int = 100, lead: int = DECISION_LEAD):
    res = run_llm(n, lead)
    print("\n── LIVE TEST: rules vs LLM (simulated revenue) ──")
    print(f"  journeys: {res['journeys']}  | LLM decided: {res['llm_used']}  | lead: {res['lead']}d")
    print(f"  baseline       : ₹{res['baseline']:,.0f}")
    print(f"  rule baseline  : ₹{res['rule']:,.0f}  ({res['rule_lift_pct']:+.2f}%)")
    print(f"  AGENT + LLM    : ₹{res['llm']:,.0f}  ({res['llm_lift_pct']:+.2f}%)")
    print(f"  optimizer ceil : ₹{res['optimizer']:,.0f}  ({res['opt_lift_pct']:+.2f}%)")
    print(f"  LLM actions    : {res['actions']}")
    marg = res['llm_lift_pct'] - res['rule_lift_pct']
    print(f"  >> LLM marginal vs rules: {marg:+.2f} pts")
    _write_llm_report(res, f"{datetime.now():%Y-%m-%d %H:%M}")
    print(f"  report → {REPORT_LLM}")
    return res


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
    args = [a for a in sys.argv[1:] if a != "--llm"]
    _n = int(args[0]) if len(args) > 0 else (100 if "--llm" in sys.argv else 500)
    _lead = int(args[1]) if len(args) > 1 else DECISION_LEAD
    (main_llm if "--llm" in sys.argv else main_n)(_n, _lead)
