"""Shared cycle state — the blackboard the orchestrator and agents read/write.

Multi-agent design: agents don't call each other; they communicate through this
shared state, and the Orchestrator sequences them. Every agent appends to the
trace so the whole orchestration is visible (the demo centerpiece).
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class TripState:
    trip: dict
    seats: list = field(default_factory=list)
    bookings: list = field(default_factory=list)
    demand: dict | None = None
    rules: dict | None = None
    signals: object | None = None       # signals.Signals
    decision: object | None = None      # pricing_core.Decision
    is_target: bool = False             # Planner gates this on
    priority: float = 0.0
    written: bool = False


@dataclass
class Blackboard:
    trips: dict = field(default_factory=dict)     # trip_id -> TripState
    trace: list = field(default_factory=list)     # orchestration log lines
    started_at: datetime | None = None

    def log(self, agent: str, msg: str) -> None:
        self.trace.append((agent, msg))
        print(f"   ├─ [{agent:<12}] {msg}")

    def targets(self) -> list:
        return [ts for ts in self.trips.values() if ts.is_target]

    def decided(self) -> list:
        return [ts for ts in self.trips.values() if ts.decision is not None]
