"""WriterAgent — records validated decisions and (only if explicitly enabled)
applies the TWO levers on the staging admin API.

SAFETY: default is LOG-ONLY. Fares/classification are applied ONLY when
apply_fares=True AND an admin client is provided. Decisions always log to
ClickHouse fs_pricing_decisions (live) or the seed price_history (local).
"""
from __future__ import annotations
from .base import Agent
from memory import FareAction


class WriterAgent(Agent):
    name = "Writer"

    def __init__(self, repo, ch_store=None, admin=None, apply_fares: bool = False,
                 apply_only=None, mem=None):
        self.repo = repo
        self.ch_store = ch_store
        self.admin = admin                  # AdminClient (staging) or None
        self.apply_fares = apply_fares
        self.apply_only = apply_only        # set of trip_ids to apply, or None = all
        self.mem = mem                      # MemoryManager: undo STACK

    def run(self, bb) -> None:
        applied = logged = 0
        for ts in bb.targets():
            d = ts.decision
            if not d.changed:
                continue
            allowed = self.apply_only is None or d.trip_id in self.apply_only
            # STACK tier: record the reversible action (pre-state) before applying
            if self.mem is not None:
                self.mem.record_action(FareAction(
                    trip_id=d.trip_id, prev_class=d.model_class,
                    prev_adjustment_pct=0, new_class=d.new_class,
                    new_adjustment_pct=d.adjustment_pct))
            # 1) apply BOTH levers on staging — only if explicitly enabled + allowed
            if self.apply_fares and self.admin is not None and allowed:
                try:
                    if d.tier_step != 0:
                        self.admin.set_classification(d.trip_id, d.new_class)
                    self.admin.set_fare_adjustment(d.trip_id, d.adjustment_pct)
                    ts.written = True
                    applied += 1
                except Exception as e:
                    bb.log(self.name, f"apply failed trip {d.trip_id}: {e}")
            # 2) always log the decision
            if self.ch_store is not None:
                try:
                    self.ch_store.log_decision(d); logged += 1
                except Exception as e:
                    bb.log(self.name, f"CH log failed trip {d.trip_id}: {e}")
            else:
                try:
                    self.repo.log_price_change(d.trip_id, d.old_price, d.final_price, d.reason or "")
                    logged += 1
                except Exception:
                    pass
        mode = "APPLIED on staging" if (self.apply_fares and self.admin) else "LOG-ONLY (no apply)"
        bb.log(self.name, f"{mode}: {logged} logged, {applied} applied (class+adj)")
