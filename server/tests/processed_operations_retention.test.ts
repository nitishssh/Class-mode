import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  mockPurge: vi.fn(),
  mockPurgeFailures: vi.fn(),
  mockError: vi.fn(),
  mockInfo: vi.fn(),
}));

vi.mock("../lib/db/pg-queries", () => ({
  pgPurgeProcessedOperations: h.mockPurge,
  pgPurgeNotificationFailures: h.mockPurgeFailures,
}));
vi.mock("../lib/logger", () => ({
  logger: { error: h.mockError, info: h.mockInfo, warn: vi.fn(), debug: vi.fn() },
}));

import { MAX_BACKFILL_DAYS } from "../routes/attendance";
import {
  PROCESSED_OPS_RETENTION_DAYS,
  RETENTION_SAFETY_MARGIN_DAYS,
  purgeExpiredOperations,
} from "../services/processed-operations-retention";

beforeEach(() => {
  h.mockPurge.mockReset();
  h.mockPurgeFailures.mockReset();
  h.mockPurgeFailures.mockResolvedValue(0);
  h.mockError.mockReset();
  h.mockInfo.mockReset();
});

describe("processed_operations retention window", () => {
  it("outlives the window in which a replay can still be accepted", () => {
    // pgClaimOperation fails OPEN: a purged op_id looks like one never seen, so
    // purging inside the replay window re-fires parent alerts and re-counts a
    // marking day. This is the invariant that makes the purge safe.
    expect(PROCESSED_OPS_RETENTION_DAYS).toBeGreaterThan(MAX_BACKFILL_DAYS);
    expect(RETENTION_SAFETY_MARGIN_DAYS).toBeGreaterThan(0);
  });

  it("keeps a wide margin, not a hair's breadth", () => {
    // A phone left in a drawer over a holiday must not outlive the memory of
    // its own queued save.
    expect(RETENTION_SAFETY_MARGIN_DAYS).toBeGreaterThanOrEqual(14);
  });

  it("passes the derived window to the delete", async () => {
    h.mockPurge.mockResolvedValue(0);
    await purgeExpiredOperations();
    expect(h.mockPurge).toHaveBeenCalledWith({ retentionDays: PROCESSED_OPS_RETENTION_DAYS });
  });

  it("logs how many rows it removed when it removes any", async () => {
    h.mockPurge.mockResolvedValue(42);
    expect(await purgeExpiredOperations()).toBe(42);
    expect(h.mockInfo).toHaveBeenCalledWith(
      "[retention] purged processed_operations",
      expect.objectContaining({ deleted: 42 })
    );
  });

  it("stays quiet when there was nothing to purge", async () => {
    h.mockPurge.mockResolvedValue(0);
    await purgeExpiredOperations();
    expect(h.mockInfo).not.toHaveBeenCalled();
  });

  it("never throws out of the background timer — a failed purge is not a broken register", async () => {
    h.mockPurge.mockRejectedValue(new Error("connection terminated"));
    await expect(purgeExpiredOperations()).resolves.toBe(0);
    expect(h.mockError).toHaveBeenCalledWith(
      "[retention] processed_operations purge failed",
      expect.objectContaining({ err: expect.stringContaining("connection terminated") })
    );
  });
});

describe("notification_failures share the same window (T5)", () => {
  it("expires failure pointers on the same schedule", async () => {
    h.mockPurge.mockResolvedValue(0);
    h.mockPurgeFailures.mockResolvedValue(0);
    await purgeExpiredOperations();
    expect(h.mockPurgeFailures).toHaveBeenCalledWith(PROCESSED_OPS_RETENTION_DAYS);
  });

  it("reports how many failure pointers it removed", async () => {
    h.mockPurge.mockResolvedValue(0);
    h.mockPurgeFailures.mockResolvedValue(7);
    await purgeExpiredOperations();
    expect(h.mockInfo).toHaveBeenCalledWith(
      "[retention] purged notification_failures",
      expect.objectContaining({ deleted: 7 })
    );
  });
});
