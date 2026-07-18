import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduleAtRiskChecks, automationQueue } from "../services/whatsapp-automation";
import { whatsappService } from "../services/whatsapp";
import { isPgReady, getPgPool } from "../db-pg";

vi.mock("../lib/pg-queries", () => ({
  pgFindUserById: vi.fn(),
}));

vi.mock("../services/whatsapp", () => ({
  whatsappService: {
    sendMessage: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../db-pg", () => ({
  isPgReady: vi.fn(),
  getPgPool: vi.fn(),
}));

// Override the global "Redis off" mock from setup.ts: this suite exercises
// the queue/worker paths, so pretend Redis is configured — bullmq itself is
// mocked below, so the connection object is never really used.
vi.mock("../lib/redis", () => ({
  BULLMQ_PREFIX: "{bull}",
  newRedisConnection: vi.fn().mockReturnValue({ on: vi.fn(), quit: vi.fn() }),
  isRedisConfigured: vi.fn().mockReturnValue(true),
  isRedisReady: vi.fn().mockReturnValue(true),
  getRedis: vi.fn().mockReturnValue(null),
  connectRedis: vi.fn().mockResolvedValue(undefined),
  getCachedJSON: vi.fn().mockResolvedValue(null),
  setCachedJSON: vi.fn().mockResolvedValue(undefined),
}));

const { workerProcess } = vi.hoisted(() => ({ workerProcess: { fn: null as any } }));

vi.mock("bullmq", () => {
  return {
    Queue: class {
      add = vi.fn();
    },
    Worker: class {
      constructor(name: string, processor: any) {
        workerProcess.fn = processor;
      }
      on = vi.fn();
    },
  };
});

describe("WhatsApp Automation Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("automationWorker processor", () => {
    it("processes missed_class job correctly", async () => {
      const { pgFindUserById } = await import("../lib/pg-queries");
      (pgFindUserById as any).mockResolvedValueOnce({ id: 1, parentId: 2, name: "Alice" });
      (pgFindUserById as any).mockResolvedValueOnce({ id: 2, username: "1234567890" });

      const job = {
        data: { type: "missed_class", userId: 1, metadata: { subject: "Science" } },
        id: "job1",
      };
      await workerProcess.fn(job);

      expect(whatsappService.sendMessage).toHaveBeenCalledWith({
        to: "1234567890",
        body: expect.stringContaining("missed the Science class today"),
      });
    });

    it("processes low_score job correctly", async () => {
      const { pgFindUserById } = await import("../lib/pg-queries");
      (pgFindUserById as any).mockResolvedValueOnce({ id: 1, parentId: 2, name: "Alice" });
      (pgFindUserById as any).mockResolvedValueOnce({ id: 2, username: "1234567890" });

      const job = {
        data: { type: "low_score", userId: 1, metadata: { subject: "Math", score: 35 } },
        id: "job2",
      };
      await workerProcess.fn(job);

      expect(whatsappService.sendMessage).toHaveBeenCalledWith({
        to: "1234567890",
        body: expect.stringContaining("scored 35% in the recent Math test"),
      });
    });

    it("processes inactivity job correctly", async () => {
      const { pgFindUserById } = await import("../lib/pg-queries");
      (pgFindUserById as any).mockResolvedValueOnce({ id: 1, parentId: 2, name: "Alice" });
      (pgFindUserById as any).mockResolvedValueOnce({ id: 2, username: "1234567890" });

      const job = { data: { type: "inactivity", userId: 1, metadata: {} }, id: "job3" };
      await workerProcess.fn(job);

      expect(whatsappService.sendMessage).toHaveBeenCalledWith({
        to: "1234567890",
        body: expect.stringContaining("hasn't logged in for 3 days"),
      });
    });

    it("returns early if no user or parent is found", async () => {
      const { pgFindUserById } = await import("../lib/pg-queries");
      (pgFindUserById as any).mockResolvedValueOnce(null);

      const job = { data: { type: "inactivity", userId: 1, metadata: {} }, id: "job4" };
      await workerProcess.fn(job);

      expect(whatsappService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("scheduleAtRiskChecks", () => {
    beforeEach(() => {
      // The scheduler self-gates on the master no-auto-send switch; these
      // tests exercise the behavior behind the gate.
      process.env.WHATSAPP_ALERTS_ENABLED = "true";
    });
    afterEach(() => {
      delete process.env.WHATSAPP_ALERTS_ENABLED;
    });

    it("does nothing unless WHATSAPP_ALERTS_ENABLED is explicitly 'true' (#335)", async () => {
      delete process.env.WHATSAPP_ALERTS_ENABLED;
      (isPgReady as any).mockReturnValue(true);
      await scheduleAtRiskChecks();
      // Redis + Meta creds alone must never start messaging parents.
      expect(getPgPool).not.toHaveBeenCalled();
      expect(automationQueue!.add).not.toHaveBeenCalled();
    });

    it("returns early if pg is not ready", async () => {
      (isPgReady as any).mockReturnValue(false);
      await scheduleAtRiskChecks();
      expect(getPgPool).not.toHaveBeenCalled();
    });

    it("adds jobs for inactive students and low scores", async () => {
      (isPgReady as any).mockReturnValue(true);
      const mockQuery = vi.fn().mockResolvedValue({ rows: [] });
      (getPgPool as any).mockReturnValue({ query: mockQuery });

      mockQuery.mockResolvedValueOnce({ rows: [{ id: "1", workspace_id: 1 }] }); // inactivity
      mockQuery.mockResolvedValueOnce({
        rows: [{ student_id: "2", subject: "Math", score: 30, total_marks: 100 }],
      }); // low score

      await scheduleAtRiskChecks();
      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(automationQueue.add).toHaveBeenCalledTimes(2);
    });
  });
});
