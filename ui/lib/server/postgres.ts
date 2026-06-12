import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pgPool: Pool | undefined };

function createPool() {
  return new Pool({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    ssl:
      process.env.POSTGRES_SSLMODE === "require"
        ? { rejectUnauthorized: false }
        : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

export const pgPool = globalForPg.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pgPool;

export async function pgQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await pgPool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}
