"""Orchestrator — the head agent. Owns the cycle, dispatches to specialised
worker agents in order, and aggregates results on the shared blackboard.

Pipeline:  Collect → Plan → Price (propose) → Validate (enforce bounds)
           → Explain → Write

Agents never call each other; the orchestrator sequences them and they
communicate only through the Blackboard. The Validator is the single
deterministic safety chokepoint, so no LLM agent can produce an out-of-bounds
fare.
"""
from __future__ import annotations
from datetime import date, datetime

from blackboard import Blackboard
from agents import (CollectorAgent, PlannerAgent, PricingAgent,
                    ValidatorAgent, ExplainerAgent, WriterAgent)


class Orchestrator:
    def __init__(self, repo, today: date | None = None, apply: bool = True):
        self.repo = repo
        self.today = today or date.today()
        # ordered pipeline of worker agents
        self.pipeline = [
            CollectorAgent(repo, today=self.today),
            PlannerAgent(),
            PricingAgent(),
            ValidatorAgent(),
            ExplainerAgent(),            # before Writer so the reason is logged
            WriterAgent(repo, apply=apply),
        ]

    def run_cycle(self) -> Blackboard:
        bb = Blackboard(started_at=datetime.now())
        print(f"\n┌─ Orchestrator cycle @ {bb.started_at:%H:%M:%S} "
              f"— dispatching {len(self.pipeline)} agents")
        for agent in self.pipeline:
            agent.run(bb)
        print("└─ cycle complete")
        return bb
