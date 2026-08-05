import { vi, describe, it, expect, beforeEach } from "vitest";
import { createHash } from "crypto";
import type { LessonScript } from "../services/study-arena/lesson-script";

const h = vi.hoisted(() => ({
  pgReady: true,
  resolveNextScene: vi.fn(),
  evaluateAssessment: vi.fn(),
  applyLearnerUpdateInTransaction: vi.fn(),
}));

const ASSIGNMENT_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";
const LESSON_VERSION_ID = "55555555-5555-4555-8555-555555555555";
const INSTANCE_ID = "77777777-7777-4777-8777-777777777777";
const STUDENT_ID = 7;
const OTHER_STUDENT_ID = 99;
const ACTION_NONCE = "88888888-8888-4888-8888-888888888888";

const validScript: LessonScript = {
  topic: "Linear equations",
  conceptIds: ["linear-equations-isolation"],
  primaryConceptId: "linear-equations-isolation",
  scenes: [
    {
      id: "check",
      actions: [
        {
          type: "assessment",
          agent: "teacher",
          assessmentId: "linear-equations-immediate",
          prompt: "Solve for x",
          gate: true,
        },
      ],
    },
    {
      id: "support",
      actions: [
        {
          type: "ask",
          agent: "coach",
          prompt: "Try again",
          expects: "freeText",
          gate: true,
        },
      ],
    },
  ],
  sceneGraph: {
    version: "v1",
    entrySceneId: "check",
    transitions: [
      { fromSceneId: "check", toSceneId: "support", when: { kind: "always" } },
      { fromSceneId: "support", terminal: true, when: { kind: "always" } },
    ],
  },
};

const storedDecision = {
  version: 1,
  fromSceneId: null as string | null,
  toSceneId: "check",
  terminal: false,
  rationale: "declared_entry_scene",
  transitionIndex: null as number | null,
};

type MockState = {
  assignment?: {
    assignment_id: string;
    lesson_version_id: string;
    assignment_status: string;
    available_at: Date;
    due_at: Date | null;
    enrollment_exists: boolean;
    script: LessonScript;
  } | null;
  sessionInsert?: {
    id: string;
    assignment_id: string;
    lesson_version_id: string;
    next_action_index: number;
    script: LessonScript;
  } | null;
  attemptSession?: Record<string, unknown> | null;
  priorEvidence?: { action_index: number } | null;
  poolSession?: { student_id: number; status: string; next_action_index: number } | null;
  assessmentRow?: Record<string, unknown> | null;
  helpDepth?: number;
  masteryRows?: Array<{ concept: string; p_mastery: number }>;
  updateNextActionIndex?: number;
};

let mockState: MockState = {};

const queryMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (/^BEGIN|^COMMIT|^ROLLBACK/.test(sql.trim())) {
    return { rows: [] };
  }

  if (sql.includes("FROM study_arena_assignments a") && sql.includes("FOR UPDATE")) {
    const assignment = mockState.assignment;
    return { rows: assignment ? [assignment] : [] };
  }

  if (sql.includes("INSERT INTO study_arena_attempt_sessions")) {
    const session = mockState.sessionInsert;
    return { rows: session ? [session] : [] };
  }

  if (sql.includes("FROM study_arena_attempt_sessions s") && sql.includes("FOR UPDATE")) {
    const session = mockState.attemptSession;
    return { rows: session ? [session] : [] };
  }

  if (sql.includes("FROM study_arena_evidence_events") && sql.includes("idempotency_key")) {
    return { rows: mockState.priorEvidence ? [mockState.priorEvidence] : [] };
  }

  if (sql.includes("INSERT INTO study_arena_evidence_events")) {
    return { rows: [] };
  }

  if (sql.includes("count(*)::int AS help_depth")) {
    return { rows: [{ help_depth: mockState.helpDepth ?? 0 }] };
  }

  if (sql.includes("FROM learner_mastery WHERE student_id")) {
    return { rows: mockState.masteryRows ?? [] };
  }

  if (sql.includes("UPDATE study_arena_attempt_sessions") && sql.includes("RETURNING next_action_index")) {
    return { rows: [{ next_action_index: mockState.updateNextActionIndex ?? 1 }] };
  }

  if (sql.includes("UPDATE study_arena_attempt_sessions") && sql.includes("director_decision")) {
    return { rows: [] };
  }

  if (sql.includes("UPDATE study_arena_attempt_sessions SET status = 'completed'")) {
    return { rows: [] };
  }

  if (sql.includes("INSERT INTO study_arena_assessment_instances")) {
    return { rows: [{ id: INSTANCE_ID }] };
  }

  if (sql.includes("FROM study_arena_assessment_instances i")) {
    const row = mockState.assessmentRow;
    return { rows: row ? [row] : [] };
  }

  if (sql.includes("FROM learner_mastery WHERE student_id = $1 AND concept = $2")) {
    return { rows: [] };
  }

  if (sql.includes("FROM review_schedule WHERE student_id")) {
    return { rows: [] };
  }

  if (sql.includes("count(*) FROM study_arena_evidence_events")) {
    return { rows: [{ count: "0" }] };
  }

  if (sql.includes("INSERT INTO study_arena_assessment_evaluations")) {
    return { rows: [] };
  }

  if (sql.includes("UPDATE study_arena_assessment_instances SET status = 'submitted'")) {
    return { rows: [] };
  }

  if (sql.includes("adaptive_recommendation")) {
    return { rows: [] };
  }

  return { rows: [] };
});

const poolQueryMock = vi.fn(async (sql: string) => {
  if (sql.includes("FROM study_arena_attempt_sessions") && !sql.includes("FOR UPDATE")) {
    const session = mockState.poolSession;
    return { rows: session ? [session] : [] };
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
  openAssignmentAttemptSession,
  getAssignedNextSegment,
  recordAssignedEvidence,
  checkAssignedAction,
  issueAssignedAssessment,
  submitAssignedAssessment,
} from "../services/study-arena/assignment-sessions";

function baseAssignment(overrides: Partial<NonNullable<MockState["assignment"]>> = {}) {
  return {
    assignment_id: ASSIGNMENT_ID,
    lesson_version_id: LESSON_VERSION_ID,
    assignment_status: "published",
    available_at: new Date(Date.now() - 86_400_000),
    due_at: null,
    enrollment_exists: true,
    script: validScript,
    ...overrides,
  };
}

function baseAttemptSession(overrides: Record<string, unknown> = {}) {
  return {
    assignment_id: ASSIGNMENT_ID,
    student_id: STUDENT_ID,
    lesson_version_id: LESSON_VERSION_ID,
    workspace_id: 42,
    objective: "Solve linear equations",
    status: "active",
    next_action_index: 0,
    current_scene_id: "check",
    completed_scene_ids: [] as string[],
    branch_path: [] as string[],
    director_decision: storedDecision,
    director_decision_version: 1,
    script: validScript,
    is_preview: false,
    ...overrides,
  };
}

describe("openAssignmentAttemptSession", () => {
  beforeEach(() => {
    mockState = {};
    h.pgReady = true;
    queryMock.mockClear();
    poolQueryMock.mockClear();
    h.resolveNextScene.mockReset();
    h.evaluateAssessment.mockReset();
    h.applyLearnerUpdateInTransaction.mockReset();
  });

  it("returns database_unavailable when postgres is not ready", async () => {
    h.pgReady = false;
    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);
    expect(result).toEqual({ status: "database_unavailable" });
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("returns not_found when the assignment does not exist", async () => {
    mockState.assignment = null;
    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);
    expect(result).toEqual({ status: "not_found" });
  });

  it("returns forbidden when the student is not enrolled", async () => {
    mockState.assignment = baseAssignment({ enrollment_exists: false });
    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns unavailable when the assignment is unpublished", async () => {
    mockState.assignment = baseAssignment({ assignment_status: "draft" });
    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when the assignment window has not opened", async () => {
    mockState.assignment = baseAssignment({
      available_at: new Date(Date.now() + 86_400_000),
    });
    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when the assignment is past due", async () => {
    mockState.assignment = baseAssignment({
      due_at: new Date(Date.now() - 86_400_000),
    });
    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);
    expect(result).toEqual({ status: "unavailable" });
  });

  it("creates a session for an enrolled student on a published assignment", async () => {
    mockState.assignment = baseAssignment();
    mockState.sessionInsert = {
      id: SESSION_ID,
      assignment_id: ASSIGNMENT_ID,
      lesson_version_id: LESSON_VERSION_ID,
      next_action_index: 0,
      script: validScript,
    };

    const result = await openAssignmentAttemptSession(ASSIGNMENT_ID, STUDENT_ID);

    expect(result).toEqual({
      status: "ok",
      sessionId: SESSION_ID,
      assignmentId: ASSIGNMENT_ID,
      lessonVersionId: LESSON_VERSION_ID,
      nextActionIndex: 0,
    });
    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO study_arena_attempt_sessions"), expect.any(Array));
  });
});

describe("getAssignedNextSegment", () => {
  beforeEach(() => {
    mockState = {};
    h.pgReady = true;
    queryMock.mockClear();
    h.resolveNextScene.mockReturnValue({
      fromSceneId: null,
      toSceneId: "check",
      terminal: false,
      rationale: "declared_entry_scene",
      transitionIndex: null,
    });
  });

  it("returns database_unavailable when postgres is not ready", async () => {
    h.pgReady = false;
    const result = await getAssignedNextSegment({ attemptSessionId: SESSION_ID, studentId: STUDENT_ID });
    expect(result).toEqual({ status: "database_unavailable" });
  });

  it("returns forbidden when the session belongs to another student", async () => {
    mockState.attemptSession = baseAttemptSession({ student_id: OTHER_STUDENT_ID });
    const result = await getAssignedNextSegment({ attemptSessionId: SESSION_ID, studentId: STUDENT_ID });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns ready with the server-selected scene", async () => {
    mockState.attemptSession = baseAttemptSession();
    const result = await getAssignedNextSegment({ attemptSessionId: SESSION_ID, studentId: STUDENT_ID });

    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.attemptSessionId).toBe(SESSION_ID);
    expect(result.gateIndex).toBe(0);
    expect(result.scene.id).toBe("check");
    expect(result.decision).toMatchObject({ toSceneId: "check", terminal: false });
  });

  it("bootstraps the director decision via resolveNextScene when none is stored", async () => {
    mockState.attemptSession = baseAttemptSession({
      current_scene_id: null,
      director_decision: null,
      director_decision_version: 0,
    });

    const result = await getAssignedNextSegment({ attemptSessionId: SESSION_ID, studentId: STUDENT_ID });

    expect(h.resolveNextScene).toHaveBeenCalled();
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.scene.id).toBe("check");
  });

  it("returns completed for a terminal stored decision", async () => {
    const terminalDecision = {
      version: 2,
      fromSceneId: "support",
      toSceneId: null,
      terminal: true,
      rationale: "declared_terminal",
      transitionIndex: 1,
    };
    mockState.attemptSession = baseAttemptSession({
      status: "completed",
      director_decision: terminalDecision,
      director_decision_version: 2,
      next_action_index: 3,
    });

    const result = await getAssignedNextSegment({ attemptSessionId: SESSION_ID, studentId: STUDENT_ID });

    expect(result).toEqual({
      status: "completed",
      attemptSessionId: SESSION_ID,
      gateIndex: 3,
      decision: terminalDecision,
    });
  });

  it("marks an active session completed when the director reaches a terminal scene", async () => {
    h.resolveNextScene.mockReturnValue({
      fromSceneId: "support",
      toSceneId: null,
      terminal: true,
      rationale: "declared_terminal",
      transitionIndex: 1,
    });
    mockState.attemptSession = baseAttemptSession({
      current_scene_id: null,
      director_decision: null,
      director_decision_version: 0,
    });

    const result = await getAssignedNextSegment({ attemptSessionId: SESSION_ID, studentId: STUDENT_ID });

    expect(result.status).toBe("completed");
    if (result.status !== "completed") return;
    expect(result.decision.terminal).toBe(true);
  });
});

describe("recordAssignedEvidence", () => {
  beforeEach(() => {
    mockState = {
      attemptSession: baseAttemptSession(),
      updateNextActionIndex: 1,
      helpDepth: 0,
      masteryRows: [],
    };
    h.pgReady = true;
    queryMock.mockClear();
    h.resolveNextScene.mockReturnValue({
      fromSceneId: "check",
      toSceneId: "support",
      terminal: false,
      rationale: "declared_transition",
      transitionIndex: 0,
    });
  });

  it("returns database_unavailable when postgres is not ready", async () => {
    h.pgReady = false;
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
      idempotencyKey: "key-1",
      eventKind: "attempt",
      evidence: { answer: "x = 5" },
    });
    expect(result).toEqual({ status: "database_unavailable" });
  });

  it("returns forbidden for another student's session", async () => {
    mockState.attemptSession = baseAttemptSession({ student_id: OTHER_STUDENT_ID });
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
      idempotencyKey: "key-1",
      eventKind: "attempt",
      evidence: {},
    });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns inactive when the session is not active", async () => {
    mockState.attemptSession = baseAttemptSession({ status: "completed" });
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
      idempotencyKey: "key-1",
      eventKind: "attempt",
      evidence: {},
    });
    expect(result).toEqual({ status: "inactive" });
  });

  it("returns replayed when the idempotency key was already used", async () => {
    mockState.priorEvidence = { action_index: 0 };
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
      idempotencyKey: "key-1",
      eventKind: "attempt",
      evidence: {},
    });
    expect(result).toEqual({ status: "replayed", nextActionIndex: 0 });
  });

  it("returns out_of_sequence when the action index does not match the cursor", async () => {
    mockState.attemptSession = baseAttemptSession({ next_action_index: 2 });
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
      idempotencyKey: "key-1",
      eventKind: "attempt",
      evidence: {},
    });
    expect(result).toEqual({ status: "out_of_sequence" });
  });

  it("records evidence and advances the server cursor", async () => {
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
      idempotencyKey: "key-1",
      eventKind: "attempt",
      evidence: { proceed: true },
    });

    expect(result).toEqual({ status: "recorded", nextActionIndex: 1 });
    expect(h.resolveNextScene).toHaveBeenCalled();
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO study_arena_evidence_events"),
      expect.any(Array)
    );
  });

  it("advances preview sessions without writing learner evidence", async () => {
    mockState.attemptSession = baseAttemptSession({ is_preview: true, student_id: 9 });
    const result = await recordAssignedEvidence({
      attemptSessionId: SESSION_ID,
      studentId: 9,
      actionIndex: 0,
      idempotencyKey: "preview-key",
      eventKind: "attempt",
      evidence: { preview: true },
    });

    expect(result).toEqual({ status: "recorded", nextActionIndex: 1 });
    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO study_arena_evidence_events")
      )
    ).toBe(false);
    expect(h.applyLearnerUpdateInTransaction).not.toHaveBeenCalled();
  });
});

describe("checkAssignedAction", () => {
  beforeEach(() => {
    mockState = {};
    h.pgReady = true;
    poolQueryMock.mockClear();
  });

  it("returns database_unavailable when postgres is not ready", async () => {
    h.pgReady = false;
    const result = await checkAssignedAction({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "database_unavailable" });
  });

  it("returns forbidden when the session belongs to another student", async () => {
    mockState.poolSession = { student_id: OTHER_STUDENT_ID, status: "active", next_action_index: 0 };
    const result = await checkAssignedAction({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns inactive when the session is not active", async () => {
    mockState.poolSession = { student_id: STUDENT_ID, status: "completed", next_action_index: 0 };
    const result = await checkAssignedAction({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "inactive" });
  });

  it("returns out_of_sequence when the action index does not match", async () => {
    mockState.poolSession = { student_id: STUDENT_ID, status: "active", next_action_index: 2 };
    const result = await checkAssignedAction({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "out_of_sequence" });
  });

  it("returns ok for an active session at the expected cursor", async () => {
    mockState.poolSession = { student_id: STUDENT_ID, status: "active", next_action_index: 0 };
    const result = await checkAssignedAction({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "ok" });
    expect(poolQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM study_arena_attempt_sessions"),
      [SESSION_ID]
    );
  });
});

describe("issueAssignedAssessment", () => {
  beforeEach(() => {
    mockState = {
      attemptSession: {
        student_id: STUDENT_ID,
        session_status: "active",
        next_action_index: 0,
        assignment_status: "published",
        available_at: new Date(Date.now() - 86_400_000),
        due_at: null,
        script: validScript,
        evaluator_version: "v1",
        current_scene_id: "check",
      },
    };
    h.pgReady = true;
    queryMock.mockClear();
  });

  it("returns database_unavailable when postgres is not ready", async () => {
    h.pgReady = false;
    const result = await issueAssignedAssessment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "database_unavailable" });
  });

  it("returns forbidden for another student's session", async () => {
    mockState.attemptSession = {
      ...(mockState.attemptSession as Record<string, unknown>),
      student_id: OTHER_STUDENT_ID,
    };
    const result = await issueAssignedAssessment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns inactive when the session is not active", async () => {
    mockState.attemptSession = {
      ...(mockState.attemptSession as Record<string, unknown>),
      session_status: "completed",
    };
    const result = await issueAssignedAssessment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "inactive" });
  });

  it("returns out_of_sequence when the action index does not match", async () => {
    mockState.attemptSession = {
      ...(mockState.attemptSession as Record<string, unknown>),
      next_action_index: 2,
    };
    const result = await issueAssignedAssessment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });
    expect(result).toEqual({ status: "out_of_sequence" });
  });

  it("issues the assessment bound to the current scene", async () => {
    const result = await issueAssignedAssessment({
      attemptSessionId: SESSION_ID,
      studentId: STUDENT_ID,
      actionIndex: 0,
    });

    expect(result.status).toBe("issued");
    if (result.status !== "issued") return;
    expect(result.assessmentInstanceId).toBe(INSTANCE_ID);
    expect(result.assessmentId).toBe("linear-equations-immediate");
    expect(result.prompt).toBe("Solve for x");
    expect(result.actionIndex).toBe(0);
    expect(result.actionNonce).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO study_arena_assessment_instances"),
      expect.any(Array)
    );
  });
});

describe("submitAssignedAssessment", () => {
  beforeEach(() => {
    mockState = {
      assessmentRow: {
        student_id: STUDENT_ID,
        status: "active",
        next_action_index: 0,
        assignment_id: ASSIGNMENT_ID,
        lesson_version_id: LESSON_VERSION_ID,
        workspace_id: 42,
        objective: "Solve linear equations",
        subject: "Mathematics",
        primary_concept_id: "linear-equations-isolation",
        assessment_id: "linear-equations-immediate",
        evaluator_version: "v1",
        template_id: null,
        template_config: {},
        action_index: 0,
        nonce_hash: createHash("sha256").update(ACTION_NONCE).digest("hex"),
        instance_status: "issued",
        due_at: null,
        correct: null,
        current_scene_id: "check",
        completed_scene_ids: [],
        branch_path: [],
        director_decision_version: 1,
        script: validScript,
        is_preview: false,
      },
      updateNextActionIndex: 1,
      helpDepth: 0,
      masteryRows: [],
    };
    h.pgReady = true;
    queryMock.mockClear();
    h.evaluateAssessment.mockReturnValue({ correct: true, confidence: 1, misconceptionCode: null });
    h.applyLearnerUpdateInTransaction.mockReset();
    h.applyLearnerUpdateInTransaction.mockResolvedValue(undefined);
    h.resolveNextScene.mockReturnValue({
      fromSceneId: "check",
      toSceneId: "support",
      terminal: false,
      rationale: "declared_transition",
      transitionIndex: 0,
    });
  });

  it("returns database_unavailable when postgres is not ready", async () => {
    h.pgReady = false;
    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: STUDENT_ID,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "submit-key",
    });
    expect(result).toEqual({ status: "database_unavailable" });
  });

  it("returns forbidden for another student's assessment", async () => {
    mockState.assessmentRow = {
      ...(mockState.assessmentRow as Record<string, unknown>),
      student_id: OTHER_STUDENT_ID,
    };
    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: STUDENT_ID,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "submit-key",
    });
    expect(result).toEqual({ status: "forbidden" });
  });

  it("returns replayed when the assessment was already submitted", async () => {
    mockState.assessmentRow = {
      ...(mockState.assessmentRow as Record<string, unknown>),
      instance_status: "submitted",
      correct: true,
      next_action_index: 1,
    };
    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: STUDENT_ID,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "submit-key",
    });
    expect(result).toEqual({ status: "replayed", correct: true, nextActionIndex: 1 });
  });

  it("returns expired when the assessment instance is past due", async () => {
    mockState.assessmentRow = {
      ...(mockState.assessmentRow as Record<string, unknown>),
      due_at: new Date(Date.now() - 86_400_000),
    };
    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: STUDENT_ID,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "submit-key",
    });
    expect(result).toEqual({ status: "expired" });
  });

  it("returns invalid when the action nonce does not match", async () => {
    mockState.assessmentRow = {
      ...(mockState.assessmentRow as Record<string, unknown>),
      nonce_hash: "deadbeef",
    };
    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: STUDENT_ID,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "submit-key",
    });
    expect(result).toEqual({ status: "invalid" });
  });

  it("submits the assessment, updates learner state, and advances the cursor", async () => {
    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: STUDENT_ID,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "submit-key",
    });

    expect(result).toEqual({ status: "submitted", correct: true, nextActionIndex: 1 });
    expect(h.evaluateAssessment).toHaveBeenCalledWith(
      "linear-equations-immediate",
      "x = 5",
      {}
    );
    expect(h.applyLearnerUpdateInTransaction).toHaveBeenCalledWith(
      expect.any(Object),
      STUDENT_ID,
      expect.objectContaining({
        masteryDeltas: [expect.objectContaining({ concept: "linear-equations-isolation" })],
        interaction: expect.objectContaining({ kind: "assigned_assessment" }),
      })
    );
    expect(h.resolveNextScene).toHaveBeenCalled();
  });

  it("submits a preview assessment without writing learner state", async () => {
    mockState.assessmentRow = {
      ...(mockState.assessmentRow as Record<string, unknown>),
      is_preview: true,
      student_id: 9,
    };

    const result = await submitAssignedAssessment({
      attemptSessionId: SESSION_ID,
      assessmentInstanceId: INSTANCE_ID,
      studentId: 9,
      actionNonce: ACTION_NONCE,
      answer: "x = 5",
      idempotencyKey: "preview-submit-key",
    });

    expect(result).toEqual({ status: "submitted", correct: true, nextActionIndex: 1 });
    expect(h.evaluateAssessment).toHaveBeenCalledWith(
      "linear-equations-immediate",
      "x = 5",
      {}
    );
    expect(h.applyLearnerUpdateInTransaction).not.toHaveBeenCalled();
    expect(
      queryMock.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO study_arena_evidence_events")
      )
    ).toBe(false);
  });
});
