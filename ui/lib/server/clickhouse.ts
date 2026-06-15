export async function chQuery<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const host = process.env.CLICKHOUSE_HOST || "10.0.137.100";
  const port = process.env.CLICKHOUSE_PORT || "8123";
  const user = process.env.CLICKHOUSE_USER || "freshbus";
  const password = process.env.CLICKHOUSE_PASSWORD || "";
  const secure = process.env.CLICKHOUSE_SECURE === "true";
  const protocol = secure ? "https" : "http";

  const url = `${protocol}://${host}:${port}/?query=${encodeURIComponent(sql + " FORMAT JSONEachRow")}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-ClickHouse-User": user,
      "X-ClickHouse-Key": password,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ClickHouse query failed: ${err}`);
  }

  const text = await res.text();
  if (!text.trim()) return [];

  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

// ── Bridge to the Python multi-agent's decision log ──────────────────────────
// The agent writes decisions to `fs_pricing_decisions` in the freshbus_operations
// DB (not `default`), so qualify the table name explicitly.
const DECISIONS_TABLE = `${process.env.CLICKHOUSE_DB || "freshbus_operations"}.fs_pricing_decisions`;

export interface AgentDecision {
  ts: string;
  trip_id: number;
  day_type: string;
  strategy: string;
  model_class: string;
  new_class: string;
  tier_step: number;
  adjustment_pct: number;
  old_price: number;
  new_price: number;
  surge_pct: number;
  capped: number;
  reason: string;
}

/** Most recent agent decisions logged by the Python multi-agent. */
export async function getRecentAgentDecisions(limit = 50): Promise<AgentDecision[]> {
  return chQuery<AgentDecision>(
    `SELECT ts, trip_id, day_type, strategy, model_class, new_class, tier_step,
            adjustment_pct, old_price, new_price, surge_pct, capped, reason
     FROM ${DECISIONS_TABLE} ORDER BY ts DESC LIMIT ${Math.max(1, Math.min(limit, 500))}`
  );
}

/** Latest agent decision per trip id — used to enrich the fleet view. */
export async function getAgentDecisionsForTrips(
  tripIds: number[]
): Promise<Record<number, AgentDecision>> {
  const ids = tripIds.filter((n) => Number.isFinite(n)).join(",");
  if (!ids) return {};
  const rows = await chQuery<AgentDecision>(
    `SELECT trip_id,
            argMax(new_class, ts)      AS new_class,
            argMax(adjustment_pct, ts) AS adjustment_pct,
            argMax(reason, ts)         AS reason,
            argMax(surge_pct, ts)      AS surge_pct,
            argMax(model_class, ts)    AS model_class,
            max(ts)                    AS ts
     FROM ${DECISIONS_TABLE} WHERE trip_id IN (${ids}) GROUP BY trip_id`
  );
  const byTrip: Record<number, AgentDecision> = {};
  for (const r of rows) byTrip[Number(r.trip_id)] = r;
  return byTrip;
}
