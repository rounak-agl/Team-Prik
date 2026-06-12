"""Base agent contract. Agents read/write the shared Blackboard; the
Orchestrator sequences them. No agent calls another directly."""
from __future__ import annotations


class Agent:
    name: str = "agent"

    def run(self, bb) -> None:        # mutate the blackboard, log to bb.trace
        raise NotImplementedError
