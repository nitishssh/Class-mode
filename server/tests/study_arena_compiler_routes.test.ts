// Route-level tests for Study Arena lesson-compiler endpoints.

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LESSON_VERSION_ID = "55555555-5555-4555-8555-555555555555";

const h = vi.hoisted(() => ({
  user: null as any,
  enqueueLessonCompile: vi.fn(),
  getCompilerJob: vi.fn(),
  cancelCompilerJob: vi.fn(),
  retryCompilerJob: vi.fn(),
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

vi.mock("../services/study-arena/lesson-compiler", () => ({
  enqueueLessonCompile: h.enqueueLessonCompile,
  getCompilerJob: h.getCompilerJob,
  cancelCompilerJob: h.cancelCompilerJob,
  retryCompilerJob: h.retryCompilerJob,
}));

vi.mock("../services/study-arena/assignment-sessions", () => ({
  checkAssignedAction: vi.fn(),
  issueAssignedAssessment: vi.fn(),
  getAssignedNextSegment: vi.fn(),
  openAssignmentAttemptSession: vi.fn(),
  openPreviewSession: vi.fn(),
  recordAssignedEvidence: vi.fn(),
  submitAssignedAssessment: vi.fn(),
}));

vi.mock("../services/study-arena/lesson-script", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/study-arena/lesson-script")>();
  return {
    ...actual,
    createLinearEquationsDelayedCheck: vi.fn(),
    createLinearEquationsSprint: vi.fn(),
    gradeLinearEquationsAssessment: vi.fn(),
    generateLessonScript: vi.fn(),
    respondToInteraction: vi.fn(),
  };
});

vi.mock("../lib/db/pg-queries", () => ({
  pgIncrementAIUsage: vi.fn(),
}));

vi.mock("../db-pg", () => ({
  getPgPool: () => ({
    query: vi.fn(),
    connect: async () => ({ query: vi.fn(), release: vi.fn() }),
  }),
  isPgReady: () => true,
}));

vi.mock("../lib/ai/learner-model", () => ({
  commitLearnerUpdate: vi.fn(),
  getLearnerSnapshot: vi.fn(),
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import router from "../routes/study-arena-beta";

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

function sampleJob(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    workspaceId: 42,
    teacherId: 9,
    requestFingerprint: "fp-1",
    status: "queued" as const,
    progress: { step: "queued" },
    sourceText: "Solve linear equations.",
    objective: "Solve one-step linear equations",
    subject: "Mathematics",
    gradeLevel: null,
    lessonVersionId: null,
    errorMessage: null,
    bullmqJobId: null,
    createdAt: new Date("2026-08-04T00:00:00.000Z"),
    updatedAt: new Date("2026-08-04T00:00:00.000Z"),
    cancelledAt: null,
    ...overrides,
  };
}

const validEnqueueBody = {
  sourceText: "A linear equation has one variable raised to the first power.",
  objective: "Solve one-step linear equations",
  subject: "Mathematics",
  gradeLevel: "Grade 8",
};

describe("POST /api/study-arena-beta/compiler/jobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
    h.enqueueLessonCompile.mockResolvedValue({
      status: "queued",
      job: sampleJob(),
      deduped: false,
    });
  });

  it("enqueues a compiler job for a teacher (201)", async () => {
    const res = await request(makeApp())
      .post("/api/study-arena-beta/compiler/jobs")
      .send(validEnqueueBody);

    expect(res.status).toBe(201);
    expect(h.enqueueLessonCompile).toHaveBeenCalledWith({
      workspaceId: 42,
      teacherId: 9,
      sourceText: validEnqueueBody.sourceText,
      objective: validEnqueueBody.objective,
      subject: validEnqueueBody.subject,
      gradeLevel: validEnqueueBody.gradeLevel,
    });
    expect(res.body).toMatchObject({
      jobId: JOB_ID,
      status: "queued",
      deduped: false,
    });
  });

  it("returns 200 when the compiler dedupes an in-flight job", async () => {
    h.enqueueLessonCompile.mockResolvedValue({
      status: "running",
      job: sampleJob({ status: "running", lessonVersionId: LESSON_VERSION_ID }),
      deduped: true,
    });

    const res = await request(makeApp())
      .post("/api/study-arena-beta/compiler/jobs")
      .send(validEnqueueBody);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      jobId: JOB_ID,
      status: "running",
      deduped: true,
      lessonVersionId: LESSON_VERSION_ID,
    });
  });

  it("rejects students before enqueueing a compiler job", async () => {
    h.user = { id: 7, role: "student" };
    const res = await request(makeApp())
      .post("/api/study-arena-beta/compiler/jobs")
      .send(validEnqueueBody);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Only teachers can perform this action" });
    expect(h.enqueueLessonCompile).not.toHaveBeenCalled();
  });
});

describe("GET /api/study-arena-beta/compiler/jobs/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
    h.getCompilerJob.mockResolvedValue(
      sampleJob({
        status: "completed",
        lessonVersionId: LESSON_VERSION_ID,
        progress: { step: "done" },
      })
    );
  });

  it("returns compiler job status for the owning teacher", async () => {
    const res = await request(makeApp()).get(`/api/study-arena-beta/compiler/jobs/${JOB_ID}`);

    expect(res.status).toBe(200);
    expect(h.getCompilerJob).toHaveBeenCalledWith(JOB_ID);
    expect(res.body).toMatchObject({
      jobId: JOB_ID,
      status: "completed",
      lessonVersionId: LESSON_VERSION_ID,
      progress: { step: "done" },
    });
  });

  it("returns 404 when the job is missing from the workspace", async () => {
    h.getCompilerJob.mockResolvedValue(null);
    const res = await request(makeApp()).get(`/api/study-arena-beta/compiler/jobs/${JOB_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Job not found" });
  });

  it("returns 403 when another teacher requests the job", async () => {
    h.getCompilerJob.mockResolvedValue(sampleJob({ teacherId: 99 }));
    const res = await request(makeApp()).get(`/api/study-arena-beta/compiler/jobs/${JOB_ID}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Not your compiler job" });
  });
});

describe("POST /api/study-arena-beta/compiler/jobs/:id/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.user = { id: 9, role: "teacher" };
    h.cancelCompilerJob.mockResolvedValue("cancelled");
  });

  it("cancels a compiler job for the owning teacher", async () => {
    const res = await request(makeApp()).post(`/api/study-arena-beta/compiler/jobs/${JOB_ID}/cancel`);

    expect(res.status).toBe(200);
    expect(h.cancelCompilerJob).toHaveBeenCalledWith(JOB_ID, { workspaceId: 42, teacherId: 9 });
    expect(res.body).toEqual({ jobId: JOB_ID, status: "cancelled" });
  });

  it("returns 403 when another teacher tries to cancel the job", async () => {
    h.cancelCompilerJob.mockResolvedValue("forbidden");
    const res = await request(makeApp()).post(`/api/study-arena-beta/compiler/jobs/${JOB_ID}/cancel`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Not your compiler job" });
  });

  it("returns 409 when the job is no longer cancellable", async () => {
    h.cancelCompilerJob.mockResolvedValue("not_cancellable");
    const res = await request(makeApp()).post(`/api/study-arena-beta/compiler/jobs/${JOB_ID}/cancel`);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Job cannot be cancelled" });
  });
});
