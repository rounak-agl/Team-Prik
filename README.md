# FreshBus Pricing — Multi-Agent Orchestration

A pricing agent built as a **head Orchestrator dispatching specialised worker
agents** over a shared blackboard. Each agent owns one job; they never call each
other. The Orchestrator sequences them and the **Validator is a single
deterministic safety chokepoint**, so no LLM agent can ever produce a price that
violates `price_rules`.

## Run (zero setup)

```bash
python run.py             # one orchestration cycle on seeded data
python run.py --loop 300  # autonomous, every 5 minutes
python test_safety.py     # ₹880 reproduction + bounds-never-violated fuzz
```

Uses Gemini 2.5 Flash for explanations if `GEMINI_API_KEY` is set; otherwise
falls back to templated reasons — it never stalls on the LLM.

## The agents

| Agent | Role | LLM? |
|---|---|---|
| **Orchestrator** | runs the cycle, dispatches, aggregates | no |
| **Collector** | gathers trip/seat/booking/demand state | no |
| **Planner** | gates which trips need action + prioritises | no |
| **PricingAgent** | *proposes* a price (occupancy+lead+demand+velocity, day-type strategy, distress discount) | no |
| **Validator** | *enforces* `price_rules` — clamp, assert, no-DQ chokepoint | no |
| **Explainer** | plain-English reason per change (Gemini Flash, batched, fallback) | yes |
| **Writer** | applies price to unsold seats only + logs price_history | no |

Pipeline: `Collect → Plan → Price → Validate → Explain → Write`.

## Why this design

- **Separation of concerns** — each agent is small and independently testable.
- **Safety by construction** — PricingAgent *proposes*, Validator *disposes*; the
  bound guarantee lives in one place (proved in `test_safety.py`).
- **LLM off the critical path** — the price is deterministic; the LLM only
  narrates, so rate limits / outages never affect correctness.
- **Demoable** — the orchestration trace shows each agent acting in turn.

## Worked example (from the brief)

HYD→BLR, 85% occupancy, 4 days out, demand 72 → +20%+10%+5% = +35% → ₹650 →
**₹880**, within bounds. Reproduced exactly by `run.py` and `test_safety.py`.

## Swapping to the real database

`repository.py` is the only data-coupled file. Implement a `PostgresRepo` with
the same methods (`active_trips`, `seats`, `bookings`, `demand`, `price_rules`,
`update_unsold_seat_prices`, `log_price_change`) and the agents are unchanged.
