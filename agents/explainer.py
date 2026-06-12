"""ExplainerAgent — writes a plain-English reason for each changed decision.
Uses Gemini 2.5 Flash in ONE batched call (all changed trips); falls back to a
templated reason if the LLM is unavailable. Off the pricing critical path — the
price is already set, the LLM only narrates it."""
from __future__ import annotations
import json

from .base import Agent
import llm


SYSTEM = ("You are FreshBus's pricing analyst. For each trip, write ONE concise "
          "sentence (<=20 words) explaining the price change to the ops team, in "
          "plain business English. Be concrete about the drivers.")


def _template(ts) -> str:
    d, s = ts.decision, ts.signals
    if "distress" in d.components:
        drv = f"low occupancy {s.occupancy_pct:.0f}% with {s.lead_days}d left — discount to fill"
    else:
        bits = []
        if d.components.get("occupancy"): bits.append(f"{s.occupancy_pct:.0f}% full")
        if d.components.get("lead"):      bits.append(f"{s.lead_days}d to departure")
        if d.components.get("demand"):    bits.append("festival" if s.is_festival else f"demand {s.demand_score}")
        if d.components.get("velocity"):  bits.append("selling fast")
        drv = ", ".join(bits) or "no demand pressure"
    return f"{s.day_type} day, {drv} → {d.surge_pct:+.0f}%, ₹{d.base_fare:.0f}→₹{d.final_price}."


class ExplainerAgent(Agent):
    name = "Explainer"

    def run(self, bb) -> None:
        changed = [ts for ts in bb.targets() if ts.decision and ts.decision.changed]
        if not changed:
            bb.log(self.name, "no changes to explain")
            return

        used_llm = False
        if llm.available():
            payload = [{
                "trip": ts.decision.trip_id, "day_type": ts.signals.day_type,
                "occ": ts.signals.occupancy_pct, "lead_days": ts.signals.lead_days,
                "demand": ts.signals.demand_score, "festival": ts.signals.is_festival,
                "old": ts.decision.old_price, "new": ts.decision.final_price,
                "surge_pct": ts.decision.surge_pct,
            } for ts in changed]
            prompt = ("Return a JSON object mapping each trip id (string) to its "
                      "one-sentence reason. Trips:\n" + json.dumps(payload))
            out = llm.complete(prompt, system=SYSTEM)
            reasons = {}
            if out:
                try:
                    reasons = json.loads(out[out.find("{"): out.rfind("}") + 1])
                    used_llm = True
                except Exception:
                    reasons = {}
            for ts in changed:
                r = reasons.get(str(ts.decision.trip_id))
                ts.decision.reason = r if r else _template(ts)
        else:
            for ts in changed:
                ts.decision.reason = _template(ts)

        bb.log(self.name, f"explained {len(changed)} changes "
                          f"({'Gemini' if used_llm else 'templated fallback'})")
