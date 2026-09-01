import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

/**
 * Schema application, in two layers.
 *
 * LAYER 1 — the baseline. `scripts/pg-schema.sql` is applied on every run, as it
 * always has been. It is idempotent by convention (IF NOT EXISTS everywhere), it
 * carries ~30 ALTERs, and it is how most schema changes still land. Nothing
 * about that changed here.
 *
 * LAYER 2 — versioned migrations (autoplan T7). The idempotent convention cannot
 * express a data backfill, a destructive change, or anything that must run
 * exactly once in a known order. Files in `scripts/migrations/` fill that gap:
 * applied in filename order, recorded in `schema_migrations`, each inside its
 * own transaction.
 *
 * Safety properties this runner adds:
 *
 *   - ADVISORY LOCK. Two concurrent deploys, or a retried one, used to race.
 *     That was survivable while everything was IF NOT EXISTS; with ordered
 *     one-shot migrations it is not.
 *   - BASELINE ADOPTION. An existing database already contains the baseline's
 *     objects. `0000_baseline` is recorded as applied WITHOUT being re-executed
 *     as a versioned file — the baseline keeps running as layer 1.
 *   - WHOLE-FILE EXECUTION. One file is one `client.query()` inside an explicit
 *     BEGIN/COMMIT. The SQL is never tokenized on semicolons: pg-schema.sql
 *     contains a `DO $$ ... $$` block with internal semicolons, and session
 *     settings like `SET maintenance_work_mem` must share a session with the
 *     statements they affect.
 *   - CHECKSUMS. An applied file that later changes is a silent divergence
 *     between environments. The runner refuses rather than guessing.
 *
 * It deliberately does NOT take a backup or offer generic down migrations.
 * See scripts/migrations/README.md.
 *
 *   npm run migrate            apply baseline, then pending migrations
 *   npm run migrate -- --status  report without changing anything
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");
const BASELINE_ID = "0000_baseline";
/** One arbitrary but stable key, so every migrator contends on the same lock. */
const ADVISORY_LOCK_KEY = 8_142_390_771;

interface MigrationFile {
  id: string;
  path: string;
  sql: string;
  checksum: string;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function discoverMigrations(): MigrationFile[] {
  if (!existsSync(MIGRATIONS_DIR)) return [];
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const path = join(MIGRATIONS_DIR, f);
      const sql = readFileSync(path, "utf8");
      return { id: f.replace(/\.sql$/, ""), path, sql, checksum: sha256(sql) };
    });
}

async function ensureRegistry(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          text         PRIMARY KEY,
      checksum    text         NOT NULL,
      applied_at  timestamptz  NOT NULL DEFAULT now()
    )`);
}

async function appliedMigrations(client: PoolClient): Promise<Map<string, string>> {
  const { rows } = await client.query(`SELECT id, checksum FROM schema_migrations`);
  return new Map(rows.map((r: { id: string; checksum: string }) => [r.id, r.checksum]));
}

/**
 * Record the baseline as adopted without executing it as a versioned file. The
 * baseline itself still runs as layer 1 on every deploy; this row exists so the
 * ordered history has a defined starting point on a database that predates it.
 */
async function adoptBaseline(client: PoolClient, applied: Map<string, string>): Promise<void> {
  if (applied.has(BASELINE_ID)) return;
  const baselineSql = readFileSync(join(__dirname, "pg-schema.sql"), "utf8");
  await client.query(
    `INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [BASELINE_ID, sha256(baselineSql)]
  );
  console.log(`[pg-migrate] baseline adopted as ${BASELINE_ID} (not re-executed)`);
}

async function main(): Promise<void> {
  const url = process.env.POSTGRESQL_URL;
  if (!url) {
    console.error("[pg-migrate] POSTGRESQL_URL is not set. Aborting.");
    process.exit(1);
  }
  const statusOnly = process.argv.includes("--status");

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  let locked = false;

  try {
    // Serialize every migrator on one lock, so a retried deploy or two
    // concurrent revisions cannot interleave ordered migrations.
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    locked = true;

    await ensureRegistry(client);
    const applied = await appliedMigrations(client);
    const files = discoverMigrations();

    if (statusOnly) {
      await adoptBaselineReport(applied, files);
      return;
    }

    // Layer 1: the baseline, exactly as before — one query, one implicit
    // transaction, whole file.
    const baseline = readFileSync(join(__dirname, "pg-schema.sql"), "utf8");
    await client.query(baseline);
    console.log("[pg-migrate] baseline schema applied.");

    await adoptBaseline(client, applied);

    // Layer 2: pending versioned migrations, in order, one transaction each.
    let ran = 0;
    for (const file of files) {
      const recorded = applied.get(file.id);
      if (recorded) {
        if (recorded !== file.checksum) {
          throw new Error(
            `Migration ${file.id} changed after it was applied.\n` +
              `  recorded checksum: ${recorded}\n` +
              `  file checksum:     ${file.checksum}\n` +
              `An applied migration is immutable — fix it forward with a new file.`
          );
        }
        continue;
      }
      try {
        await client.query("BEGIN");
        await client.query(file.sql);
        await client.query(`INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)`, [
          file.id,
          file.checksum,
        ]);
        await client.query("COMMIT");
        ran++;
        console.log(`[pg-migrate] applied ${file.id}`);
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw new Error(`Migration ${file.id} failed and was rolled back: ${String(err)}`);
      }
    }
    console.log(
      ran === 0
        ? "[pg-migrate] no pending migrations."
        : `[pg-migrate] applied ${ran} migration(s).`
    );
  } catch (err) {
    console.error("[pg-migrate] Migration failed:", err);
    process.exitCode = 1;
  } finally {
    if (locked) {
      await client
        .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
        .catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

async function adoptBaselineReport(
  applied: Map<string, string>,
  files: MigrationFile[]
): Promise<void> {
  console.log(`[pg-migrate] baseline adopted: ${applied.has(BASELINE_ID) ? "yes" : "no"}`);
  if (files.length === 0) {
    console.log("[pg-migrate] no versioned migrations on disk.");
    return;
  }
  for (const f of files) {
    const recorded = applied.get(f.id);
    const state = !recorded
      ? "PENDING"
      : recorded === f.checksum
        ? "applied"
        : "CHANGED AFTER APPLY";
    console.log(`  ${state.padEnd(20)} ${f.id}`);
  }
}

void main();
