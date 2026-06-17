# ClickHouse Change Log — Team Prik

Authoritative record of **every change we make to the ClickHouse database**.
Hackathon hygiene: we share this DB, so we track everything and can roll it back.

## Policy

- **We only CREATE NEW tables**, always prefixed `fs_` (feature store / agent).
- **We never ALTER, DROP, or write to existing tables.** Existing tables are
  read-only to us (confirmed: our role can read `bus_ticket_data` etc.).
- Every DDL statement our code runs is auto-appended to the "Automatic event
  log" section below (via `ClickHouseStore`), so nothing is silently created.

## Tables we created (registry)

| Table | Purpose | Engine | Created by |
|---|---|---|---|
| `fs_pricing_decisions` | Append-only log of every pricing decision the agent makes (trip, day_type, strategy, old/new price, surge %, capped, reason). The agent's audit trail — and on live runs the ONLY thing written (fares are log-only). | MergeTree ORDER BY (ts, trip_id) | `db/clickhouse_store.py: ensure_decisions_table()` |

### `fs_pricing_decisions` schema (records BOTH levers)
```sql
CREATE TABLE IF NOT EXISTS fs_pricing_decisions (
    ts             DateTime DEFAULT now(),
    trip_id        Int64,
    day_type       String,
    strategy       String,
    model_class    String,   -- model's classification (input)
    new_class      String,   -- lever 1: our classification
    tier_step      Int8,     -- -1 / 0 / +1
    adjustment_pct Int16,    -- lever 2: the "score" (0..20)
    old_price      Float64,
    new_price      Float64,
    surge_pct      Float64,
    capped         UInt8,
    reason         String
) ENGINE = MergeTree ORDER BY (ts, trip_id)
```
> If an older (v1) copy of the table exists, the code runs idempotent
> `ALTER TABLE … ADD COLUMN IF NOT EXISTS` for `model_class`, `new_class`,
> `tier_step`, `adjustment_pct` — and logs the change below.

## Data written

- `fs_pricing_decisions`: one row per **changed** decision, per cycle
  (the Writer agent, even in LOG-ONLY mode). Reads only from existing tables.

## Cleanup (run after the hackathon to leave the DB clean)

```sql
DROP TABLE IF EXISTS fs_pricing_decisions;
-- plus any other fs_* tables listed in the registry above
```

---

## Automatic event log
<!-- ClickHouseStore appends timestamped DDL events below this line. Do not edit by hand. -->
- [2026-06-17 17:47:31] CREATE TABLE: freshbus_operations.fs_service_features
- [2026-06-17 17:47:31] REBUILD: fs_service_features (150d window)
