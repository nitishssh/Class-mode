/**
 * Regression: ISSUE-001 — bigint student_id compared against a JS number.
 * Found by /qa on 2026-08-06.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-08-06.md
 *
 * node-postgres returns `bigint` columns as STRINGS. The session-ownership
 * checks compared `session.student_id !== input.studentId`, i.e. "7" !== 7,
 * which is always true — so every student-facing Study Arena call returned
 * `forbidden` and the assigned attempt-first flow was dead for every learner.
 *
 * The pre-existing suite missed this because its fixtures set
 * `student_id: STUDENT_ID` as a NUMBER, which the real driver never returns.
 * These tests pin the driver-accurate STRING form.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import type { LessonScript } from "../services/study-arena/lesson-script";

const h = vi.hoisted(() => ({
  pgReady: true,
  resolveNextScene: vi.fn(),
  evaluateAssessment: vi.fn(),
  applyLearnerUpdateInTransaction: vi.fn(),
}));

const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const ASSIGNMENT_ID = "33333333-3333-4333-8333-333333333333";
const LESSON_VERSION_ID = "55555555-5555-4555-8555-555555555555";
const STUDENT_ID = 7;
const OTHER_STUDENT_ID = 99;

const validScript: LessonScript = {
  topic: "Linear equations",
  conceptIds: ["linear-equations-isolation"],
  primaryConceptId: "linear-equations-isolation",
  scenes: [
    {
      id: "check",
      actions: [
        {
          type: "ask",
          agent: "teacher",
          prompt: "Solve for x",
          expects: "freeText",
          gate: true,
        },
      ],
    },
  ],
};

let attemptSession: Record<string, unknown> | undefined;

const queryMock = vi.fn(async (sql: string) => {
  if (sql.includes("FROM study_arena_attempt_sessions s") && sql.includes("FOR UPDATE")) {
    return { rows: attemptSession ? [attemptSession] : [] };
  }
  if (sql.includes("UPDATE study_arena_attempt_sessions")) return { rows: [] };
  return { rows: [] };
});

const poolQueryMock = vi.fn(async (sql: string) => {
  if (sql.includes("FROM study_arena_attempt_sessions") && !sql.includes("FOR UPDATE")) {
    return { rows: attemptSession ? [attemptSession] : [] };
  }
  return { rows: [] };
});

vi.mock("../db-pg", () => ({
  getPgPool: () => ({
    connect: async () => ({ query: queryMock, release: vi.fn() }),
    query: poolQueryMock,
  }),
  isPgReady: () => h.pgReady,
  connectPostgres: vi.fn().mockResolvedValue(undefined),
  withPgClient: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> =>
    fn({ query: queryMock }),
}));

vi.mock("../services/study-arena/scene-director", () => ({
  resolveNextScene: h.resolveNextScene,
}));

vi.mock("../services/study-arena/assessment-evaluators", () => ({
  evaluateAssessment: h.evaluateAssessment,
}));

vi.mock("../lib/ai/learner-model", () => ({
  applyLearnerUpdateInTransaction: h.applyLearnerUpdateInTransaction,
}));

import {
  getAssignedNextSegment,
  checkAssignedAction,
} from "../services/study-arena/assignment-sessions";

/** Mirrors what node-postgres actually returns: bigint -> string. */
function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    assignment_id: ASSIGNMENT_ID,
    student_id: String(STUDENT_ID), // <- the driver-accurate form
    lesson_version_id: LESSON_VERSION_ID,
    status: "active",
    next_action_index: 0,
    current_scene_id: "check",
    completed_scene_ids: [] as string[],
    branch_path: [] as string[],
    director_decision: {},
    director_decision_version: 0,
    script: validScript,
    is_preview: false,
    ...overrides,
  };
}

describe("bigint student_id ownership checks (ISSUE-001)", () => {
  beforeEach(() => {
    attemptSession = undefined;
    h.pgReady = true;
    queryMock.mockClear();
    poolQueryMock.mockClear();
    h.resolveNextScene.mockReturnValue({
      fromSceneId: null,
      toSceneId: "check",
      terminal: false,
      rationale: "declared_entry_scene",
      transitionIndex: null,
    });
  });

  it("getAssignedNextSegment admits the owner when student_id arrives as a string", async () => {
    attemptSession = sessionRow();
    const result = await getAssignedNextSegment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
    });
    expect(result.status).toBe("ready");
  });

  it("checkAssignedAction admits the owner when student_id arrives as a string", async () => {
    attemptSession = sessionRow();
    const result = await checkAssignedAction({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "ok" });
  });

  it("still forbids a different student when ids arrive as strings", async () => {
    attemptSession = sessionRow({ student_id: String(OTHER_STUDENT_ID) });
    const result = await getAssignedNextSegment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
    });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("does not treat a numeric-prefix id as the owner (no loose ==)", async () => {
    // "70" must never match 7; guards against a `==` style fix.
    attemptSession = sessionRow({ student_id: "70" });
    const result = await getAssignedNextSegment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
    });
    expect(result).toEqual({ status: "forbidden" });
  });
});
