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

// ── Reconnect probe ───────────────────────────────────────────────────────────
// Fires a SELECT 1 every 30 s after an error to recover isPgConnected state
// without requiring a full server restart.
let probeTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleReconnectProbe(): void {
  if (probeTimer) return; // already scheduled
  probeTimer = setTimeout(async () => {
    probeTimer = null;
    if (isPgConnected || !pool) return; // recovered or pool gone
    try {
      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();
      isPgConnected = true;
      logger.info("[pg] Reconnected to PostgreSQL");
    } catch {
      // still down — schedule the next probe
      scheduleReconnectProbe();
    }
  }, 30_000);
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
      // Schedule a reconnect probe so isPgConnected can recover after a
      // transient outage (network blip, DB restart) without a server restart.
      scheduleReconnectProbe();
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
