import { subscribe, type DomainEvent } from "../lib/events";
import { whatsappService } from "./whatsapp";
import { logger } from "../lib/logger";

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

  const results = await Promise.allSettled(
    absentees.map((s) =>
      whatsappService.sendMessage({
        to: s.parentPhone,
        body: absenceMessage(s.name, date, className),
      })
    )
  );
  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success)
  ).length;
  if (failed > 0) {
    logger.warn(
      `[notifications] ${failed}/${results.length} absence alerts failed (${className} ${date})`
    );
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
