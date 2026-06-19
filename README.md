# Team Prik — FreshBus Autonomous Pricing Agent

An **autonomous, multi-agent pricing system** for intercity bus services. It reads
live trip data, enriches each trip with a fleet of demand/competitor/funnel
signals, reasons about it like a revenue manager using **Gemini**, decides two
pricing levers within hard guardrails, logs every decision, and **executes** fare
changes on the FreshBus admin API. A tiered **memory layer** keeps it from
re-pulling heavy data each cycle, and an **offline backtest** quantifies the
revenue lift. A Next.js console visualises the decisions and the fleet.

> **Reads → Enriches → Reasons (Gemini) → Validates → Logs → Acts** — end to end, on live systems.

```
Python multi-agent  →  ClickHouse (fs_pricing_decisions, fs_service_features)  →  Next.js UI
(prod reads + memory layer + Gemini + deterministic safety + staging execution)
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
agents never call each other — they communicate only through the blackboard.

| Agent | Role | LLM? |
|---|---|---|
| **Orchestrator** | sequences the cycle, dispatches, aggregates | no |
| **Collector** | live trip/occupancy/fares + all metric families (via the memory layer) | no |
| **Planner** | gates which trips need action + prioritises | no |
| **PricingAgent** | deterministic baseline (fallback) | no |
| **Reasoner** | **Gemini 2.5 Flash** decides the two levers from the composite scores | **yes** |
| **Validator** | clamps to `price_rules` — single safety chokepoint | **no** |
| **Writer** | logs to ClickHouse + applies on staging + pushes the undo stack | no |

`Collect → Plan → Price → Reason (Gemini) → Validate → Write`

The LLM is **off the critical path** — if Gemini is slow/unavailable, the
deterministic baseline carries the cycle; pricing never stalls.

---

## Signals, metrics & memory layer

The Collector builds a **167-metric catalog** down to **10 composite scores** that
reach the LLM (6 `CMP` composites + 3 guardrail flags + `LTB-08`). Each underlying
data family lives in its correct **memory tier** (per the Excel `MemoryPlan`), all
owned by a single `MemoryManager`:

| Tier | What it holds | Status |
|---|---|---|
| **LIVE** | occupancy, seats, lead, fares, discount depth (DSC-01) | direct read |
| **LRU-STATIC** | route master, last-year demand, history (booking curve) | cached, miss-batched |
| **LRU-SLOW** | price_rules, competitor (APSRTC), look-to-book funnel | cached, sentinel-gated |
| **DEQUE** | per-trip 24h booking velocity → `velocity_percentile` | cross-cycle window |
| **STACK** | LIFO `FareAction` undo (+ durable `--undo-last`) | live |
| **DURABLE** | `fs_service_features` — booking curve + elasticity, fronted by LRU | nightly rebuild |
| **DERIVED** | composites + signals | per cycle |

**Live composite families:** history (pace/depth), competitor (APSRTC fare gap),
look-to-book (visit momentum + LTB-08), velocity, discount depth, elasticity.
**SRP** is built but dormant (source `srpPosition` is all-zero live); `share_trend`
is the last neutral input.

The memory layer is a hashmap + **doubly-linked-list LRU** (O(1) get/evict, TTL,
label-invalidation), a bounded **stack**, and per-trip **deques** — proven to cut
DB round-trips from 4 (cold) to **0** within TTL across cycles (`docs/CACHE_LOG.md`).

**Day-type policy:** *absolute* (hold/raise while occupancy moves), *low* (build
occupancy early), *pseudo* (react per service). Discounting is a disciplined
exception, not a reflex — the tuned prompt only cuts when occupancy is low for the
lead **and** pace is behind **and** demand is weak **and** departure is near.

**Guardrails (no-DQ guarantee):** classification ≤ 1 step; adjustment within
±20%; price never exits floor/ceiling/max-surge/max-discount; never touches booked
seats; **fuzz-tested for 0 bound violations**; default **log-only**.

---

## Results (simulated, on live historical data)

Offline backtest (`backtest.py`) replays real journeys under a linear-demand model,
repricing only the inventory unsold by the decision lead. Reports baseline vs the
agent vs a bounded revenue-optimizer ceiling:

| pricer | simulated revenue lift |
|---|---|
| Rule baseline | **+0.5 … +0.75%** |
| Agent + LLM (Gemini, tuned) | **+0.4 … +0.55%** |
| Bounded optimizer ceiling | **+0.95 … +1.16%** |

Prompt tuning cut the LLM's over-discounting from **50/120 → 2/120** trips. The
agent reliably beats baseline; the LLM sits at near-parity with the blunt rules in
this simulation — by construction, since the (confounded) elasticity proxy reads
*inelastic everywhere*, which rewards blanket aggressive raises. A **demand-
controlled elasticity estimate** + a **live A/B** are the real arbiters. See
`docs/BACKTEST.md` and `docs/BACKTEST_LLM.md`.

---

## Tech stack

- **Reasoning:** Gemini 2.5 Flash (`thinking_budget=0`, JSON mode, retry/backoff)
- **Agent:** Python multi-agent orchestration + in-process memory layer (no Redis)
- **Live reads:** Prod PostgreSQL (`Trips`, `TripSeats`, …)
- **History/features/audit:** ClickHouse (`bus_ticket_data`, `aprstc_scraping_data`,
  `looks_to_books` + our `fs_pricing_decisions`, `fs_service_features`)
- **Actions:** FreshBus staging admin API (classification + fare adjustment)
- **UI:** Next.js 16 / React 19 / Prisma / TanStack Query / shadcn

---

## Repo structure

```
Team Prik/
├── run.py                  # entry point — cycle / --loop / --backtest / --backtest-llm
│                           #   / --rebuild-features / --undo-last (+ per-cycle cache log)
├── backtest.py             # offline revenue simulator + bounded optimizer (rules & LLM)
├── apply_to_staging.py     # execute one decision on the staging API
├── orchestrator.py         # head agent: dispatches the pipeline, threads the memory manager
├── agents/                 # collector, planner, pricing_agent, reasoner, validator, writer
├── blackboard.py           # shared cycle state (TripState + extras)
├── signals.py              # occupancy / lead / demand / pace / day-type
├── pricing_core.py         # two-lever math + bounds
├── reasoner_prompt.py      # the condensed, tuned Gemini system prompt
├── llm.py                  # Gemini client (loads .env, graceful fallback, 429/503 retry)
├── repository.py           # MemoryRepo (seed) + PostgresRepo (live) + memory-wrapped factory
├── db/                     # postgres_repo, clickhouse_store, admin_client
├── memory/                 # lru, labels, velocity, undo_stack, cached_repo, manager
├── metrics/                # composites, weights, history, competitor, ltb, discount, srp
├── test_safety.py          # ₹880 worked example + bounds-never-violated fuzz (3)
├── test_memory.py          # LRU/stack/deque + MemoryManager caching (11)
├── test_metrics.py         # composite bounds/directionality + every family (20)
├── test_backtest.py        # demand-model math: optimizer ≥ baseline, etc. (4)
├── CLICKHOUSE_CHANGES.md   # live audit of tables we create in ClickHouse
└── ui/                     # Next.js ops console (fleet + agent decisions)
```

> Extended docs (build log, cache log, backtest reports, runbook, demo, API
> reference, plans, presentation) live in the project's **`../docs/`** folder.
> **`docs/BUILD_LOG.md`** is the iteration-by-iteration record.

---

## Quick start

> Requires being on the FreshBus network/VPN (internal ClickHouse + prod RDS).
> Copy `.env.example` → `.env` and fill in DB / admin / `GEMINI_API_KEY` credentials.

**Agent (Terminal A):**
```bash
source venv/bin/activate
pip install -r requirements.txt          # first time
python3 test_safety.py && python3 test_memory.py \
  && python3 test_metrics.py && python3 test_backtest.py   # 38 tests

PRICING_MAX_TRIPS=10 python3 run.py      # decide + log (no writes); Gemini in the loop
python3 run.py --rebuild-features        # build the DURABLE feature store (nightly job)
python3 run.py --backtest 800            # offline revenue lift → docs/BACKTEST.md
python3 run.py --backtest-llm 120        # rules vs LLM vs optimizer → docs/BACKTEST_LLM.md
python3 apply_to_staging.py 91458 84907  # execute one decision on staging
```
Flags: `--apply-fares` · `--apply-one <tripId>` · `--undo-last` · `--loop <sec>` ·
`PRICING_MAX_TRIPS=N` · `SKIP_LY_DEMAND=1` · `CACHE=0`.

**UI (Terminal B):**
```bash
cd ui
cp .env.example .env.local               # set PRICING_COPILOT_JWT_SECRET + creds
npm install                              # runs prisma generate
npm run dev                              # → http://localhost:3000
```
Pages: **`/pricing/decisions`** (live agent decisions) and the **Fleet** monitor.

---

## What's done vs. remaining

**Done:** multi-agent orchestration · two levers · prod reads + staging writes ·
Gemini in the loop (tuned) · full tiered memory layer (LRU/stack/deque + manager) ·
all live metric families + composites · DURABLE feature store + elasticity ·
undo + velocity wired · offline backtest + bounded optimizer · cache-size log ·
38 tests green.

**Remaining (beyond-build):**
- **Demand-controlled elasticity** — replace the confounded occ↔fare proxy (the
  gating item to make the simulation a trustworthy LLM-vs-rules judge).
- **Live A/B** — the real proof of revenue lift.
- `share_trend`; **SRP** activation when ops populates `srpPosition`; optional Redis L2.

---

*Built for the FreshBus Pricing Agent hackathon; iterated well past it. See
`../docs/BUILD_LOG.md` for the full history.*
