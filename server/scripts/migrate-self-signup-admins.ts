/**
 * Migration: downgrade self-signup "admin" users to "school_admin".
 *
 * Background
 * ──────────
 * Before the role-system fix, every self-signup (local /signup, Google, and the
 * Firebase bridge with a workspace name) created users with role = "admin" —
 * which is the PLATFORM super-admin role (the one that can mint more platform
 * admins via /api/onboarding/invite/platform-admin). The correct role for a
 * workspace/school creator is "school_admin" (a tenant admin).
 *
 * This script finds existing "admin" users that look like self-signups (they
 * own a workspace and/or a school) and downgrades them to "school_admin",
 * while preserving genuine platform admins.
 *
 * SAFETY
 * ──────
 *   • Dry-run by default — prints what it WOULD change and exits.
 *   • Pass --apply to actually write.
 *   • Preserve real platform admins by listing their emails in
 *     PLATFORM_ADMIN_EMAILS (comma-separated). Those are never downgraded.
 *
 * Usage
 * ─────
 *   # see what would change
 *   PLATFORM_ADMIN_EMAILS="you@example.com" npx tsx server/scripts/migrate-self-signup-admins.ts
 *   # actually apply
 *   PLATFORM_ADMIN_EMAILS="you@example.com" npx tsx server/scripts/migrate-self-signup-admins.ts --apply
 */

import "dotenv/config";
import { connectPostgres, getPgPool } from "../db-pg";

const APPLY = process.argv.includes("--apply");

const PRESERVE = new Set(
  (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

async function main() {
  await connectPostgres();
  const pool = getPgPool();

  // Candidate self-signup admins: role = 'admin' AND they own a workspace or a
  // school. Platform admins created via the platform-admin invite have no owned
  // workspace/school, so they won't match.
  const { rows } = await pool.query<{
    id: number;
    email: string;
    name: string | null;
    owns_workspace: boolean;
    owns_school: boolean;
  }>(
    `
    SELECT u.id,
           u.email,
           u.name,
           EXISTS (SELECT 1 FROM workspaces w WHERE w.owner_id = u.id)        AS owns_workspace,
           EXISTS (SELECT 1 FROM schools s WHERE s.created_by_uid = u.auth_subject) AS owns_school
    FROM users u
    WHERE u.role = 'admin'
    ORDER BY u.id
    `
  );

  const candidates = rows.filter(
    (r) => (r.owns_workspace || r.owns_school) && !PRESERVE.has(r.email.toLowerCase())
  );
  const preserved = rows.filter(
    (r) => PRESERVE.has(r.email.toLowerCase()) || (!r.owns_workspace && !r.owns_school)
  );

  console.log(`\nFound ${rows.length} user(s) with role = "admin".`);
  console.log(
    `  → ${candidates.length} look like self-signups and will be downgraded to "school_admin".`
  );
  console.log(`  → ${preserved.length} preserved as platform "admin".\n`);

  if (preserved.length) {
    console.log("Preserved as platform admin:");
    for (const p of preserved) {
      const reason = PRESERVE.has(p.email.toLowerCase())
        ? "in PLATFORM_ADMIN_EMAILS"
        : "owns no workspace/school";
      console.log(`  • [${p.id}] ${p.email} (${reason})`);
    }
    console.log("");
  }

  if (!candidates.length) {
    console.log("Nothing to downgrade. Done.");
    return;
  }

  console.log(`${APPLY ? "Downgrading" : "[dry-run] Would downgrade"}:`);
  for (const c of candidates) {
    console.log(`  • [${c.id}] ${c.email}`);
  }

  if (!APPLY) {
    console.log("\nDry-run only. Re-run with --apply to write changes.");
    return;
  }

  const ids = candidates.map((c) => c.id);
  const res = await pool.query(
    `UPDATE users SET role = 'school_admin' WHERE id = ANY($1::bigint[]) AND role = 'admin'`,
    [ids]
  );
  console.log(`\n✓ Downgraded ${res.rowCount} user(s) to "school_admin".`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
