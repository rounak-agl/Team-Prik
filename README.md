# Team Prik — FreshBus Autonomous Pricing Agent

An **autonomous, multi-agent pricing system** for intercity bus services. It reads
live trip data, reasons about each trip like a revenue manager using **Gemini**,
decides two pricing levers within hard guardrails, logs every decision, and
**executes** fare changes on the FreshBus admin API. A Next.js console
visualises the agent's decisions and the fleet.

> **Reads → Reasons (Gemini) → Validates → Logs → Acts** — end to end, on live systems.

```
Python multi-agent  →  ClickHouse (fs_pricing_decisions)  →  Next.js UI
(prod reads + Gemini + deterministic safety + staging execution)
```

---

## The idea

Pricing hundreds of trips by hand is slow and inconsistent — demand-day surges
are missed, low-demand buses leave empty. This agent watches every trip and
decides **two levers**:

1. **Model Classification** — the fare tier on an 8-step ladder
   (`Super_Low → Low → Medium → High → Super_High → Ultra_High → Special_High → Festive`),
   moving **at most one step** from the model's current tier.
2. **Bus Fare Adjustment %** — a precise adjustment in **−20% … +20%**.

**Design principle:** *the LLM makes the judgment; deterministic code guarantees
safety.* An LLM proposes; a validator disposes.

---

## Architecture

A head **Orchestrator** runs six specialised agents over a shared blackboard;
agents never call each other.

| Agent | Role | LLM? |
|---|---|---|
| **Orchestrator** | sequences the cycle, dispatches, aggregates | no |
| **Collector** | live trip/occupancy/fares + last-year demand | no |
| **Planner** | gates which trips need action + prioritises | no |
| **PricingAgent** | deterministic baseline (fallback) | no |
| **Reasoner** | **Gemini 2.5 Flash** decides the two levers | **yes** |
| **Validator** | clamps to `price_rules` — single safety chokepoint | **no** |
| **Writer** | logs to ClickHouse + applies on staging | no |

`Collect → Plan → Price → Reason (Gemini) → Validate → Write`

The LLM is **off the critical path** — if Gemini is slow/unavailable, the
deterministic baseline carries the cycle; pricing never stalls.

---

## Signals & rules

**Signals (per trip):** occupancy %, lead time, demand (derived from **last-year
occupancy**), booking pace, velocity, day-type, EPK/ASP, seat-class floors/ceilings.

**Day-type policy:** *absolute* (hold/raise while occupancy moves), *low* (build
occupancy early), *pseudo* (react per service vs siblings). Demand day means
**hold only while occupancy is moving** — never hold into an empty bus.

**Guardrails (no-DQ guarantee):** classification ≤ 1 step; adjustment within
±20%; price never exits floor/ceiling/max-surge/max-discount; never touches
booked seats; **fuzz-tested for 0 bound violations**; default **log-only**.

---

## Tech stack

- **Reasoning:** Gemini 2.5 Flash (judgment + plain-English reasons)
- **Agent:** Python multi-agent orchestration
- **Live reads:** Prod PostgreSQL (`Trips`, `TripSeats`)
- **History/audit:** ClickHouse (last-year demand + `fs_pricing_decisions`)
- **Actions:** FreshBus staging admin API (classification + fare adjustment)
- **UI:** Next.js 16 / React 19 / Prisma / TanStack Query / shadcn

---

## Repo structure

```
Team Prik/
├── run.py                  # entry point — one cycle or --loop
├── apply_to_staging.py     # execute one decision on the staging API
├── orchestrator.py         # head agent: dispatches the pipeline
├── agents/                 # collector, planner, pricing_agent, reasoner, validator, writer
├── blackboard.py           # shared cycle state
├── signals.py              # occupancy / lead / demand / pace / day-type
├── pricing_core.py         # two-lever math + bounds
├── reasoner_prompt.py      # the condensed Gemini system prompt
├── llm.py                  # Gemini client (graceful fallback)
├── repository.py           # MemoryRepo (seed) + PostgresRepo (live) + ClickHouse store factory
├── db/                     # postgres_repo, clickhouse_store, admin_client
├── test_safety.py          # ₹880 / bounds-never-violated fuzz
├── CLICKHOUSE_CHANGES.md   # live audit of tables we create in ClickHouse
└── ui/                     # Next.js ops console (fleet + agent decisions)
```

> Extended docs (runbook, demo script, API reference, plans, presentation) live
> in the project's **`../docs/`** folder.

---

## Quick start

> Requires being on the FreshBus network/VPN (internal ClickHouse + prod RDS).
> Copy `.env.example` → `.env` and fill in DB / admin / Gemini credentials.

**Agent (Terminal A):**
```bash
source venv/bin/activate
pip install -r requirements.txt        # first time
python3 test_safety.py                 # safety check
PRICING_MAX_TRIPS=10 python3 run.py    # decide + log (no writes)
python3 apply_to_staging.py 91458 84907  # execute one decision on staging
```
Flags: `--apply-fares` (apply all changed trips) · `--apply-one <tripId>` ·
`PRICING_MAX_TRIPS=N` · `SKIP_LY_DEMAND=1` (skip the demand lookup for speed).

**UI (Terminal B):**
```bash
cd ui
cp .env.example .env.local             # set PRICING_COPILOT_JWT_SECRET + creds
npm install                            # runs prisma generate
npm run dev                            # → http://localhost:3000
```
Pages: **`/pricing/decisions`** (live agent decisions) and the **Fleet** monitor.

---

## Future scope

- **Memory & caching layer** — LRU (hashmap + doubly-linked list), undo stack,
  velocity deque + per-entry freshness labels, so heavy data isn't re-pulled
  each cycle and the agent scales to the whole fleet.
- **Expected-revenue optimizer** — replace heuristics with
  `price × P(sale | elasticity, booking-curve)`.
- **Offline backtest simulator** — prove revenue lift before touching live fares.
- Competitor-aware pricing + looks-to-book funnel signals.

---

*Built for the FreshBus Pricing Agent hackathon.*
