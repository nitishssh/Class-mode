import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getPgPool } from "../db-pg";

const rpID = process.env.PASSKEY_RP_ID ?? "localhost";
const rpName = process.env.PASSKEY_RP_NAME ?? "Class-mode";
const origins = (process.env.PASSKEY_ORIGINS ?? "http://localhost:5001")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ttlMs = Number(process.env.PASSKEY_CHALLENGE_TTL_SECONDS ?? 300) * 1000;

export function passkeysEnabled(): boolean {
  return process.env.ENABLE_PASSKEYS === "true";
}

export async function registrationOptions(user: {
  id: number;
  name: string;
  email: string;
}) {
  const pool = getPgPool();
  const { rows } = await pool.query<{ credential_id: string }>(
    "SELECT credential_id FROM passkey_credentials WHERE user_id = $1 AND revoked_at IS NULL",
    [user.id]
  );
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(String(user.id)),
    excludeCredentials: rows.map((row) => ({ id: row.credential_id })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await pool.query(
    `INSERT INTO passkey_challenges (user_id, challenge, purpose, rp_id, expires_at)
     VALUES ($1, $2, 'registration', $3, $4)`,
    [user.id, options.challenge, rpID, new Date(Date.now() + ttlMs)]
  );
  return options;
}

export async function verifyRegistration(userId: number, response: RegistrationResponseJSON) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const challenge = await client.query<{ id: number; challenge: string }>(
      `SELECT id, challenge FROM passkey_challenges
       WHERE user_id = $1 AND purpose = 'registration' AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId]
    );
    const row = challenge.rows[0];
    if (!row) throw new Error("PASSKEY_CHALLENGE_EXPIRED");
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: row.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      throw new Error("PASSKEY_INVALID");
    }
    const info = verification.registrationInfo;
    const credential = info.credential;
    await client.query(
      `INSERT INTO passkey_credentials
       (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId,
        credential.id,
        Buffer.from(credential.publicKey).toString("base64url"),
        credential.counter,
        info.credentialDeviceType,
        info.credentialBackedUp,
        response.response.transports ?? [],
      ]
    );
    await client.query("UPDATE passkey_challenges SET consumed_at = now() WHERE id = $1", [row.id]);
    await client.query("COMMIT");
    return { verified: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function authenticationOptions(requestedRole?: string) {
  const pool = getPgPool();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await pool.query(
    `INSERT INTO passkey_challenges (challenge, purpose, requested_role, rp_id, expires_at)
     VALUES ($1, 'login', $2, $3, $4)`,
    [options.challenge, requestedRole ?? null, rpID, new Date(Date.now() + ttlMs)]
  );
  return options;
}

export type PasskeyAuthentication = {
  response: AuthenticationResponseJSON;
  requestedRole?: string;
};

export async function verifyAuthentication(input: PasskeyAuthentication) {
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const challenge = await client.query<{
      id: number;
      challenge: string;
      requested_role: string | null;
    }>(
      `SELECT id, challenge, requested_role FROM passkey_challenges
       WHERE purpose = 'login' AND consumed_at IS NULL AND expires_at > now()
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    );
    const challengeRow = challenge.rows[0];
    if (!challengeRow) throw new Error("PASSKEY_CHALLENGE_EXPIRED");
    const credential = await client.query<{
      user_id: number;
      credential_id: string;
      public_key: string;
      counter: string;
      transports: string[];
    }>(
      `SELECT user_id, credential_id, public_key, counter, transports
       FROM passkey_credentials WHERE credential_id = $1 AND revoked_at IS NULL`,
      [input.response.id]
    );
    const stored = credential.rows[0];
    if (!stored) throw new Error("PASSKEY_INVALID");
    const verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      credential: {
        id: stored.credential_id,
        publicKey: Buffer.from(stored.public_key, "base64url"),
        counter: Number(stored.counter),
        transports: stored.transports as any,
      },
    });
    if (!verification.verified) throw new Error("PASSKEY_INVALID");
    await client.query(
      "UPDATE passkey_credentials SET counter = $1, last_used_at = now() WHERE credential_id = $2",
      [verification.authenticationInfo.newCounter, stored.credential_id]
    );
    await client.query("UPDATE passkey_challenges SET consumed_at = now() WHERE id = $1", [challengeRow.id]);
    await client.query("COMMIT");
    return { userId: stored.user_id, requestedRole: challengeRow.requested_role };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
