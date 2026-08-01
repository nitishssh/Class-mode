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
const queryMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
    return { rows: [] };
  }
  if (sql.includes("INSERT INTO attendance")) {
    const preservesNote = /note\s*=\s*COALESCE\(EXCLUDED\.note,\s*attendance\.note\)/i.test(sql);
    const overwritesNote = /note\s*=\s*EXCLUDED\.note(?!\s*,\s*attendance)/i.test(sql);
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
        continue;
      }
      // ON CONFLICT ... WHERE attendance.updated_at <= EXCLUDED.updated_at
      if (existing.updated_at > incoming.updated_at) continue;
      existing.status = incoming.status;
      existing.marked_by = incoming.marked_by;
      existing.updated_at = incoming.updated_at;
      if (preservesNote) {
        existing.note = incoming.note ?? existing.note; // COALESCE semantics
      } else if (overwritesNote) {
        existing.note = incoming.note; // legacy EXCLUDED.note (the bug)
      }
    }
    return { rows: [] };
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
