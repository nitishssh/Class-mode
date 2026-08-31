import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const rec = vi.hoisted(() => ({ mockRecord: vi.fn() }));
vi.mock("../lib/db/pg-queries", () => ({ pgRecordNotificationFailure: rec.mockRecord }));
import type { DomainEvent } from "../lib/events";
import { whatsappService } from "../services/whatsapp";
import {
  absenceMessage,
  handleAttendanceMarked,
  type AttendanceMarkedPayload,
} from "../services/notifications-consumer";

function event(payload: AttendanceMarkedPayload): DomainEvent<AttendanceMarkedPayload> {
  return {
    topic: "attendance.marked",
    at: new Date().toISOString(),
    schoolCode: "SCH1",
    userId: 1,
    payload,
  };
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
  beforeEach(() => {
    // The consumer self-gates at delivery time; these tests exercise the
    // behavior behind the gate.
    process.env.WHATSAPP_ALERTS_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.WHATSAPP_ALERTS_ENABLED;
    vi.restoreAllMocks();
  });

  it("drops queued alerts when WHATSAPP_ALERTS_ENABLED is off (backlog gate)", async () => {
    delete process.env.WHATSAPP_ALERTS_ENABLED;
    const spy = vi.spyOn(whatsappService, "sendMessage").mockResolvedValue({ success: true });
    await handleAttendanceMarked(
      event({
        className: "5A",
        date: "2026-07-04",
        absentees: [{ id: 1, name: "Rahul", parentPhone: "+911111111111" }],
      })
    );
    // Events queued before the switch was turned off must never send.
    expect(spy).not.toHaveBeenCalled();
  });

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

// Autoplan T5: a failed send used to exist only as a log line — a parent
// silently never contacted, with nothing anyone could query afterwards.
describe("recording absence-alert failures (T5)", () => {
  beforeEach(() => {
    rec.mockRecord.mockReset();
    rec.mockRecord.mockResolvedValue(true);
    process.env.WHATSAPP_ALERTS_ENABLED = "true";
    vi.spyOn(whatsappService, "isConfigured").mockReturnValue(true);
  });

  afterEach(() => {
    delete process.env.WHATSAPP_ALERTS_ENABLED;
    vi.restoreAllMocks();
  });

  it("records one pointer for the failed send and none for the successful one", async () => {
    vi.spyOn(whatsappService, "sendMessage")
      .mockResolvedValueOnce({ success: true, messageId: "wa_ok" })
      .mockResolvedValueOnce({ success: false, error: "Graph API 131047" });

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

    expect(rec.mockRecord).toHaveBeenCalledTimes(1);
    expect(rec.mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 2,
        className: "5A",
        date: "2026-07-04",
        channel: "whatsapp",
        errorCode: "Graph API 131047",
        schoolCode: "SCH1",
      })
    );
  });

  it("stores a POINTER, never the parent's phone number or the message body", async () => {
    vi.spyOn(whatsappService, "sendMessage").mockResolvedValue({
      success: false,
      error: "unreachable",
    });

    await handleAttendanceMarked(
      event({
        className: "5A",
        date: "2026-07-04",
        absentees: [{ id: 7, name: "Rahul", parentPhone: "+919999999999" }],
      })
    );

    const recorded = JSON.stringify(rec.mockRecord.mock.calls[0][0]);
    expect(recorded).not.toContain("+919999999999");
    expect(recorded).not.toContain("Rahul");
    expect(recorded).not.toContain("marked absent");
  });

  it("distinguishes a send that threw from one that reported failure", async () => {
    vi.spyOn(whatsappService, "sendMessage").mockRejectedValue(new Error("network down"));
    await handleAttendanceMarked(
      event({
        className: "5A",
        date: "2026-07-04",
        absentees: [{ id: 3, name: "Asha", parentPhone: "+913333333333" }],
      })
    );
    expect(rec.mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: 3, errorCode: "send_threw" })
    );
  });

  it("still resolves when RECORDING the failure itself fails", async () => {
    // The event is acked either way. If recording could throw out of the
    // handler, a DB blip would leave the event pending and re-message every
    // parent whose send succeeded — once a minute, until the T13 cap.
    vi.spyOn(whatsappService, "sendMessage").mockResolvedValue({
      success: false,
      error: "unreachable",
    });
    rec.mockRecord.mockRejectedValue(new Error("connection terminated"));

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

  it("records nothing when every send succeeds", async () => {
    vi.spyOn(whatsappService, "sendMessage").mockResolvedValue({ success: true });
    await handleAttendanceMarked(
      event({
        className: "5A",
        date: "2026-07-04",
        absentees: [{ id: 1, name: "Rahul", parentPhone: "+911111111111" }],
      })
    );
    expect(rec.mockRecord).not.toHaveBeenCalled();
  });
});
