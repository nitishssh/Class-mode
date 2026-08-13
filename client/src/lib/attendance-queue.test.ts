import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  attendanceQueueDb,
  classifyFailure,
  drainQueue,
  enqueueSave,
  getPending,
  getQueued,
  markFailed,
  ownerToken,
  purgeOwner,
  queueKey,
  syncRecord,
  type PostResult,
} from "./attendance-queue";

const OWNER = ownerToken(10, "SCHOOL123");

function sampleInput(over: Partial<Parameters<typeof enqueueSave>[0]> = {}) {
  return {
    owner: OWNER,
    opId: "op-1",
    className: "Grade 10",
    date: "2026-08-13",
    markedAt: "2026-08-13T04:30:00.000Z",
    marks: [{ studentId: 1, status: "present" as const }],
    ...over,
  };
}

const okPoster = async (): Promise<PostResult> => ({ ok: true });
const offlinePoster = async (): Promise<PostResult> => ({ ok: false, error: "network" });
const rejectedPoster = async (): Promise<PostResult> => ({ ok: false, status: 400, error: "too old" });

describe("attendance-queue", () => {
  beforeEach(async () => {
    await attendanceQueueDb.saves.clear();
  });

  describe("classifyFailure (T9)", () => {
    it("treats validation/authorization statuses as permanent", () => {
      expect(classifyFailure(400)).toBe("failed");
      expect(classifyFailure(403)).toBe("failed");
      expect(classifyFailure(422)).toBe("failed");
    });
    it("treats offline / server errors / unknown as transient", () => {
      expect(classifyFailure(undefined)).toBe("retry");
      expect(classifyFailure(500)).toBe("retry");
      expect(classifyFailure(408)).toBe("retry");
      expect(classifyFailure(429)).toBe("retry");
    });
  });

  describe("enqueueSave / getQueued", () => {
    it("persists and reads back the pending save for a class-day", async () => {
      await enqueueSave(sampleInput());
      const rec = await getQueued(OWNER, "Grade 10", "2026-08-13");
      expect(rec?.status).toBe("pending");
      expect(rec?.opId).toBe("op-1");
      expect(rec?.marks).toHaveLength(1);
    });

    it("coalesces a re-edit of the same class-day into one record (latest wins)", async () => {
      await enqueueSave(sampleInput({ opId: "op-1", marks: [{ studentId: 1, status: "present" }] }));
      await enqueueSave(sampleInput({ opId: "op-2", marks: [{ studentId: 1, status: "absent" }] }));
      const all = await attendanceQueueDb.saves.where("owner").equals(OWNER).toArray();
      expect(all).toHaveLength(1);
      expect(all[0].opId).toBe("op-2");
      expect(all[0].marks[0].status).toBe("absent");
    });
  });

  describe("syncRecord", () => {
    it("removes the record from the queue on success", async () => {
      const rec = await enqueueSave(sampleInput());
      const { outcome, written } = await syncRecord(rec, okPoster);
      expect(outcome).toBe("synced");
      expect(written).toBeUndefined(); // okPoster returns no written count
      expect(await getQueued(OWNER, "Grade 10", "2026-08-13")).toBeUndefined();
    });

    it("keeps the record pending and bumps attempts on a transient failure", async () => {
      const rec = await enqueueSave(sampleInput());
      const { outcome } = await syncRecord(rec, offlinePoster);
      expect(outcome).toBe("retry");
      const after = await getQueued(OWNER, "Grade 10", "2026-08-13");
      expect(after?.status).toBe("pending");
      expect(after?.attempts).toBe(1);
      expect(after?.lastError).toContain("network");
    });

    it("marks the record failed (terminal) on a permanent rejection", async () => {
      const rec = await enqueueSave(sampleInput());
      const { outcome } = await syncRecord(rec, rejectedPoster);
      expect(outcome).toBe("failed");
      const after = await getQueued(OWNER, "Grade 10", "2026-08-13");
      expect(after?.status).toBe("failed");
    });

    it("treats a thrown poster as transient (never loses the record)", async () => {
      const rec = await enqueueSave(sampleInput());
      const throwing = async (): Promise<PostResult> => {
        throw new Error("boom");
      };
      const { outcome } = await syncRecord(rec, throwing);
      expect(outcome).toBe("retry");
      expect((await getQueued(OWNER, "Grade 10", "2026-08-13"))?.status).toBe("pending");
    });
  });

  describe("drainQueue", () => {
    it("only drains pending records, skipping terminal failures", async () => {
      await enqueueSave(sampleInput({ opId: "a", date: "2026-08-13" }));
      const failedRec = await enqueueSave(sampleInput({ opId: "b", date: "2026-08-12" }));
      await markFailed(failedRec.key, failedRec.opId, "rejected");
      expect(await getPending(OWNER)).toHaveLength(1);

      const summary = await drainQueue(OWNER, okPoster);
      expect(summary.synced).toBe(1);
      // the failed one is untouched, the pending one drained
      expect(await getQueued(OWNER, "Grade 10", "2026-08-13")).toBeUndefined();
      expect((await getQueued(OWNER, "Grade 10", "2026-08-12"))?.status).toBe("failed");
    });

    it("fires onRecovered only for a record that had failed before and now synced (T7)", async () => {
      const rec = await enqueueSave(sampleInput());
      // First attempt fails (offline) → attempts becomes 1, still pending.
      await syncRecord(rec, offlinePoster);
      const onRecovered = vi.fn();
      const summary = await drainQueue(OWNER, okPoster, onRecovered);
      expect(summary.synced).toBe(1);
      expect(onRecovered).toHaveBeenCalledTimes(1);
    });

    it("does NOT fire onRecovered for a first-try success", async () => {
      await enqueueSave(sampleInput());
      const onRecovered = vi.fn();
      await drainQueue(OWNER, okPoster, onRecovered);
      expect(onRecovered).not.toHaveBeenCalled();
    });
  });

  describe("purgeOwner (T8 isolation)", () => {
    it("removes only the given owner's records, leaving other accounts intact", async () => {
      const other = ownerToken(99, "SCHOOL999");
      await enqueueSave(sampleInput({ owner: OWNER, opId: "mine" }));
      await enqueueSave(sampleInput({ owner: other, opId: "theirs", className: "Grade 9" }));

      await purgeOwner(OWNER);

      expect(await attendanceQueueDb.saves.where("owner").equals(OWNER).count()).toBe(0);
      expect(await attendanceQueueDb.saves.where("owner").equals(other).count()).toBe(1);
    });
  });

  describe("queueKey / ownerToken", () => {
    it("namespaces the key by owner, class, and date", () => {
      expect(queueKey(OWNER, "Grade 10", "2026-08-13")).toBe("10:SCHOOL123|Grade 10|2026-08-13");
    });
    it("distinguishes anonymous and school-less owners", () => {
      expect(ownerToken(null, null)).toBe("anon:none");
      expect(ownerToken(5, null)).toBe("5:none");
    });
  });
});
