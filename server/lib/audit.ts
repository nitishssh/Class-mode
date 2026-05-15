import { getPgPool, isPgReady } from "../db-pg";
import { logger } from "./logger";

export const AUDIT_EVENTS = {
  USER_REGISTERED: "user.registered",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_STATUS_CHANGED: "user.status_changed",
  USER_LOGIN: "user.login",
  TEACHER_APPROVED: "teacher.approved",
  INVITE_SENT: "invite.sent",
  INVITE_ACCEPTED: "invite.accepted",
  INVITE_RESENT: "invite.resent",
  ROLE_CLAIM_REJECTED: "role_claim.rejected",
  CUSTOM_CLAIMS_SYNCED: "custom_claims.synced",
} as const;

export type AuditEventType = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS];

interface AuditParams {
  actorUserId?: number | null;
  targetUserId?: number | null;
  schoolCode?: string | null;
  eventType: AuditEventType;
  payload?: Record<string, unknown>;
}

export async function recordAuditEvent(params: AuditParams): Promise<void> {
  if (!isPgReady()) return;
  try {
    await getPgPool().query(
      `INSERT INTO audit_events (actor_user_id, target_user_id, school_code, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.actorUserId ?? null,
        params.targetUserId ?? null,
        params.schoolCode ?? null,
        params.eventType,
        JSON.stringify(params.payload ?? {}),
      ]
    );
  } catch (err) {
    logger.error("[audit] Failed to record audit event", { eventType: params.eventType, err: String(err) });
  }
}
