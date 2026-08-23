// The reliance metric is a teacher-facing judgement about a child, so the parts
// worth testing are the ones that could libel a student: hint-first ordering,
// the evidence floor, and the trend arrow.

import { describe, it, expect } from "vitest";
import {
  buildRelianceModel,
  relianceScore,
  MIN_GATES_FOR_INDEX,
  type RelianceGateRow,
} from "../services/study-arena/reliance-model";

function row(overrides: Partial<RelianceGateRow> = {}): RelianceGateRow {
  return {
    studentId: 1,
    studentName: "Asha",
    assignmentId: "a1",
    assignmentAt: "2026-08-01T00:00:00Z",
    gates: 4,
    attempts: 4,
    hints: 0,
    hintFirstGates: 0,
    assessed: true,
    transferCorrect: true,
    ...overrides,
  };
}

describe("relianceScore", () => {
  it("scores an unaided student at zero however many times they attempt", () => {
    expect(relianceScore({ gates: 4, attempts: 12, hints: 0, hintFirstGates: 0 })).toBe(0);
  });

  it("scores hint-before-attempt far above the same hints taken after trying", () => {
    const before = relianceScore({ gates: 4, attempts: 4, hints: 4, hintFirstGates: 4 });
    const after = relianceScore({ gates: 4, attempts: 4, hints: 4, hintFirstGates: 0 });
    expect(before).toBeGreaterThan(after);
    expect(before).toBe(1);
    expect(after).toBe(0.4);
  });

  it("does not let a hint-spamming student exceed the ceiling", () => {
    expect(relianceScore({ gates: 2, attempts: 1, hints: 40, hintFirstGates: 2 })).toBe(1);
  });
});

describe("buildRelianceModel", () => {
  it("withholds a score below the evidence floor instead of guessing", () => {
    const model = buildRelianceModel(
      [row({ gates: MIN_GATES_FOR_INDEX - 1, attempts: 1, hints: 2, hintFirstGates: 2 })],
      30
    );
    expect(model.students[0].reliance).toBeNull();
    expect(model.insufficientEvidence).toEqual([1]);
    expect(model.cohorts.find((c) => c.key === "high_help")).toBeUndefined();
  });

  it("keeps an unaided student out of the high-help cohort", () => {
    const model = buildRelianceModel([row({ attempts: 9 })], 30);
    expect(model.students[0].reliance).toBe(0);
    expect(model.cohorts.find((c) => c.key === "high_help")).toBeUndefined();
  });

  it("flags a student who opens hints before trying", () => {
    const model = buildRelianceModel(
      [row({ studentId: 2, studentName: "Ravi", hints: 4, hintFirstGates: 3 })],
      30
    );
    const cohort = model.cohorts.find((c) => c.key === "high_help");
    expect(cohort?.studentIds).toEqual([2]);
  });

  it("aggregates across assignments and trends on the last two scored ones", () => {
    const model = buildRelianceModel(
      [
        row({ assignmentId: "a1", assignmentAt: "2026-08-01T00:00:00Z" }),
        row({
          assignmentId: "a2",
          assignmentAt: "2026-08-08T00:00:00Z",
          hints: 4,
          hintFirstGates: 4,
        }),
      ],
      30
    );
    expect(model.students[0].assignments).toBe(2);
    expect(model.students[0].gates).toBe(8);
    expect(model.students[0].trend).toBe(1); // 0 → 1: got worse
  });

  it("ignores a thin assignment when trending", () => {
    const model = buildRelianceModel(
      [
        row({ assignmentId: "a1" }),
        row({ assignmentId: "a2", assignmentAt: "2026-08-05T00:00:00Z", gates: 1, attempts: 1 }),
      ],
      30
    );
    expect(model.students[0].trend).toBeNull();
  });

  it("separates failed transfer from reliance", () => {
    const model = buildRelianceModel(
      [row({ studentId: 3, transferCorrect: false })], // tried unaided, still could not do it
      30
    );
    expect(model.students[0].reliance).toBe(0);
    expect(model.cohorts.find((c) => c.key === "failed_transfer")?.studentIds).toEqual([3]);
    expect(model.cohorts.find((c) => c.key === "high_help")).toBeUndefined();
  });

  it("sorts the most reliant first so the teacher sees them without scrolling", () => {
    const model = buildRelianceModel(
      [
        row({ studentId: 1 }),
        row({ studentId: 2, hints: 4, hintFirstGates: 4 }),
        row({ studentId: 3, hints: 2, hintFirstGates: 1 }),
      ],
      30
    );
    expect(model.students.map((s) => s.studentId)).toEqual([2, 3, 1]);
  });
});

describe("buildRelianceModel follow-up target", () => {
  it("hangs follow-up on the most recent assignment in the window", () => {
    const model = buildRelianceModel(
      [
        row({ assignmentId: "older", assignmentAt: "2026-08-01T00:00:00Z" }),
        row({ assignmentId: "newest", assignmentAt: "2026-08-09T00:00:00Z" }),
      ],
      30
    );
    expect(model.students[0].latestAssignmentId).toBe("newest");
  });
});
