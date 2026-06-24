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

// Core tables the application cannot function without. Kept deliberately short —
// this is a smoke check for gross schema drift, not a full migration validator.
const CORE_TABLES = [
  "users",
  "workspaces",
  "workspace_memberships",
  "workspace_invites",
  "invites",
  "channels",
] as const;

async function warnOnMissingCoreTables(): Promise<void> {
  if (!pool) return;
  try {
    const { rows } = await pool.query<{ name: string; present: boolean }>(
      `SELECT name, to_regclass('public.' || name) IS NOT NULL AS present
       FROM unnest($1::text[]) AS name`,
      [CORE_TABLES as unknown as string[]]
    );
    const missing = rows.filter((r) => !r.present).map((r) => r.name);
    if (missing.length > 0) {
      logger.warn(
        `[pg] Schema drift detected — missing table(s): ${missing.join(", ")}. ` +
          `Run \`npm run migrate\` to apply scripts/pg-schema.sql. ` +
          `Features depending on these tables will fail until then.`
      );
    }
  } catch (err) {
    // Never let a diagnostic check take down startup.
    logger.warn("[pg] Core-table schema check failed", { err: String(err) });
  }
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
      statement_timeout: 10000,
      query_timeout: 10000,
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

    // Schema drift guard: a DB provisioned from a stale dump (or never migrated)
    // can be missing tables the app needs — workspace_invites in particular has
    // been absent in environments not run through scripts/pg-schema.sql, which
    // makes the whole workspace-invite flow 500 with no obvious cause. We don't
    // apply DDL here (the bundled prod server doesn't ship the .sql file, and
    // racing instances shouldn't ALTER on boot); instead we surface a loud,
    // actionable warning so the operator runs the migration.
    await warnOnMissingCoreTables();

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
