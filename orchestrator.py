"""Orchestrator — the head agent. Owns the cycle, dispatches to specialised
worker agents in order, and aggregates results on the shared blackboard.

Pipeline:  Collect → Plan → Price (rule baseline) → Reason (LLM judgment)
           → Validate (clamp/enforce bounds) → Write

Agents never call each other; the orchestrator sequences them and they
communicate only through the Blackboard. The LLM (Reasoner) makes the judgment
call; the Validator is the single deterministic safety chokepoint AFTER it, so
no LLM decision can produce an out-of-bounds fare.
"""
from __future__ import annotations
from datetime import date, datetime

from blackboard import Blackboard
from agents import (CollectorAgent, PlannerAgent, PricingAgent, ReasonerAgent,
                    ValidatorAgent, WriterAgent)


class Orchestrator:
    def __init__(self, repo, today: date | None = None, apply_fares: bool = False,
                 ch_store=None, admin=None, apply_only=None, mem=None):
        self.repo = repo
        self.today = today or date.today()
        self.mem = mem
        # ordered pipeline of worker agents
        self.pipeline = [
            CollectorAgent(repo, today=self.today, ch_store=ch_store, mem=mem),
            PlannerAgent(),
            PricingAgent(),              # deterministic baseline (fallback)
            ReasonerAgent(),             # LLM judgment (Gemini) — the agentic step
            ValidatorAgent(),            # clamps both levers — safety chokepoint
            WriterAgent(repo, ch_store=ch_store, admin=admin,
                        apply_fares=apply_fares, apply_only=apply_only, mem=mem),
        ]

    def run_cycle(self) -> Blackboard:
        bb = Blackboard(started_at=datetime.now())
        print(f"\n┌─ Orchestrator cycle @ {bb.started_at:%H:%M:%S} "
              f"— dispatching {len(self.pipeline)} agents", flush=True)
        for agent in self.pipeline:
            print(f"   → {agent.name} …", flush=True)
            agent.run(bb)
        print("└─ cycle complete", flush=True)
        return bb
