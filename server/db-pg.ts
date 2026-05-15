import { Pool, type PoolClient } from "pg";
import { logger } from "./lib/logger";

let pool: Pool | null = null;
let isPgConnected = false;

export function getPgPool(): Pool {
  if (!pool) throw new Error("PostgreSQL pool not initialized. Call connectPostgres() first.");
  return pool;
}

export function isPgReady(): boolean {
  return isPgConnected;
}

export async function connectPostgres(): Promise<void> {
  const url = process.env.POSTGRESQL_URL;
  if (!url) {
    logger.warn("[pg] POSTGRESQL_URL not set — PostgreSQL will not be available");
    return;
  }

  try {
    pool = new Pool({
      connectionString: url,
      max: parseInt(process.env.PG_MAX_POOL || "10", 10),
      idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || "30000", 10),
      connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || "5000", 10),
    });

    pool.on("error", (err) => {
      logger.error("[pg] Unexpected pool error", { err: String(err) });
      isPgConnected = false;
    });

    // Verify connectivity
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    isPgConnected = true;
    logger.info("[pg] PostgreSQL connected");

    // Graceful shutdown
    const shutdown = async () => {
      if (pool) {
        await pool.end().catch((e) => logger.error("[pg] Error closing pool", { err: String(e) }));
        isPgConnected = false;
        logger.info("[pg] PostgreSQL pool closed");
      }
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (err) {
    isPgConnected = false;
    logger.error("[pg] Failed to connect to PostgreSQL", { err: String(err) });
    // Do not rethrow — server continues without PostgreSQL during migration
  }
}

export async function withPgClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
