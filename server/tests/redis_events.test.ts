import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Use the REAL redis/events modules (setup.ts mocks lib/redis globally) so
// the "Redis not configured" degradation surface is what's actually tested.
vi.unmock("../lib/redis");

const h = vi.hoisted(() => ({ mockSend: vi.fn() }));
vi.mock("../services/whatsapp", () => ({
  whatsappService: { sendMessage: h.mockSend },
}));

import {
  isRedisConfigured,
  isRedisReady,
  getRedis,
  newRedisConnection,
  getCachedJSON,
  setCachedJSON,
  connectRedis,
} from "../lib/redis";
import { publishEvent, subscribe } from "../lib/events";
import {
  handleAttendanceMarked,
  absenceMessage,
  startNotificationConsumers,
} from "../services/notifications-consumer";

describe("redis lib with REDIS_URL unset (graceful degradation)", () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  it("reports not configured / not ready and returns no clients", () => {
    expect(isRedisConfigured()).toBe(false);
    expect(isRedisReady()).toBe(false);
    expect(getRedis()).toBeNull();
    expect(newRedisConnection("test")).toBeNull();
  });

  it("connectRedis and cache helpers are safe no-ops", async () => {
    await expect(connectRedis()).resolves.toBeUndefined();
    await expect(getCachedJSON("k")).resolves.toBeNull();
    await expect(setCachedJSON("k", { a: 1 })).resolves.toBeUndefined();
  });
});

describe("event bus with Redis off", () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  it("publishEvent is a silent no-op", () => {
    expect(() =>
      publishEvent("attendance.marked", { schoolCode: "S1", payload: { absentees: [] } })
    ).not.toThrow();
  });

  it("subscribe declines to start and reports it", () => {
    const started = subscribe({
      topic: "attendance.marked",
      group: "test",
      handler: async () => {},
    });
    expect(started).toBe(false);
    expect(startNotificationConsumers()).toBe(false);
  });
});

describe("handleAttendanceMarked (the durable consumer's handler)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The consumer self-gates on the master switch at delivery time.
    process.env.WHATSAPP_ALERTS_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.WHATSAPP_ALERTS_ENABLED;
  });

  const event = {
    topic: "attendance.marked" as const,
    at: new Date().toISOString(),
    schoolCode: "SCHOOL123",
    payload: {
      className: "Grade 10",
      date: "2026-07-03",
      absentees: [
        { id: 1, name: "Asha", parentPhone: "+919876543210" },
        { id: 2, name: "Ravi", parentPhone: "+919812345678" },
      ],
    },
  };

  it("sends one WhatsApp alert per absentee", async () => {
    h.mockSend.mockResolvedValue({ success: true });
    await handleAttendanceMarked(event);
    expect(h.mockSend).toHaveBeenCalledTimes(2);
    expect(h.mockSend).toHaveBeenCalledWith({
      to: "+919876543210",
      body: absenceMessage("Asha", "2026-07-03", "Grade 10"),
    });
  });

  it("does not throw when sends fail (acks anyway — no redelivery storm)", async () => {
    h.mockSend.mockResolvedValue({ success: false, error: "meta down" });
    await expect(handleAttendanceMarked(event)).resolves.toBeUndefined();
  });

  it("no-ops on an empty absentee list", async () => {
    await handleAttendanceMarked({ ...event, payload: { ...event.payload, absentees: [] } });
    expect(h.mockSend).not.toHaveBeenCalled();
  });
});
