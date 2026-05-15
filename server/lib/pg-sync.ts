// pg-sync.ts — backward-compat re-exports from pg-queries.
// Callers can migrate to pg-queries directly.
export {
  pgFindUserByAuthSubject,
  pgFindUserByEmail,
  pgUpsertMembership as upsertPgMembership,
  pgSetUserLastLogin,
} from "./pg-queries";

import { getPgPool, isPgReady } from "../db-pg";
import { logger } from "./logger";
import { pgUpsertMembership } from "./pg-queries";

/** Compatibility shim: inserts or updates a user record given a Firebase login. */
export async function upsertPgUser(record: {
  authProvider: string;
  authSubject: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  role?: string;
  status?: string;
  schoolCode?: string | null;
}): Promise<number | null> {
  if (!isPgReady()) return null;
  try {
    const { rows } = await getPgPool().query<{ id: string }>(
      `INSERT INTO users (auth_provider, auth_subject, email, display_name, avatar, role, status, school_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (auth_provider, auth_subject)
         DO UPDATE SET
           email        = EXCLUDED.email,
           display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           avatar       = COALESCE(EXCLUDED.avatar, users.avatar),
           last_login_at = now()
       RETURNING id`,
      [
        record.authProvider, record.authSubject, record.email.toLowerCase().trim(),
        record.displayName ?? null, record.avatarUrl ?? null,
        record.role ?? "student", record.status ?? "active", record.schoolCode ?? null,
      ]
    );
    return rows[0] ? parseInt(rows[0].id, 10) : null;
  } catch (err) {
    logger.error("[pg-sync] upsertPgUser failed", { err: String(err) });
    return null;
  }
}

export async function setPgMembershipStatus(userId: number, status: string): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query(
      "UPDATE memberships SET status = $1 WHERE user_id = $2",
      [status, userId]
    );
  } catch (err) {
    logger.error("[pg-sync] setPgMembershipStatus failed", { err: String(err), userId, status });
  }
}
