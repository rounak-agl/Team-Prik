"""ReasonerAgent — the LLM genuinely in the loop (Gemini 2.5 Flash).

For each gated trip it sends the signals + the deterministic baseline + the
condensed policy (reasoner_prompt) to the model, which decides the two levers.
The Validator still clamps every result, so the LLM cannot break bounds.
If the LLM is unavailable or a trip is missing/garbled, the deterministic
baseline from PricingAgent is kept.
"""
from __future__ import annotations
import json

from .base import Agent
from pricing_core import tier_index, move_tier, ADJ_CAP
import llm
from reasoner_prompt import REASONER_PROMPT

BATCH = 40


def _features(ts):
    d, s = ts.decision, ts.signals
    return {
        "trip": d.trip_id, "current_class": d.model_class or "Medium",
        "occupancy_pct": s.occupancy_pct, "lead_days": s.lead_days,
        "demand": s.demand_score, "festival": s.is_festival,
        "pace": s.pace_ratio, "velocity": s.velocity_per_day, "day_type": s.day_type,
        "rule_class": d.new_class, "rule_adjustment_pct": d.adjustment_pct,
    }


class ReasonerAgent(Agent):
    name = "Reasoner"

    def run(self, bb) -> None:
        targets = bb.targets()
        if not targets:
            return
        if not llm.available():
            bb.log(self.name, f"{len(targets)} trips — LLM unavailable, keeping rule baseline")
            return

        by_id = {ts.decision.trip_id: ts for ts in targets}
        items = list(targets)
        judged = 0
        for i in range(0, len(items), BATCH):
            batch = items[i:i + BATCH]
            payload = [_features(ts) for ts in batch]
            out = llm.complete("Trips:\n" + json.dumps(payload),
                               system=REASONER_PROMPT, json_mode=True,
                               max_tokens=40 * len(batch) + 100)
            if not out:
                continue
            try:
                obj = json.loads(out)
                decisions = obj.get("decisions", obj) if isinstance(obj, dict) else obj
            except Exception:
                continue
            for item in (decisions or []):
                try:
                    ts = by_id.get(int(item["trip"]))
                    if not ts:
                        continue
                    d = ts.decision
                    cls = str(item.get("classification") or d.new_class)
                    if tier_index(cls) < 0:
                        cls = d.new_class
                    d.new_class = cls
                    d.tier_step = tier_index(cls) - tier_index(d.model_class) if tier_index(d.model_class) >= 0 else 0
                    d.adjustment_pct = max(0, min(int(item.get("adjustment_pct", d.adjustment_pct)), ADJ_CAP))
                    r = item.get("reason")
                    if r:
                        d.reason = str(r)[:140]
                    d.source = "llm"
                    judged += 1
                except Exception:
                    continue
        bb.log(self.name, f"LLM judged {judged}/{len(targets)} trips (Gemini); Validator will clamp")
