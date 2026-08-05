import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createLinearEquationsSprint } from "../services/study-arena/lesson-script";

const h = vi.hoisted(() => ({
  user: null as any,
  pgQuery: vi.fn(),
  pgConnectQuery: vi.fn(),
  release: vi.fn(),
  openPreviewSession: vi.fn(),
  recordAssignedEvidence: vi.fn(),
  submitAssignedAssessment: vi.fn(),
  issueAssignedAssessment: vi.fn(),
  checkAssignedAction: vi.fn(),
  getAssignedNextSegment: vi.fn(),
  openAssignmentAttemptSession: vi.fn(),
  enqueueLessonCompile: vi.fn(),
  getCompilerJob: vi.fn(),
  cancelCompilerJob: vi.fn(),
  retryCompilerJob: vi.fn(),
  createLinearEquationsDelayedCheck: vi.fn(),
  createLinearEquationsSprint: vi.fn(),
  gradeLinearEquationsAssessment: vi.fn(),
  generateLessonScript: vi.fn(),
  respondToInteraction: vi.fn(),
  pgIncrementAIUsage: vi.fn(),
  commitLearnerUpdate: vi.fn(),
  getLearnerSnapshot: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.user) return res.status(401).json({ message: "unauthorized" });
    req.user = h.user;
    next();
  },
}));

vi.mock("../middleware/aiQuota", () => ({
  checkAIQuota: async () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../services/study-arena/lesson-script", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/study-arena/lesson-script")>();
  return {
    ...actual,
    // Keep real templates/a11y helpers; only stub the AI-facing calls.
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
    connect: async () => ({ query: h.pgConnectQuery, release: h.release }),
  }),
  isPgReady: () => true,
}));

vi.mock("../lib/ai/learner-model", () => ({
  commitLearnerUpdate: h.commitLearnerUpdate,
  getLearnerSnapshot: h.getLearnerSnapshot,
}));

vi.mock("../services/study-arena/assignment-sessions", () => ({
  checkAssignedAction: h.checkAssignedAction,
  issueAssignedAssessment: h.issueAssignedAssessment,
  getAssignedNextSegment: h.getAssignedNextSegment,
  openAssignmentAttemptSession: h.openAssignmentAttemptSession,
  openPreviewSession: h.openPreviewSession,
  recordAssignedEvidence: h.recordAssignedEvidence,
  submitAssignedAssessment: h.submitAssignedAssessment,
}));

vi.mock("../services/study-arena/lesson-compiler", () => ({
  enqueueLessonCompile: h.enqueueLessonCompile,
  getCompilerJob: h.getCompilerJob,
  cancelCompilerJob: h.cancelCompilerJob,
  retryCompilerJob: h.retryCompilerJob,
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import router from "../routes/study-arena-beta";
import {
  ensureActionA11y,
  sceneActionA11ySchema,
} from "../services/study-arena/lesson-script";

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

const LESSON_VERSION_ID = "55555555-5555-4555-8555-555555555555";
const ASSIGNMENT_ID = "33333333-3333-4333-8333-333333333333";

describe("Study Arena approvals + publish gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
  });

  it("blocks publish when approvals are missing", async () => {
    h.pgConnectQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: LESSON_VERSION_ID,
            workspace_id: 42,
            created_by: 9,
            status: "draft",
            approvals: { objective: { at: "2026-01-01T00:00:00.000Z", by: 9 } },
          },
        ],
      })
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const res = await request(makeApp())
      .post(`/api/study-arena-beta/lesson-versions/${LESSON_VERSION_ID}/publish`)
      .send({ studentIds: [7] });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/approvals are required/i);
  });

  it("publishes when all three approvals are present", async () => {
    const approvals = {
      objective: { at: "2026-01-01T00:00:00.000Z", by: 9 },
      source: { at: "2026-01-01T00:00:00.000Z", by: 9 },
      assessment: { at: "2026-01-01T00:00:00.000Z", by: 9 },
    };
    h.pgConnectQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: LESSON_VERSION_ID,
            workspace_id: 42,
            created_by: 9,
            status: "draft",
            approvals,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ user_id: 7 }] }) // memberships
      .mockResolvedValueOnce({ rows: [] }) // update version published
      .mockResolvedValueOnce({ rows: [{ id: ASSIGNMENT_ID }] }) // insert assignment
      .mockResolvedValueOnce({ rows: [] }) // enrollments
      .mockResolvedValueOnce(undefined); // COMMIT

    const res = await request(makeApp())
      .post(`/api/study-arena-beta/lesson-versions/${LESSON_VERSION_ID}/publish`)
      .send({ studentIds: [7] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      assignmentId: ASSIGNMENT_ID,
      lessonVersionId: LESSON_VERSION_ID,
    });
  });

  it("records an approval for the owning teacher", async () => {
    h.pgConnectQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: LESSON_VERSION_ID,
            workspace_id: 42,
            created_by: 9,
            status: "draft",
            approvals: {},
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE approvals
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const res = await request(makeApp())
      .post(`/api/study-arena-beta/lesson-versions/${LESSON_VERSION_ID}/approvals`)
      .send({ kind: "objective" });

    expect(res.status).toBe(200);
    expect(res.body.approvals.objective.by).toBe(9);
    expect(res.body.complete).toBe(false);
    expect(h.pgConnectQuery).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      [LESSON_VERSION_ID]
    );
  });

  it("opens a teacher preview session without using learner assignment-session", async () => {
    h.openPreviewSession.mockResolvedValue({
      status: "ok",
      sessionId: "44444444-4444-4444-8444-444444444444",
      assignmentId: ASSIGNMENT_ID,
      lessonVersionId: LESSON_VERSION_ID,
      nextActionIndex: 0,
    });

    const res = await request(makeApp())
      .post(`/api/study-arena-beta/lesson-versions/${LESSON_VERSION_ID}/preview-session`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.isPreview).toBe(true);
    expect(h.openPreviewSession).toHaveBeenCalledWith({
      lessonVersionId: LESSON_VERSION_ID,
      teacherId: 9,
      workspaceId: 42,
    });
    expect(h.openAssignmentAttemptSession).not.toHaveBeenCalled();
  });

  it("creates a draft lesson from a script without publishing an assignment", async () => {
    const script = createLinearEquationsSprint();
    h.pgConnectQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: LESSON_VERSION_ID }] })
      .mockResolvedValueOnce(undefined); // COMMIT

    const res = await request(makeApp())
      .post("/api/study-arena-beta/lesson-drafts")
      .send({
        subject: "Mathematics",
        objective: "Isolate x",
        script,
      });

    expect(res.status).toBe(201);
    expect(res.body.lessonVersionId).toBe(LESSON_VERSION_ID);
    expect(res.body.assignmentId).toBeUndefined();
  });
});

describe("scene action a11y defaults", () => {
  it("fills WCAG defaults via ensureActionA11y", () => {
    const action = ensureActionA11y({
      type: "ask",
      agent: "teacher",
      prompt: "What is x?",
      expects: "freeText",
      gate: true,
    });
    expect(action.a11y).toBeDefined();
    const parsed = sceneActionA11ySchema.parse(action.a11y);
    expect(parsed.name).toBe("Attempt gate");
    expect(parsed.focusTarget).toBe("self");
    expect(parsed.ariaLive).toBe("polite");
  });

  it("preserves explicit a11y while applying schema defaults", () => {
    const action = ensureActionA11y({
      type: "assessment",
      agent: "teacher",
      prompt: "Solve",
      assessmentId: "linear-equations-immediate",
      gate: true,
      a11y: {
        name: "Custom check",
        keyboardOperation: "Type then Enter",
        textAlternative: "Solve for x",
        focusTarget: "alert",
        ariaLive: "assertive",
      },
    });
    expect(action.a11y?.name).toBe("Custom check");
    expect(action.a11y?.focusTarget).toBe("alert");
  });

  it("adds a11y to linear equations sprint templates", () => {
    const sprint = createLinearEquationsSprint();
    for (const scene of sprint.scenes) {
      for (const action of scene.actions) {
        expect(action.a11y?.name).toBeTruthy();
        expect(action.a11y?.textAlternative).toBeTruthy();
      }
    }
  });
});
