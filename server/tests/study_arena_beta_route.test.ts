// Route-level tests for the Study Arena beta surface. The valuable, previously
// untested logic here is the gate-answer logging: it must fire ONLY for real
// students, must carry the grouping keys the adoption metric needs, and must
// NEVER let a logging failure break the student's flow.

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  user: null as any,
  createLinearEquationsDelayedCheck: vi.fn(),
  createLinearEquationsSprint: vi.fn(),
  gradeLinearEquationsAssessment: vi.fn(),
  generateLessonScript: vi.fn(),
  respondToInteraction: vi.fn(),
  pgIncrementAIUsage: vi.fn(),
  commitLearnerUpdate: vi.fn(),
  getLearnerSnapshot: vi.fn(),
  openAssignmentAttemptSession: vi.fn(),
  getAssignedNextSegment: vi.fn(),
  recordAssignedEvidence: vi.fn(),
  checkAssignedAction: vi.fn(),
  issueAssignedAssessment: vi.fn(),
  submitAssignedAssessment: vi.fn(),
  pgQuery: vi.fn(),
  getRelianceCohorts: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.user) return res.status(401).json({ message: "unauthorized" });
    req.user = h.user;
    next();
  },
}));

vi.mock("../middleware/aiQuota", () => ({
  // The real one passes through in NODE_ENV=test; mirror that.
  checkAIQuota: async () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/study-arena/lesson-script", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/study-arena/lesson-script")>();
  return {
    ...actual,
    createLinearEquationsDelayedCheck: h.createLinearEquationsDelayedCheck,
    createLinearEquationsSprint: h.createLinearEquationsSprint,
    gradeLinearEquationsAssessment: h.gradeLinearEquationsAssessment,
    generateLessonScript: h.generateLessonScript,
    respondToInteraction: h.respondToInteraction,
  };
});

vi.mock("../lib/db/pg-queries", () => ({
  pgIncrementAIUsage: h.pgIncrementAIUsage,
}));

vi.mock("../db-pg", () => ({
  getPgPool: () => ({
    query: h.pgQuery,
    connect: async () => ({ query: h.pgQuery, release: vi.fn() }),
  }),
  isPgReady: () => true,
}));

vi.mock("../lib/ai/learner-model", () => ({
  commitLearnerUpdate: h.commitLearnerUpdate,
  getLearnerSnapshot: h.getLearnerSnapshot,
}));

vi.mock("../services/study-arena/reliance-model", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/study-arena/reliance-model")>();
  return { ...actual, getRelianceCohorts: h.getRelianceCohorts };
});

vi.mock("../services/study-arena/assignment-sessions", () => ({
  checkAssignedAction: h.checkAssignedAction,
  issueAssignedAssessment: h.issueAssignedAssessment,
  getAssignedNextSegment: h.getAssignedNextSegment,
  openAssignmentAttemptSession: h.openAssignmentAttemptSession,
  recordAssignedEvidence: h.recordAssignedEvidence,
  submitAssignedAssessment: h.submitAssignedAssessment,
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import router from "../routes/study-arena-beta";
import { logger } from "../lib/logger";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).workspace = { id: 42 };
    next();
  });
  app.use("/api/study-arena-beta", router);
  return app;
}

const validInteraction = {
  topic: "Photosynthesis",
  question: "What does a leaf need?",
  answer: "sunlight and water",
  lessonId: "11111111-1111-4111-8111-111111111111",
  actionKey: "0-2",
  gateIndex: 0,
  totalGates: 3,
  attempt: 1,
};

describe("POST /api/study-arena-beta/assignment-session", () => {
  const assignmentId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 7, role: "student" };
    h.openAssignmentAttemptSession.mockResolvedValue({
      status: "ok",
      sessionId: "44444444-4444-4444-8444-444444444444",
      assignmentId,
      lessonVersionId: "55555555-5555-4555-8555-555555555555",
      nextActionIndex: 0,
    });
  });

  it("opens a server-owned session only for a student", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-session")
      .send({ assignmentId });

    expect(res.status).toBe(200);
    expect(h.openAssignmentAttemptSession).toHaveBeenCalledWith(assignmentId, 7);
    expect(res.body).toMatchObject({ status: "ok", assignmentId });
  });

  it("rejects non-student callers before querying assignment access", async () => {
    h.user = { id: 9, role: "teacher" };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-session")
      .send({ assignmentId });

    expect(res.status).toBe(403);
    expect(h.openAssignmentAttemptSession).not.toHaveBeenCalled();
  });

  it("does not reveal an unassigned assignment as available", async () => {
    h.openAssignmentAttemptSession.mockResolvedValue({ status: "forbidden" });
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-session")
      .send({ assignmentId });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "You are not assigned to this lesson" });
  });
});

describe("POST /api/study-arena-beta/assignment-next-segment", () => {
  const attemptSessionId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 7, role: "student" };
    h.getAssignedNextSegment.mockResolvedValue({
      status: "ready",
      attemptSessionId,
      gateIndex: 0,
      scene: {
        id: "intro",
        actions: [
          { type: "ask", agent: "teacher", prompt: "Try", expects: "freeText", gate: true },
        ],
      },
      decision: {
        version: 1,
        fromSceneId: null,
        toSceneId: "intro",
        terminal: false,
        rationale: "declared_entry_scene",
        transitionIndex: null,
      },
    });
  });

  it("returns only the server-selected scene and replay-safe gate index", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-next-segment")
      .send({ attemptSessionId });

    expect(res.status).toBe(200);
    expect(h.getAssignedNextSegment).toHaveBeenCalledWith({ attemptSessionId, studentId: 7 });
    expect(res.body).toMatchObject({
      status: "ready",
      gateIndex: 0,
      scene: { id: "intro" },
      decision: { version: 1, toSceneId: "intro" },
    });
    expect(res.body).not.toHaveProperty("script");
  });

  it("rejects a session belonging to another student", async () => {
    h.getAssignedNextSegment.mockResolvedValue({ status: "forbidden" });
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-next-segment")
      .send({ attemptSessionId });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "You are not assigned to this lesson session" });
  });
});

describe("GET /api/study-arena-beta/assignments/:assignmentId/report", () => {
  const assignmentId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
    h.pgQuery.mockResolvedValue({
      rows: [
        {
          student_id: 7,
          student_name: "Ada Learner",
          session_status: "active",
          next_action_index: 3,
          current_scene_id: "support",
          adaptive_path: ["check", "support"],
          adaptive_decision: {
            version: 2,
            fromSceneId: "check",
            toSceneId: "support",
            terminal: false,
            rationale: "declared_transition_1_assessment_result",
            transitionIndex: 1,
          },
          adaptive_decision_version: 2,
          adaptive_rationale: "declared_transition_1_assessment_result",
          assessment_correct: false,
          assessment_submitted_at: new Date("2026-08-04T00:00:00.000Z"),
          help_depth: 3,
        },
      ],
    });
  });

  it("reports the latest server-owned adaptive decision, path, and rationale", async () => {
    const res = await request(makeApp()).get(
      `/api/study-arena-beta/assignments/${assignmentId}/report`
    );

    expect(res.status).toBe(200);
    expect(h.pgQuery).toHaveBeenCalledWith(expect.stringContaining("director_decision"), [
      assignmentId,
      42,
    ]);
    expect(res.body.students).toEqual([
      expect.objectContaining({
        student_id: 7,
        adaptive_path: ["check", "support"],
        adaptive_decision: expect.objectContaining({ toSceneId: "support", version: 2 }),
        adaptive_decision_version: 2,
        adaptive_rationale: "declared_transition_1_assessment_result",
      }),
    ]);
  });

  it("rejects students before querying the teacher report", async () => {
    h.user = { id: 7, role: "student" };
    const res = await request(makeApp()).get(
      `/api/study-arena-beta/assignments/${assignmentId}/report`
    );

    expect(res.status).toBe(403);
    expect(h.pgQuery).not.toHaveBeenCalled();
  });
});

describe("POST /api/study-arena-beta/interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.user = { id: 7, role: "student" };
    h.respondToInteraction.mockResolvedValue({ feedback: "nice try", proceed: true, attempt: 1 });
    h.pgIncrementAIUsage.mockResolvedValue(true);
    h.commitLearnerUpdate.mockResolvedValue(true);
    h.recordAssignedEvidence.mockResolvedValue({ status: "recorded", nextActionIndex: 1 });
    h.checkAssignedAction.mockResolvedValue({ status: "ok" });
    delete process.env.STUDY_ARENA_BETA;
  });

  it("401s when unauthenticated", async () => {
    h.user = null;
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(401);
  });

  it("404s when the beta flag is off", async () => {
    process.env.STUDY_ARENA_BETA = "false";
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(404);
    expect(h.respondToInteraction).not.toHaveBeenCalled();
  });

  it("400s on an invalid body (missing answer)", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send({ topic: "x" });
    expect(res.status).toBe(400);
    expect(h.respondToInteraction).not.toHaveBeenCalled();
  });

  it("logs the gate answer for a student, with the metric grouping keys", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(200);
    expect(h.commitLearnerUpdate).toHaveBeenCalledTimes(1);
    expect(h.pgIncrementAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: "study_arena_interaction",
          lessonId: validInteraction.lessonId,
          estimatedCostInr: null,
        }),
      })
    );
    const [studentId, update] = h.commitLearnerUpdate.mock.calls[0];
    expect(studentId).toBe(7);
    expect(update.interaction.kind).toBe("study_arena_gate_answer");
    expect(update.interaction.payload).toMatchObject({
      lessonId: validInteraction.lessonId,
      actionKey: "0-2",
      gateIndex: 0,
      totalGates: 3,
      attempt: 1,
      answer: "sunlight and water",
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("does NOT log for a non-student caller (keeps the adoption signal clean)", async () => {
    h.user = { id: 9, role: "principal" };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(200);
    expect(h.commitLearnerUpdate).not.toHaveBeenCalled();
  });

  it("does NOT log when there is no lessonId (older client) but still answers", async () => {
    const { lessonId, ...noLesson } = validInteraction;
    void lessonId;
    const res = await request(makeApp()).post("/api/study-arena-beta/interaction").send(noLesson);
    expect(res.status).toBe(200);
    expect(h.commitLearnerUpdate).not.toHaveBeenCalled();
  });

  it("still returns 200 when gate-answer logging throws (never blocks the student)", async () => {
    h.commitLearnerUpdate.mockRejectedValue(new Error("pg down"));
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ proceed: true });
    expect(logger.error).toHaveBeenCalledWith(
      "[study-arena-beta] gate-answer log failed (non-blocking)",
      expect.objectContaining({ error: "Error: pg down" })
    );
  });

  it("still returns 200 and logs when the learner writer reports failure", async () => {
    h.commitLearnerUpdate.mockResolvedValue(false);
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ proceed: true });
    expect(logger.error).toHaveBeenCalledWith(
      "[study-arena-beta] gate-answer log failed (non-blocking)",
      expect.objectContaining({
        userId: 7,
        lessonId: validInteraction.lessonId,
        reason: "commitLearnerUpdate returned false",
      })
    );
  });

  it("maps an interaction service failure to 500", async () => {
    h.respondToInteraction.mockRejectedValue(new Error("provider down"));
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Failed to process answer" });
  });

  it("records assigned evidence with server-owned session metadata", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send({
        ...validInteraction,
        attemptSessionId: "44444444-4444-4444-8444-444444444444",
        actionIndex: 0,
        idempotencyKey: "66666666-6666-4666-8666-666666666666",
      });

    expect(res.status).toBe(200);
    expect(h.recordAssignedEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        studentId: 7,
        actionIndex: 0,
        eventKind: "attempt",
        evidence: expect.objectContaining({ proceed: true }),
      })
    );
  });

  it("rejects a partial assigned-session contract before calling the AI", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send({ ...validInteraction, attemptSessionId: "44444444-4444-4444-8444-444444444444" });

    expect(res.status).toBe(400);
    expect(h.respondToInteraction).not.toHaveBeenCalled();
  });

  it("rejects an out-of-sequence assigned action without logging a legacy gate answer", async () => {
    h.checkAssignedAction.mockResolvedValue({ status: "out_of_sequence" });
    h.recordAssignedEvidence.mockResolvedValue({ status: "out_of_sequence" });
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send({
        ...validInteraction,
        attemptSessionId: "44444444-4444-4444-8444-444444444444",
        actionIndex: 1,
        idempotencyKey: "66666666-6666-4666-8666-666666666666",
      });

    expect(res.status).toBe(409);
    expect(h.respondToInteraction).not.toHaveBeenCalled();
    expect(h.commitLearnerUpdate).not.toHaveBeenCalled();
  });

  it("keeps answering but reports an AI usage write failure", async () => {
    h.pgIncrementAIUsage.mockResolvedValue(false);
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      "[study-arena-beta] interaction usage was not recorded",
      expect.objectContaining({ lessonId: validInteraction.lessonId, actionKey: "0-2" })
    );
  });
});

describe("POST /api/study-arena-beta/lesson-script", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 7, role: "student" };
    h.pgIncrementAIUsage.mockResolvedValue(true);
    h.generateLessonScript.mockResolvedValue({
      topic: "Photosynthesis",
      conceptIds: [],
      scenes: [{ id: "s1", actions: [{ type: "ask", gate: true }] }],
    });
  });

  it("maps a generation service failure to 500", async () => {
    h.generateLessonScript.mockRejectedValue(new Error("provider down"));
    const res = await request(makeApp())
      .post("/api/study-arena-beta/lesson-script")
      .send({ topic: "Photosynthesis" });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Failed to generate lesson" });
  });

  it("records the client lesson id with generation usage", async () => {
    const lessonId = "22222222-2222-4222-8222-222222222222";
    const res = await request(makeApp())
      .post("/api/study-arena-beta/lesson-script")
      .send({ topic: "Photosynthesis", lessonId });
    expect(res.status).toBe(200);
    expect(h.pgIncrementAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ lessonId }) })
    );
  });
});

describe("linear equations mastery sprint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 7, role: "student" };
    h.createLinearEquationsSprint.mockReturnValue({ topic: "Linear equations", scenes: [] });
    h.createLinearEquationsDelayedCheck.mockReturnValue({
      topic: "Linear equations",
      scenes: [{ id: "delayed", actions: [] }],
    });
    h.gradeLinearEquationsAssessment.mockReturnValue(true);
    h.commitLearnerUpdate.mockResolvedValue(true);
    h.getLearnerSnapshot.mockResolvedValue({ dueReviews: [] });
  });

  it("serves the deterministic sprint without asking an AI provider to generate it", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/linear-equations-sprint")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ topic: "Linear equations", scenes: [] });
    expect(h.createLinearEquationsSprint).toHaveBeenCalledOnce();
    expect(h.generateLessonScript).not.toHaveBeenCalled();
  });

  it("records an independent assessment and schedules the delayed review", async () => {
    const res = await request(makeApp()).post("/api/study-arena-beta/assessment").send({
      assessmentId: "linear-equations-immediate",
      answer: "x = 5",
      lessonId: "11111111-1111-4111-8111-111111111111",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correct: true });
    expect(h.gradeLinearEquationsAssessment).toHaveBeenCalledWith(
      "linear-equations-immediate",
      "x = 5"
    );
    expect(h.commitLearnerUpdate).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        masteryDeltas: [expect.objectContaining({ concept: "linear-equations-isolation" })],
        reviewUpdates: [expect.objectContaining({ intervalDays: 3 })],
        interaction: expect.objectContaining({
          kind: "linear_equations_transfer_check",
          payload: expect.objectContaining({ correct: true }),
        }),
      })
    );
  });

  it("only serves the delayed check after its review becomes due", async () => {
    const tooEarly = await request(makeApp())
      .post("/api/study-arena-beta/linear-equations-sprint")
      .send({ phase: "delayed" });
    expect(tooEarly.status).toBe(409);
    expect(h.createLinearEquationsDelayedCheck).not.toHaveBeenCalled();

    h.getLearnerSnapshot.mockResolvedValue({
      dueReviews: [{ concept: "linear-equations-isolation" }],
    });
    const due = await request(makeApp())
      .post("/api/study-arena-beta/linear-equations-sprint")
      .send({ phase: "delayed" });
    expect(due.status).toBe(200);
    expect(h.createLinearEquationsDelayedCheck).toHaveBeenCalledOnce();
  });

  it("does not persist a student assessment for a teacher", async () => {
    h.user = { id: 9, role: "teacher" };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assessment")
      .send({ assessmentId: "linear-equations-immediate", answer: "5" });
    expect(res.status).toBe(200);
    expect(h.commitLearnerUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/study-arena-beta/assignment-assessment-instance", () => {
  const attemptSessionId = "44444444-4444-4444-8444-444444444444";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 7, role: "student" };
    h.issueAssignedAssessment.mockResolvedValue({
      status: "issued",
      assessmentInstanceId: "77777777-7777-4777-8777-777777777777",
      assessmentId: "linear-equations-immediate",
      prompt: "Solve for x.",
      actionIndex: 2,
      actionNonce: "88888888-8888-4888-8888-888888888888",
    });
  });

  it("issues only the server-selected assessment for an assigned student", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-assessment-instance")
      .send({ attemptSessionId, actionIndex: 2 });

    expect(res.status).toBe(200);
    expect(h.issueAssignedAssessment).toHaveBeenCalledWith({
      attemptSessionId,
      studentId: 7,
      actionIndex: 2,
    });
    expect(res.body).toMatchObject({
      status: "issued",
      assessmentId: "linear-equations-immediate",
    });
  });

  it("allows teachers to issue assessments for preview sessions they own", async () => {
    h.user = { id: 9, role: "teacher" };
    h.issueAssignedAssessment.mockResolvedValue({
      status: "issued",
      assessmentInstanceId: "77777777-7777-4777-8777-777777777777",
      assessmentId: "linear-equations-immediate",
      prompt: "Solve for x.",
      actionIndex: 2,
      actionNonce: "88888888-8888-4888-8888-888888888888",
    });
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-assessment-instance")
      .send({ attemptSessionId, actionIndex: 2 });

    expect(res.status).toBe(200);
    expect(h.issueAssignedAssessment).toHaveBeenCalledWith({
      attemptSessionId,
      studentId: 9,
      actionIndex: 2,
    });
  });
});

const validAssignedLessonBody = {
  subject: "Mathematics",
  objective: "Solve one-step linear equations",
  script: {
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
    ],
    sceneGraph: {
      version: "v1",
      entrySceneId: "check",
      transitions: [{ fromSceneId: "check", terminal: true, when: { kind: "always" } }],
    },
  },
  studentIds: [7],
};

describe("POST /api/study-arena-beta/assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
    h.pgQuery.mockImplementation(async (sql: string) => {
      if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT") || sql.startsWith("ROLLBACK")) {
        return { rows: [] };
      }
      if (sql.includes("FROM workspace_memberships")) {
        return { rows: [{ user_id: 7 }] };
      }
      if (sql.includes("INSERT INTO study_arena_lesson_versions")) {
        return { rows: [{ id: "55555555-5555-4555-8555-555555555555" }] };
      }
      if (sql.includes("INSERT INTO study_arena_assignments")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333" }] };
      }
      if (sql.includes("INSERT INTO study_arena_assignment_enrollments")) {
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  it("creates an assignment for a teacher with enrolled workspace members", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignments")
      .send(validAssignedLessonBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      assignmentId: "33333333-3333-4333-8333-333333333333",
      lessonVersionId: "55555555-5555-4555-8555-555555555555",
    });
    expect(h.pgQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO study_arena_lesson_versions"),
      expect.any(Array)
    );
  });

  it("rejects students before assignment creation", async () => {
    h.user = { id: 7, role: "student" };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignments")
      .send(validAssignedLessonBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Only teachers can assign Study Arena lessons" });
    expect(h.pgQuery).not.toHaveBeenCalled();
  });

  it("rejects an unsupported primary concept", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignments")
      .send({
        ...validAssignedLessonBody,
        script: {
          ...validAssignedLessonBody.script,
          conceptIds: ["unknown-concept"],
          primaryConceptId: "unknown-concept",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: "An assigned lesson requires a supported primary concept",
    });
    expect(h.pgQuery).not.toHaveBeenCalled();
  });
});

describe("POST /api/study-arena-beta/assignments/:assignmentId/interventions", () => {
  const assignmentId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
  });

  it("records a teacher intervention for a workspace assignment", async () => {
    h.pgQuery.mockResolvedValue({ rows: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }] });
    const res = await request(makeApp())
      .post(`/api/study-arena-beta/assignments/${assignmentId}/interventions`)
      .send({
        cohortKey: "high_help",
        studentId: 7,
        actionNote: "Small-group prerequisite review",
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ interventionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" });
    expect(h.pgQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO study_arena_intervention_actions"),
      [assignmentId, 7, 9, "high_help", "Small-group prerequisite review", 42]
    );
  });

  it("rejects students before recording an intervention", async () => {
    h.user = { id: 7, role: "student" };
    const res = await request(makeApp())
      .post(`/api/study-arena-beta/assignments/${assignmentId}/interventions`)
      .send({ cohortKey: "failed_transfer", actionNote: "Review transfer check" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Only teachers can record follow-up" });
    expect(h.pgQuery).not.toHaveBeenCalled();
  });

  it("returns 404 when the assignment is missing from the workspace", async () => {
    h.pgQuery.mockResolvedValue({ rows: [] });
    const res = await request(makeApp())
      .post(`/api/study-arena-beta/assignments/${assignmentId}/interventions`)
      .send({ cohortKey: "recall_overdue", actionNote: "Schedule recall check-in" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Assignment not found" });
  });
});

describe("POST /api/study-arena-beta/assignment-assessment-submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 7, role: "student" };
    h.submitAssignedAssessment.mockResolvedValue({
      status: "submitted",
      correct: true,
      nextActionIndex: 3,
    });
  });

  it("submits only a nonce-bound assessment for the assigned student", async () => {
    const body = {
      attemptSessionId: "44444444-4444-4444-8444-444444444444",
      assessmentInstanceId: "77777777-7777-4777-8777-777777777777",
      actionNonce: "88888888-8888-4888-8888-888888888888",
      answer: "x = 5",
      idempotencyKey: "99999999-9999-4999-8999-999999999999",
    };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-assessment-submit")
      .send(body);

    expect(res.status).toBe(200);
    expect(h.submitAssignedAssessment).toHaveBeenCalledWith({ ...body, studentId: 7 });
    expect(res.body).toMatchObject({ status: "submitted", correct: true });
  });

  it("allows teachers to submit assessments for preview sessions they own", async () => {
    h.user = { id: 9, role: "teacher" };
    h.submitAssignedAssessment.mockResolvedValue({
      status: "submitted",
      correct: true,
      nextActionIndex: 3,
    });
    const body = {
      attemptSessionId: "44444444-4444-4444-8444-444444444444",
      assessmentInstanceId: "77777777-7777-4777-8777-777777777777",
      actionNonce: "88888888-8888-4888-8888-888888888888",
      answer: "x = 5",
      idempotencyKey: "99999999-9999-4999-8999-999999999999",
    };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/assignment-assessment-submit")
      .send(body);
    expect(res.status).toBe(200);
    expect(h.submitAssignedAssessment).toHaveBeenCalledWith({ ...body, studentId: 9 });
  });
});

// Regression: help_depth is HINTS ONLY. The original subquery counted
// event_kind IN ('attempt','hint'), so a student who attempted four times with
// zero hints scored help_depth = 4 and landed in the "High help depth" cohort —
// the exact inverse of the signal. Every reliance number reads from this column.
describe("GET /api/study-arena-beta/assignments/:id/report — help depth", () => {
  const assignmentId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
  });

  it("counts hint events only, never attempts", async () => {
    h.pgQuery.mockResolvedValue({ rows: [] });
    await request(makeApp()).get(`/api/study-arena-beta/assignments/${assignmentId}/report`);

    const reportSql = h.pgQuery.mock.calls
      .map((call) => String(call[0]))
      .find((sql) => sql.includes("AS help_depth"));
    expect(reportSql).toBeDefined();
    const helpDepthSubquery = /count\(\*\)[\s\S]*?AS help_depth/.exec(reportSql!)![0];
    expect(helpDepthSubquery).toContain("event_kind = 'hint'");
    expect(helpDepthSubquery).not.toContain("'attempt'");
  });

  it("puts a student with many unaided attempts outside the high-help cohort", async () => {
    h.pgQuery.mockResolvedValueOnce({
      rows: [
        {
          student_id: 1,
          student_name: "Unaided",
          session_status: "completed",
          next_action_index: 4,
          assessment_correct: true,
          assessment_submitted_at: new Date(),
          help_depth: 0, // four attempts, zero hints
          current_scene_id: "intro",
          adaptive_path: [],
          adaptive_decision: null,
          adaptive_decision_version: null,
          adaptive_rationale: null,
        },
      ],
    });
    const res = await request(makeApp()).get(
      `/api/study-arena-beta/assignments/${assignmentId}/report`
    );

    expect(res.status).toBe(200);
    expect(res.body.groups.find((g: any) => g.key === "high_help")).toBeUndefined();
  });
});

describe("GET /api/study-arena-beta/reliance", () => {
  const model = {
    windowDays: 30,
    students: [],
    cohorts: [],
    insufficientEvidence: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
    h.getRelianceCohorts.mockResolvedValue(model);
  });

  it("scopes the read to the caller's workspace", async () => {
    const res = await request(makeApp()).get("/api/study-arena-beta/reliance");

    expect(res.status).toBe(200);
    expect(h.getRelianceCohorts).toHaveBeenCalledWith(42, expect.anything());
    expect(res.body).toEqual(model);
  });

  it("never exposes another student's reliance to a student", async () => {
    h.user = { id: 7, role: "student" };
    const res = await request(makeApp()).get("/api/study-arena-beta/reliance");

    expect(res.status).toBe(403);
    expect(h.getRelianceCohorts).not.toHaveBeenCalled();
  });

  it("passes class and subject filters through", async () => {
    await request(makeApp()).get("/api/study-arena-beta/reliance?classId=5&subject=maths");

    expect(h.getRelianceCohorts).toHaveBeenCalledWith(42, {
      classId: 5,
      subject: "maths",
      sinceDays: 30,
    });
  });

  it("rejects a window wider than the cap rather than silently clamping it", async () => {
    const res = await request(makeApp()).get("/api/study-arena-beta/reliance?sinceDays=3650");

    expect(res.status).toBe(400);
    expect(h.getRelianceCohorts).not.toHaveBeenCalled();
  });

  it("returns 409 when the request has no active workspace", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/study-arena-beta", router);
    const res = await request(app).get("/api/study-arena-beta/reliance");

    expect(res.status).toBe(409);
  });

  it("does not leak the failure reason when the read model throws", async () => {
    h.getRelianceCohorts.mockRejectedValue(new Error("relation does not exist"));
    const res = await request(makeApp()).get("/api/study-arena-beta/reliance");

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("relation");
    expect(logger.error).toHaveBeenCalled();
  });
});
