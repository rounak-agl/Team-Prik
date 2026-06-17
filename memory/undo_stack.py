"""Undo stack (LIFO) — rollback of fare actions (STACK tier in the MemoryPlan).

Bounded depth (default 50). Each entry captures the pre-change state so the
Writer can revert the most recent action first. Mirrors the durable
fs_pricing_decisions log so undo survives a restart.
"""
from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class FareAction:
    trip_id: int
    prev_class: str | None
    prev_adjustment_pct: int | None
    new_class: str | None
    new_adjustment_pct: int | None
    ts: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))


class UndoStack:
    def __init__(self, maxlen: int = 50):
        self._dq: deque[FareAction] = deque(maxlen=maxlen)

    def push(self, action: FareAction) -> None:
        self._dq.append(action)

    def pop(self) -> FareAction | None:
        return self._dq.pop() if self._dq else None

    def peek(self) -> FareAction | None:
        return self._dq[-1] if self._dq else None

    def depth(self) -> int:
        return len(self._dq)

    def clear(self) -> None:
        self._dq.clear()
