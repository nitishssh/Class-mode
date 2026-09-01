/**
 * Runtime half of the WhatsApp promise invariant.
 *
 * `docs/dashboard/pilot-offer.md` tells schools in writing: "We do not
 * auto-send WhatsApp messages today". That is true only while
 * WHATSAPP_ALERTS_ENABLED is off, which is enforced by two gates
 * (server/routes/attendance.ts producer, server/services/notifications-consumer.ts
 * consumer).
 *
 * `scripts/check-whatsapp-promise.ts` guards the repo half in CI — it catches a
 * gate being removed, or the promise being deleted from the offer. What it
 * cannot see is the env of a running process. This does.
 *
 * Deliberately a WARNING, not a fatal: flipping the flag may be an intended
 * product decision, and killing a live school's server at boot over a policy
 * mismatch would be a worse outcome than a loud log line. The point is that
 * turning parent messaging on can never be silent.
 */
/**
 * Structural, not the concrete logger type: `./logger` exports a value, not a
 * type, and this only ever needs `.error`. Tests pass a spy.
 */
type ErrorLogger = { error: (msg: string) => void };

export const WHATSAPP_LIVE_WARNING =
  "[whatsapp] WHATSAPP_ALERTS_ENABLED=true — automated parent messages are LIVE. " +
  "docs/dashboard/pilot-offer.md still promises schools we do not auto-send today. " +
  "Retract that promise deliberately or unset this flag.";

/**
 * Logs a loud warning when automated parent messaging is switched on.
 * Returns true when the warning fired, so callers and tests can assert on it.
 */
export function warnIfAutoSendContradictsOffer(env: NodeJS.ProcessEnv, log: ErrorLogger): boolean {
  if (env.WHATSAPP_ALERTS_ENABLED !== "true") return false;
  log.error(WHATSAPP_LIVE_WARNING);
  return true;
}
