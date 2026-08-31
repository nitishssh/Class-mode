import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  fetch: vi.fn(),
  markDispatched: vi.fn(),
  publish: vi.fn(),
  redisOn: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../lib/db/pg-queries", () => ({
  pgFetchUndispatchedOutbox: h.fetch,
  pgMarkOutboxDispatched: h.markDispatched,
}));
vi.mock("../lib/events", () => ({ publishEvent: h.publish }));
vi.mock("../lib/db/redis", () => ({ isRedisConfigured: h.redisOn }));
vi.mock("../lib/logger", () => ({
  logger: { error: h.error, warn: h.warn, info: h.info, debug: vi.fn() },
}));

import { dispatchOutboxOnce } from "../services/outbox-dispatcher";

const row = (id: string) => ({
  id,
  topic: "attendance.marked",
  payload: { className: "5A", date: "2026-07-04", absentees: [] },
  schoolCode: "SCH1",
  userId: 3,
});

beforeEach(() => {
  Object.values(h).forEach((m) => m.mockReset());
  h.redisOn.mockReturnValue(true);
  h.markDispatched.mockResolvedValue(0);
});

describe("outbox dispatcher", () => {
  it("publishes each committed event and stamps it dispatched", async () => {
    h.fetch.mockResolvedValue([row("1"), row("2")]);
    expect(await dispatchOutboxOnce()).toBe(2);
    expect(h.publish).toHaveBeenCalledTimes(2);
    expect(h.markDispatched).toHaveBeenCalledWith(["1", "2"]);
  });

  it("does nothing when Redis is off — there is no bus to publish to", async () => {
    h.redisOn.mockReturnValue(false);
    expect(await dispatchOutboxOnce()).toBe(0);
    expect(h.fetch).not.toHaveBeenCalled();
  });

  it("leaves a row unstamped when its publish throws, so the next tick retries", async () => {
    h.fetch.mockResolvedValue([row("1"), row("2")]);
    h.publish.mockImplementationOnce(() => {
      throw new Error("redis down");
    });
    expect(await dispatchOutboxOnce()).toBe(1);
    // Only the one that actually published is stamped.
    expect(h.markDispatched).toHaveBeenCalledWith(["2"]);
  });

  it("stamps nothing when every publish fails", async () => {
    h.fetch.mockResolvedValue([row("1")]);
    h.publish.mockImplementation(() => {
      throw new Error("redis down");
    });
    expect(await dispatchOutboxOnce()).toBe(0);
    expect(h.markDispatched).not.toHaveBeenCalled();
  });

  it("never throws out of the timer when the fetch itself fails", async () => {
    h.fetch.mockRejectedValue(new Error("connection terminated"));
    await expect(dispatchOutboxOnce()).resolves.toBe(0);
    expect(h.error).toHaveBeenCalledWith(
      "[outbox] dispatch pass failed",
      expect.objectContaining({ err: expect.stringContaining("connection terminated") })
    );
  });

  it("is quiet and cheap when the outbox is empty", async () => {
    h.fetch.mockResolvedValue([]);
    expect(await dispatchOutboxOnce()).toBe(0);
    expect(h.publish).not.toHaveBeenCalled();
    expect(h.markDispatched).not.toHaveBeenCalled();
    expect(h.info).not.toHaveBeenCalled();
  });
});
