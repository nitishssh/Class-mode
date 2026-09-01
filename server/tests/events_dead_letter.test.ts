import { describe, it, expect } from "vitest";
import { shouldDeadLetter, deadLetterFields, MAX_DELIVERY_ATTEMPTS } from "../lib/events";

// Autoplan T13: before this, a handler that threw left its entry pending and
// XAUTOCLAIM reclaimed it every ~60s forever. For notifications-consumer that
// meant every parent whose message already sent got it again, once a minute.

describe("shouldDeadLetter", () => {
  it("retries while the entry still has delivery budget", () => {
    for (let n = 0; n < MAX_DELIVERY_ATTEMPTS; n++) {
      expect(shouldDeadLetter(n)).toBe(false);
    }
  });

  it("parks the entry once the budget is spent", () => {
    expect(shouldDeadLetter(MAX_DELIVERY_ATTEMPTS)).toBe(true);
    expect(shouldDeadLetter(MAX_DELIVERY_ATTEMPTS + 100)).toBe(true);
  });

  it("gives transient faults real room before giving up", () => {
    // Reclaim is ~60s, so the budget must span minutes of a DB blip, not seconds.
    expect(MAX_DELIVERY_ATTEMPTS).toBeGreaterThanOrEqual(3);
    // ...but not so long that a poison pill hurts for an hour.
    expect(MAX_DELIVERY_ATTEMPTS).toBeLessThanOrEqual(10);
  });

  it("honours an explicit cap", () => {
    expect(shouldDeadLetter(2, 3)).toBe(false);
    expect(shouldDeadLetter(3, 3)).toBe(true);
  });
});

describe("deadLetterFields", () => {
  const fields = deadLetterFields({
    topic: "attendance.marked",
    id: "1720000000000-0",
    raw: '{"topic":"attendance.marked","payload":{"className":"5A"}}',
    deliveries: 5,
    reason: "delivery budget exhausted",
  });

  const asMap = () => {
    const m = new Map<string, string>();
    for (let i = 0; i < fields.length; i += 2) m.set(fields[i], fields[i + 1]);
    return m;
  };

  it("emits an even-length field list, as XADD requires", () => {
    expect(fields.length % 2).toBe(0);
  });

  it("keeps the original payload verbatim so the event can be replayed by hand", () => {
    expect(asMap().get("event")).toContain('"className":"5A"');
  });

  it("records why it was parked and how many times it was tried", () => {
    const m = asMap();
    expect(m.get("reason")).toBe("delivery budget exhausted");
    expect(m.get("deliveries")).toBe("5");
    expect(m.get("originalId")).toBe("1720000000000-0");
    expect(m.get("topic")).toBe("attendance.marked");
    expect(m.get("deadLetteredAt")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
