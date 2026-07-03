import { describe, it, expect, afterEach, vi } from "vitest";
import type { DomainEvent } from "../lib/events";
import { whatsappService } from "../services/whatsapp";
import {
  absenceMessage,
  handleAttendanceMarked,
  type AttendanceMarkedPayload,
} from "../services/notifications-consumer";

function event(payload: AttendanceMarkedPayload): DomainEvent<AttendanceMarkedPayload> {
  return { topic: "attendance.marked", at: new Date().toISOString(), schoolCode: "SCH1", userId: 1, payload };
}

describe("absenceMessage", () => {
  it("includes the student name, date, and class", () => {
    const msg = absenceMessage("Rahul", "2026-07-04", "5A");
    expect(msg).toContain("Rahul");
    expect(msg).toContain("2026-07-04");
    expect(msg).toContain("5A");
  });
});

describe("handleAttendanceMarked", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends one WhatsApp message per absentee, addressed to the parent phone", async () => {
    const spy = vi
      .spyOn(whatsappService, "sendMessage")
      .mockResolvedValue({ success: true, messageId: "wa_1" });

    await handleAttendanceMarked(
      event({
        className: "5A",
        date: "2026-07-04",
        absentees: [
          { id: 1, name: "Rahul", parentPhone: "+911111111111" },
          { id: 2, name: "Priya", parentPhone: "+912222222222" },
        ],
      })
    );

    expect(spy).toHaveBeenCalledTimes(2);
    const firstArg = spy.mock.calls[0][0];
    expect(firstArg.to).toBe("+911111111111");
    expect(firstArg.body).toContain("Rahul");
  });

  it("sends nothing when there are no absentees", async () => {
    const spy = vi.spyOn(whatsappService, "sendMessage").mockResolvedValue({ success: true });
    await handleAttendanceMarked(event({ className: "5A", date: "2026-07-04", absentees: [] }));
    expect(spy).not.toHaveBeenCalled();
  });

  it("does not throw when a send fails — partial failures are logged, not propagated", async () => {
    vi.spyOn(whatsappService, "sendMessage")
      .mockResolvedValueOnce({ success: true, messageId: "wa_ok" })
      .mockResolvedValueOnce({ success: false, error: "Graph API 131047" });

    await expect(
      handleAttendanceMarked(
        event({
          className: "5A",
          date: "2026-07-04",
          absentees: [
            { id: 1, name: "Rahul", parentPhone: "+911111111111" },
            { id: 2, name: "Priya", parentPhone: "+912222222222" },
          ],
        })
      )
    ).resolves.toBeUndefined();
  });

  it("does not throw when a send rejects outright", async () => {
    vi.spyOn(whatsappService, "sendMessage").mockRejectedValue(new Error("network down"));
    await expect(
      handleAttendanceMarked(
        event({
          className: "5A",
          date: "2026-07-04",
          absentees: [{ id: 1, name: "Rahul", parentPhone: "+911111111111" }],
        })
      )
    ).resolves.toBeUndefined();
  });
});
