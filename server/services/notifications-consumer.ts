import { subscribe, type DomainEvent } from "../lib/events";
import { whatsappService } from "./whatsapp";
import { logger } from "../lib/logger";
import { pgRecordNotificationFailure } from "../lib/db/pg-queries";

/**
 * Event consumers that turn domain events into outbound notifications.
 *
 * attendance.marked → WhatsApp the parent of each absentee. Consuming from
 * the stream (instead of the old inline fire-and-forget) means a crash or
 * restart between the register save and the sends no longer loses alerts —
 * unacked events are redelivered via XAUTOCLAIM.
 *
 * Delivery semantics: at-least-once up to the handler; individual send
 * failures are logged but the event is still acked — a WhatsApp outage
 * shouldn't cause endless redelivery (and duplicate alerts for the sends
 * that DID succeed). Payments-grade retry belongs on a per-message outbox,
 * not here.
 */

export interface AbsenteeInfo {
  id: number;
  name: string;
  parentPhone: string;
}

export interface AttendanceMarkedPayload {
  className: string;
  date: string;
  absentees: AbsenteeInfo[];
}

export function absenceMessage(name: string, date: string, className: string): string {
  return `Attendance alert: ${name} was marked absent today (${date}), class ${className}. If this is unexpected, please contact the school.`;
}

export async function handleAttendanceMarked(
  event: DomainEvent<AttendanceMarkedPayload>
): Promise<void> {
  const { className, date, absentees } = event.payload;
  if (!absentees?.length) return;
  // Delivery-time gate: an attendance.marked event queued before the master
  // switch was turned off must not message parents from the backlog. The
  // producer side is also gated (routes/attendance.ts) — both ends hold.
  if (process.env.WHATSAPP_ALERTS_ENABLED !== "true") {
    logger.info(
      `[notifications] WHATSAPP_ALERTS_ENABLED off — dropping ${absentees.length} queued absence alerts (${className} ${date})`
    );
    return;
  }

  const results = await Promise.allSettled(
    absentees.map((s) =>
      whatsappService.sendMessage({
        to: s.parentPhone,
        body: absenceMessage(s.name, date, className),
      })
    )
  );

  // Autoplan T5: a failed send used to exist only as a log line — a parent
  // silently never contacted, with nothing anyone could query. Record a pointer
  // per failure (which student, which day, which error), never the phone number
  // or the message body.
  //
  // The whole block is best-effort by construction: the event is acked either
  // way. Acking a partly-failed batch is deliberate (a WhatsApp outage must not
  // re-message every parent whose send SUCCEEDED), and a failure to RECORD a
  // failure must never become an unacked event that does exactly that.
  const failures = results
    .map((r, i) => ({ r, s: absentees[i] }))
    .filter(({ r }) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success));

  if (failures.length > 0) {
    logger.warn(
      `[notifications] ${failures.length}/${results.length} absence alerts failed (${className} ${date})`
    );
    try {
      await Promise.allSettled(
        failures.map(({ r, s }) =>
          pgRecordNotificationFailure({
            studentId: s.id,
            schoolCode: event.schoolCode ?? null,
            className,
            date,
            channel: "whatsapp",
            errorCode:
              r.status === "rejected"
                ? "send_threw"
                : (r.value.error ?? "send_unsuccessful"),
          })
        )
      );
    } catch (err) {
      logger.error("[notifications] could not record absence-alert failures", {
        err: String(err),
      });
    }
  }
}

/** Start all notification consumers. Returns false when Redis is off. */
export function startNotificationConsumers(): boolean {
  return subscribe<AttendanceMarkedPayload>({
    topic: "attendance.marked",
    group: "notifications",
    handler: handleAttendanceMarked,
  });
}
