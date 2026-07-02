import { Pool, type PoolClient } from "pg";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
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
  "attendance",
  "fees",
  "feature_usage",
] as const;

// ── Opt-in boot-time migration ────────────────────────────────────────────────
// With AUTO_MIGRATE=true, applies scripts/pg-schema.sql (idempotent
// CREATE TABLE IF NOT EXISTS) at startup under a Postgres advisory lock, so
// concurrently booting instances can't race the DDL. Off by default to
// preserve the manual `npm run migrate` workflow.
const MIGRATE_LOCK_KEY = 727_001;

async function autoMigrateIfEnabled(): Promise<void> {
  if (!pool || process.env.AUTO_MIGRATE !== "true") return;

  const schemaPath = join(process.cwd(), "scripts", "pg-schema.sql");
  if (!existsSync(schemaPath)) {
    logger.warn(
      `[pg] AUTO_MIGRATE=true but ${schemaPath} not found — skipping boot migration. ` +
        `Ensure the schema file is shipped with the image.`
    );
    return;
  }

  const client = await pool.connect();
  let locked = false;
  try {
    // Non-blocking lock: if another instance holds it, it is already applying
    // the same idempotent schema — skip instead of queueing DDL behind it.
    const { rows } = await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock($1) AS ok", [
      MIGRATE_LOCK_KEY,
    ]);
    locked = rows[0]?.ok === true;
    if (!locked) {
      logger.info("[pg] Boot migration skipped — another instance holds the migration lock");
      return;
    }
    const sql = readFileSync(schemaPath, "utf8");
    await client.query(sql);
    logger.info("[pg] Boot migration applied (AUTO_MIGRATE)");
  } catch (err) {
    // Never take down startup — drift warnings below will still fire.
    logger.error("[pg] Boot migration failed", { err: String(err) });
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATE_LOCK_KEY]).catch(() => {});
    }
    client.release();
  }
}

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

    // Opt-in boot migration (AUTO_MIGRATE=true): applies the idempotent
    // scripts/pg-schema.sql under a try-advisory-lock so racing instances
    // can't stack DDL. Off by default — `npm run migrate` stays the manual path.
    await autoMigrateIfEnabled();

    // Schema drift guard: a DB provisioned from a stale dump (or never migrated)
    // can be missing tables the app needs — workspace_invites in particular has
    // been absent in environments not run through scripts/pg-schema.sql, which
    // makes the whole workspace-invite flow 500 with no obvious cause. Without
    // AUTO_MIGRATE we don't apply DDL here; we surface a loud, actionable
    // warning so the operator runs the migration.
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
