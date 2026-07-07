import { Pool } from "pg";
import crypto from "node:crypto";

/**
 * Direct DB access for E2E tests.
 *
 * There is no SMTP configured in local/CI test runs (server/lib/mailer.ts
 * falls back to a log-only JSON transporter), so OTP codes and invite
 * tokens never reach a real inbox. The server already treats the database
 * as the source of truth for both (see server/routes/auth.ts's dev/last-otp
 * comment: "we never store the plaintext OTP — only its hash"), so E2E specs
 * read them the same way the server itself would verify them: by hash
 * comparison for OTPs, and directly for invite tokens (stored in plaintext).
 *
 * Requires POSTGRESQL_URL to point at the same database the dev server
 * (started via `npm run dev` / the Playwright webServer) is using.
 */

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRESQL_URL;
    if (!connectionString) {
      throw new Error(
        "POSTGRESQL_URL is not set — E2E specs that read OTPs/invite tokens need direct DB access."
      );
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Mirrors server/routes/auth.ts's createVerificationToken: a 4-digit code
 * (1000-9999) hashed with sha256 before storage. Brute-forcing 9000 hashes
 * locally is effectively instant and avoids needing a plaintext-OTP escape
 * hatch in production route code.
 */
export async function getLatestRegistrationOtp(email: string): Promise<string> {
  const db = getPool();
  const { rows: userRows } = await db.query(
    `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  if (userRows.length === 0) throw new Error(`No user found for email ${email}`);
  const userId = userRows[0].id;

  const { rows: otpRows } = await db.query(
    `SELECT otp_hash FROM otps
     WHERE user_id = $1 AND type = 'registration' AND used = false
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (otpRows.length === 0) throw new Error(`No active registration OTP found for ${email}`);
  const otpHash = otpRows[0].otp_hash as string;

  for (let code = 1000; code < 10000; code++) {
    if (tokenHash(String(code)) === otpHash) {
      return String(code);
    }
  }
  throw new Error(`Could not recover OTP for ${email} — hash didn't match any 4-digit code`);
}

/** The invite token is stored in plaintext (server/lib/pg-queries.ts pgCreateInvite). */
export async function getLatestInviteToken(email: string): Promise<string> {
  const db = getPool();
  const { rows } = await db.query(
    `SELECT token FROM invites WHERE lower(email) = lower($1) ORDER BY created_at DESC LIMIT 1`,
    [email]
  );
  if (rows.length === 0) throw new Error(`No invite found for email ${email}`);
  return rows[0].token as string;
}
