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
