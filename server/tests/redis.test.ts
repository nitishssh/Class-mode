import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("../lib/redis");

const fakeState = vi.hoisted(() => ({
  available: true,
  connectCalls: 0,
}));

vi.mock("ioredis", () => ({
  default: class FakeRedis {
    status = "wait";
    private handlers = new Map<string, Array<() => void>>();

    on(event: string, callback: () => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
      return this;
    }

    async connect() {
      fakeState.connectCalls += 1;
      if (!fakeState.available) {
        this.status = "end";
        throw new Error("Redis unavailable");
      }
      this.status = "ready";
      for (const callback of this.handlers.get("ready") ?? []) callback();
    }

    async ping() {
      return "PONG";
    }

    disconnect() {
      this.status = "end";
    }

    async get() {
      return null;
    }

    async setex() {
      return "OK";
    }
  },
}));

describe("Redis readiness manager", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    fakeState.available = true;
    fakeState.connectCalls = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("connects once and notifies ready listeners", async () => {
    const redis = await import("../lib/redis");
    const onReady = vi.fn();
    redis.onRedisReady(onReady);

    await expect(redis.connectRedis()).resolves.toBe(true);

    expect(redis.isRedisReady()).toBe(true);
    expect(fakeState.connectCalls).toBe(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("degrades quietly and notifies listeners after recovery", async () => {
    fakeState.available = false;
    const redis = await import("../lib/redis");
    const onReady = vi.fn();
    redis.onRedisReady(onReady);

    await expect(redis.connectRedis()).resolves.toBe(false);
    expect(redis.isRedisReady()).toBe(false);
    expect(onReady).not.toHaveBeenCalled();

    fakeState.available = true;
    await vi.advanceTimersByTimeAsync(30_000);

    expect(redis.isRedisReady()).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(fakeState.connectCalls).toBe(2);
  });
});
