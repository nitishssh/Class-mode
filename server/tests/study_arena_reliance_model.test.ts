// The reliance metric is a teacher-facing judgement about a child, so the parts
// worth testing are the ones that could libel a student: hint-first ordering,
// the evidence floor, and the trend arrow.

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
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
    concept: "linear-equations",
    pMastery: 0.8,
    repetitions: 0,
    reviewDueAt: null,
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

// The aggregation above is pure, but two properties live in SQL the unit tests
// cannot reach. Both were caught by running the query against a seeded database
// (scripts/qa-study-arena-reliance-fixture.sql); these assertions stop a future
// edit from silently dropping them.
describe("reliance query shape", () => {
  const source = readFileSync(
    new URL("../services/study-arena/reliance-model.ts", import.meta.url),
    "utf8"
  );

  it("excludes teacher preview sessions from learner evidence", () => {
    expect(source).toContain("s.is_preview = false");
  });

  it("scopes every read to one workspace", () => {
    expect(source).toContain("e.workspace_id = $1");
  });
});

// Phase 2: the two cohort keys the interventions endpoint has always accepted
// but nothing ever produced.
describe("diagnostic cohorts", () => {
  it("calls a failed transfer with weak mastery a prerequisite gap, not a crutch", () => {
    const model = buildRelianceModel(
      [row({ studentId: 5, transferCorrect: false, pMastery: 0.2 })],
      30
    );
    expect(model.students[0].prerequisiteGapConcepts).toEqual(["linear-equations"]);
    expect(model.cohorts.find((c) => c.key === "prerequisite_gap")?.studentIds).toEqual([5]);
  });

  it("does not list the same student under both prerequisite gap and failed transfer", () => {
    const model = buildRelianceModel(
      [
        row({ studentId: 5, transferCorrect: false, pMastery: 0.2 }),
        row({ studentId: 6, assignmentId: "a2", transferCorrect: false, pMastery: 0.9 }),
      ],
      30
    );
    expect(model.cohorts.find((c) => c.key === "prerequisite_gap")?.studentIds).toEqual([5]);
    expect(model.cohorts.find((c) => c.key === "failed_transfer")?.studentIds).toEqual([6]);
  });

  it("does not call a failed transfer a prerequisite gap when mastery is unknown", () => {
    const model = buildRelianceModel(
      [row({ studentId: 7, transferCorrect: false, pMastery: null })],
      30
    );
    expect(model.students[0].prerequisiteGapConcepts).toEqual([]);
    expect(model.cohorts.find((c) => c.key === "failed_transfer")?.studentIds).toEqual([7]);
  });

  it("flags a mastered concept whose review has come due", () => {
    const model = buildRelianceModel(
      [
        row({
          studentId: 8,
          pMastery: 0.9,
          repetitions: 2,
          reviewDueAt: "2026-01-01T00:00:00Z",
        }),
      ],
      30
    );
    expect(model.students[0].recallOverdueConcepts).toEqual(["linear-equations"]);
    expect(model.cohorts.find((c) => c.key === "recall_overdue")?.studentIds).toEqual([8]);
  });

  it("leaves a not-yet-due review alone", () => {
    const model = buildRelianceModel(
      [
        row({
          studentId: 9,
          pMastery: 0.9,
          repetitions: 2,
          reviewDueAt: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ],
      30
    );
    expect(model.cohorts.find((c) => c.key === "recall_overdue")).toBeUndefined();
  });

  it("does not call a never-reviewed concept overdue", () => {
    const model = buildRelianceModel(
      [row({ studentId: 10, pMastery: 0.9, repetitions: 0, reviewDueAt: "2026-01-01T00:00:00Z" })],
      30
    );
    expect(model.students[0].recallOverdueConcepts).toEqual([]);
  });

  it("names each distinct concept once", () => {
    const model = buildRelianceModel(
      [
        row({ studentId: 11, transferCorrect: false, pMastery: 0.1, concept: "fractions" }),
        row({
          studentId: 11,
          assignmentId: "a2",
          transferCorrect: false,
          pMastery: 0.1,
          concept: "fractions",
        }),
        row({
          studentId: 11,
          assignmentId: "a3",
          transferCorrect: false,
          pMastery: 0.1,
          concept: "decimals",
        }),
      ],
      30
    );
    expect(model.students[0].prerequisiteGapConcepts).toEqual(["fractions", "decimals"]);
  });
});
