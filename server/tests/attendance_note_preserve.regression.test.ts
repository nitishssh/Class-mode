// Regression: ISSUE-002 — a status-only attendance re-save silently erased
// notes.
//
// Found by /qa on 2026-07-18 (branch w29-build-merge).
// Report: .gstack/qa-reports/qa-report-w29-build-merge-2026-07-18.md
//
// The web marking page (client/src/pages/attendance.tsx) tracks only `status`
// per student and POSTs { studentId, status } with no `note`. The upsert used
// `note = EXCLUDED.note`, so a routine re-save wrote NULL over a note entered
// elsewhere (the mobile app). The new Absentees call list DISPLAYS notes, so
// the loss was user-visible. Fix: `note = COALESCE(EXCLUDED.note,
// attendance.note)` — a note-less save preserves the existing note; a save
// that carries a note still updates it.
//
// This test drives the REAL pgMarkAttendance against a fake `attendance` store
// whose upsert honors the ACTUAL SQL the function issues (it inspects the note
// clause). Reverting to `note = EXCLUDED.note` makes the preservation case
// fail, which is the point.

import { vi, describe, it, expect, beforeEach } from "vitest";

// server/tests/setup.ts mocks every pg-queries export globally; unmock so the
// real upsert SQL is what's under test here.
vi.unmock("../lib/db/pg-queries");

type Row = {
  student_id: number;
  school_code: string | null;
  class_name: string | null;
  date: string;
  status: string;
  marked_by: number;
  note: string | null;
  updated_at: string;
};

let attendance: Row[] = [];

// Minimal fake for the one INSERT ... ON CONFLICT statement pgMarkAttendance
// issues. It emulates the conflict resolution by reading the SQL's note clause
// so the test is bound to the real query, not a hard-coded assumption.
// Autoplan T12: the claim and the outbox insert now run inside the SAME
// transaction as the marks, so the fake has to model them or every save looks
// like a replay.
let processedOps: { opId: string; userId: number }[] = [];
let outbox: { topic: string; payload: string }[] = [];

const queryMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
    return { rows: [] };
  }
  if (sql.includes("INSERT INTO processed_operations")) {
    const [opId, userId] = params as [string, number];
    const seen = processedOps.some((o) => o.opId === opId && o.userId === userId);
    if (seen) return { rows: [], rowCount: 0 }; // ON CONFLICT DO NOTHING
    processedOps.push({ opId, userId });
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("INSERT INTO event_outbox")) {
    const [topic, payload] = params as [string, string];
    outbox.push({ topic, payload });
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("INSERT INTO attendance")) {
    const preservesNote = /note\s*=\s*COALESCE\(EXCLUDED\.note,\s*attendance\.note\)/i.test(sql);
    const overwritesNote = /note\s*=\s*EXCLUDED\.note(?!\s*,\s*attendance)/i.test(sql);
    // Autoplan T10/T6: the statement now ends in RETURNING student_id, and the
    // route derives parent alerts and adoption tracking from those ids. Model it
    // here, bound to the real SQL like the note clause above, so a regression
    // that stops returning applied rows fails this test instead of silently
    // reporting zero applied and suppressing every side effect.
    const returnsApplied = /RETURNING\s+student_id/i.test(sql);
    const applied: { student_id: number }[] = [];
    // 8 bound params per VALUES row, in column order.
    for (let i = 0; i < params.length; i += 8) {
      const incoming: Row = {
        student_id: params[i] as number,
        school_code: (params[i + 1] as string) ?? null,
        class_name: (params[i + 2] as string) ?? null,
        date: params[i + 3] as string,
        status: params[i + 4] as string,
        marked_by: params[i + 5] as number,
        note: (params[i + 6] as string) ?? null,
        updated_at: params[i + 7] as string,
      };
      const existing = attendance.find(
        (r) => r.student_id === incoming.student_id && r.date === incoming.date
      );
      if (!existing) {
        attendance.push(incoming);
        applied.push({ student_id: incoming.student_id });
        continue;
      }
      // ON CONFLICT ... WHERE attendance.updated_at <= EXCLUDED.updated_at
      // A refused row is NOT returned by RETURNING — that is what makes it
      // "skipped" to the caller.
      if (existing.updated_at > incoming.updated_at) continue;
      applied.push({ student_id: incoming.student_id });
      existing.status = incoming.status;
      existing.marked_by = incoming.marked_by;
      existing.updated_at = incoming.updated_at;
      if (preservesNote) {
        existing.note = incoming.note ?? existing.note; // COALESCE semantics
      } else if (overwritesNote) {
        existing.note = incoming.note; // legacy EXCLUDED.note (the bug)
      }
    }
    return returnsApplied
      ? { rows: applied, rowCount: applied.length }
      : { rows: [], rowCount: applied.length };
  }
  return { rows: [] };
});

vi.mock("../db-pg", () => ({
  getPgPool: () => ({
    connect: async () => ({ query: queryMock, release: vi.fn() }),
  }),
  isPgReady: () => true,
  connectPostgres: vi.fn().mockResolvedValue(undefined),
  withPgClient: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> =>
    fn({ query: queryMock }),
}));

import { pgMarkAttendance } from "../lib/db/pg-queries";

describe("Regression ISSUE-002: attendance notes survive a status-only re-save", () => {
  beforeEach(() => {
    attendance = [];
    queryMock.mockClear();
  });

  it("preserves an existing note when the re-save carries no note", async () => {
    // A note lands first (e.g. from the mobile app): "fever".
    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [{ studentId: 4, status: "absent", note: "fever" }],
    });
    expect(attendance[0].note).toBe("fever");

    // The office re-saves the whole class from the web — status only, no note.
    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T04:00:00.000Z",
      markedBy: 3,
      marks: [{ studentId: 4, status: "absent" }],
    });

    // The note must NOT be wiped. (With the old `note = EXCLUDED.note` it was.)
    expect(attendance[0].note).toBe("fever");
    expect(attendance[0].status).toBe("absent");
  });

  it("still updates the note when a save actually carries one", async () => {
    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [{ studentId: 4, status: "absent", note: "fever" }],
    });

    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T05:00:00.000Z",
      markedBy: 3,
      marks: [{ studentId: 4, status: "absent", note: "admitted to hospital" }],
    });

    expect(attendance[0].note).toBe("admitted to hospital");
  });
});

describe("Autoplan T6/T10: pgMarkAttendance names which rows it applied", () => {
  beforeEach(() => {
    attendance = [];
    queryMock.mockClear();
  });

  it("returns every student on a fresh save", async () => {
    const result = await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [
        { studentId: 1, status: "present" },
        { studentId: 2, status: "absent" },
      ],
    });
    expect(result.written).toBe(2);
    expect(result.appliedIds.sort()).toEqual([1, 2]);
    expect(result.skippedIds).toEqual([]);
  });

  it("names the students a stale replay could not overwrite, not just the count", async () => {
    // The office corrects student 2 to present at 04:00.
    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T04:00:00.000Z",
      markedBy: 9,
      marks: [
        { studentId: 1, status: "present" },
        { studentId: 2, status: "present" },
      ],
    });

    // A teacher's phone, offline since 03:00, now flushes its older marking —
    // student 2 was absent when the phone captured it.
    const replay = await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [
        { studentId: 1, status: "present" },
        { studentId: 2, status: "absent" },
      ],
    });

    // Postgres refuses BOTH rows (both stored updated_at are newer).
    expect(replay.written).toBe(0);
    expect(replay.appliedIds).toEqual([]);
    // The point of T6: the caller can say WHICH students, not just "0 of 2".
    expect(replay.skippedIds.sort()).toEqual([1, 2]);

    // And the correction stands — the stale replay did not resurrect "absent".
    expect(attendance.find((r) => r.student_id === 2)?.status).toBe("present");
  });

  it("splits a partially-stale batch into applied and skipped", async () => {
    // Student 2 already has a newer mark; student 1 has none.
    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T05:00:00.000Z",
      markedBy: 9,
      marks: [{ studentId: 2, status: "present" }],
    });

    const mixed = await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [
        { studentId: 1, status: "absent" },
        { studentId: 2, status: "absent" },
      ],
    });

    expect(mixed.appliedIds).toEqual([1]);
    expect(mixed.skippedIds).toEqual([2]);
    // T10 depends on exactly this: student 2 is absent in the REQUEST but was
    // not applied, so no parent alert may be sent for them.
    expect(mixed.appliedIds).not.toContain(2);
  });

  it("reports a deduped duplicate studentId as applied, not skipped", async () => {
    // pg-queries dedupes by studentId (last wins) before the statement, so a
    // duplicate must not look like a refused row — that would make an offline
    // client retry a save the server fully accepted.
    const result = await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [
        { studentId: 1, status: "present" },
        { studentId: 1, status: "absent" },
      ],
    });
    expect(result.appliedIds).toEqual([1]);
    expect(result.skippedIds).toEqual([]);
  });
});

describe("Autoplan T12: the claim and the event commit with the marks", () => {
  beforeEach(() => {
    attendance = [];
    processedOps = [];
    outbox = [];
    queryMock.mockClear();
  });

  const save = (opts: { opId?: string; markedAt: string }) =>
    pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: opts.markedAt,
      markedBy: 3,
      marks: [{ studentId: 4, status: "absent" }],
      opId: opts.opId ?? null,
      outbox: {
        topic: "attendance.marked",
        payloadFor: (appliedIds) =>
          appliedIds.length > 0 ? { className: "10A", applied: appliedIds } : null,
      },
    });

  it("claims the opId and queues the event on a first save", async () => {
    const r = await save({ opId: "op-1", markedAt: "2026-07-18T03:00:00.000Z" });
    expect(r.sideEffectsFresh).toBe(true);
    expect(processedOps).toHaveLength(1);
    expect(outbox).toHaveLength(1);
    expect(JSON.parse(outbox[0].payload)).toEqual({ className: "10A", applied: [4] });
  });

  it("queues NO event when the same opId is replayed", async () => {
    await save({ opId: "op-1", markedAt: "2026-07-18T03:00:00.000Z" });
    outbox = [];
    const replay = await save({ opId: "op-1", markedAt: "2026-07-18T03:00:00.000Z" });

    expect(replay.sideEffectsFresh).toBe(false);
    // The whole point: a replay cannot re-message the parent, because no event
    // is queued at all.
    expect(outbox).toHaveLength(0);
  });

  it("treats a save with no opId as always fresh (legacy and online saves)", async () => {
    const r = await save({ markedAt: "2026-07-18T03:00:00.000Z" });
    expect(r.sideEffectsFresh).toBe(true);
    expect(processedOps).toHaveLength(0);
    expect(outbox).toHaveLength(1);
  });

  it("queues nothing when the payload builder declines", async () => {
    // A save with no applicable absentee must not put an empty event on the bus.
    await pgMarkAttendance({
      schoolCode: "PILOT01",
      className: "10A",
      date: "2026-07-18",
      markedAt: "2026-07-18T03:00:00.000Z",
      markedBy: 3,
      marks: [{ studentId: 4, status: "present" }],
      opId: "op-2",
      outbox: { topic: "attendance.marked", payloadFor: () => null },
    });
    expect(processedOps).toHaveLength(1);
    expect(outbox).toHaveLength(0);
  });

  it("builds the event from APPLIED ids, so a refused row is never announced", async () => {
    // A newer mark already exists, so this save applies nothing.
    await save({ opId: "op-newer", markedAt: "2026-07-18T09:00:00.000Z" });
    outbox = [];
    await save({ opId: "op-stale", markedAt: "2026-07-18T03:00:00.000Z" });
    // Applied nothing → payloadFor returned null → no event.
    expect(outbox).toHaveLength(0);
  });
});
