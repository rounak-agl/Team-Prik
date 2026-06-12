"""ExplainerAgent — rewrites each changed decision's reason in plain English via
Gemini 2.5 Flash (ONE batched call). If the LLM is unavailable it keeps the
Validator's deterministic reason. Off the pricing critical path — it only
narrates the already-decided classification + adjustment."""
from __future__ import annotations
import json

from .base import Agent
import llm

SYSTEM = ("You are FreshBus's pricing analyst. For each trip, write ONE concise "
          "sentence (<=22 words) for the ops team explaining the classification "
          "change and fare adjustment, citing the demand drivers. Plain business English.")


class ExplainerAgent(Agent):
    name = "Explainer"

    def run(self, bb) -> None:
        changed = [ts for ts in bb.targets() if ts.decision and ts.decision.changed]
        if not changed:
            bb.log(self.name, "no changes to explain")
            return

        if not llm.available():
            bb.log(self.name, f"{len(changed)} changes (kept rule-based reasons; no LLM)")
            return

        payload = [{
            "trip": ts.decision.trip_id, "day_type": ts.signals.day_type,
            "occ": ts.signals.occupancy_pct, "lead_days": ts.signals.lead_days,
            "demand": ts.signals.demand_score, "festival": ts.signals.is_festival,
            "class_from": ts.decision.model_class, "class_to": ts.decision.new_class,
            "adjustment_pct": ts.decision.adjustment_pct,
        } for ts in changed]
        prompt = ("Return a JSON object mapping each trip id (string) to its "
                  "one-sentence reason. Trips:\n" + json.dumps(payload))
        out = llm.complete(prompt, system=SYSTEM)
        used = False
        if out:
            try:
                reasons = json.loads(out[out.find("{"): out.rfind("}") + 1])
                for ts in changed:
                    r = reasons.get(str(ts.decision.trip_id))
                    if r:
                        ts.decision.reason = r
                used = True
            except Exception:
                pass
        bb.log(self.name, f"explained {len(changed)} changes "
                          f"({'Gemini' if used else 'kept rule reasons — LLM parse failed'})")
