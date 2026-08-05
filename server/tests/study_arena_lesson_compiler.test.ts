import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHash } from "crypto";

const h = vi.hoisted(() => ({
  pgReady: true,
  redisConfigured: false,
  query: vi.fn(),
  generateLessonScript: vi.fn(),
}));

vi.mock("../db-pg", () => ({
  isPgReady: () => h.pgReady,
  getPgPool: () => ({ query: h.query }),
}));

vi.mock("../lib/db/redis", () => ({
  isRedisConfigured: () => h.redisConfigured,
  newRedisConnection: () => null,
  BULLMQ_PREFIX: "{bull}",
}));

vi.mock("../services/study-arena/lesson-script", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/study-arena/lesson-script")>();
  return {
    ...actual,
    generateLessonScript: h.generateLessonScript,
  };
});

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../services/study-arena/concept-registry", () => ({
  getStudyArenaConcept: () => ({ id: "linear-equations-isolation" }),
}));

import {
  fingerprintRequest,
  enqueueLessonCompile,
  cancelCompilerJob,
  getCompilerJob,
} from "../services/study-arena/lesson-compiler";
import { createLinearEquationsSprint } from "../services/study-arena/lesson-script";

const WORKSPACE_ID = 42;
const TEACHER_ID = 9;
const JOB_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function baseJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    workspace_id: WORKSPACE_ID,
    teacher_id: TEACHER_ID,
    request_fingerprint: fingerprintRequest({
      workspaceId: WORKSPACE_ID,
      sourceText: "x + 4 = 11",
      objective: "Isolate x",
      subject: "Mathematics",
      gradeLevel: "8",
    }),
    status: "queued",
    progress: { stage: "queued", percent: 0 },
    source_text: "x + 4 = 11",
    objective: "Isolate x",
    subject: "Mathematics",
    grade_level: "8",
    lesson_version_id: null,
    error_message: null,
    bullmq_job_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    cancelled_at: null,
    ...overrides,
  };
}

describe("fingerprintRequest", () => {
  it("is stable for the same normalized inputs", () => {
    const a = fingerprintRequest({
      workspaceId: 1,
      sourceText: "  hello ",
      objective: " learn ",
      subject: "Math",
      gradeLevel: "7",
    });
    const b = fingerprintRequest({
      workspaceId: 1,
      sourceText: "hello",
      objective: "learn",
      subject: "math",
      gradeLevel: "7",
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toBe(
      createHash("sha256")
        .update(
          JSON.stringify({
            workspaceId: 1,
            sourceText: "hello",
            objective: "learn",
            subject: "math",
            gradeLevel: "7",
          })
        )
        .digest("hex")
    );
  });

  it("changes when source text changes", () => {
    const a = fingerprintRequest({
      workspaceId: 1,
      sourceText: "a",
      objective: "o",
      subject: "s",
    });
    const b = fingerprintRequest({
      workspaceId: 1,
      sourceText: "b",
      objective: "o",
      subject: "s",
    });
    expect(a).not.toBe(b);
  });
});

describe("enqueueLessonCompile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pgReady = true;
    h.redisConfigured = false;
    h.generateLessonScript.mockResolvedValue(createLinearEquationsSprint());
  });

  it("returns database_unavailable when Postgres is off", async () => {
    h.pgReady = false;
    const result = await enqueueLessonCompile({
      workspaceId: WORKSPACE_ID,
      teacherId: TEACHER_ID,
      sourceText: "x + 4 = 11",
      objective: "Isolate x",
      subject: "Mathematics",
    });
    expect(result).toEqual({ status: "database_unavailable" });
  });

  it("dedupes an in-flight job with the same fingerprint", async () => {
    const existing = baseJobRow({ status: "running" });
    h.query.mockResolvedValueOnce({ rows: [existing] });
    const result = await enqueueLessonCompile({
      workspaceId: WORKSPACE_ID,
      teacherId: TEACHER_ID,
      sourceText: "x + 4 = 11",
      objective: "Isolate x",
      subject: "Mathematics",
      gradeLevel: "8",
    });
    expect(result.status).toBe("running");
    if (result.status === "running" || result.status === "queued" || result.status === "completed") {
      expect(result.deduped).toBe(true);
      expect(result.job.id).toBe(JOB_ID);
    }
  });

  it("dedupes when a concurrent insert hits the active-fingerprint unique index", async () => {
    const winner = baseJobRow({ status: "queued" });
    h.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT miss
      .mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }))
      .mockResolvedValueOnce({ rows: [winner] }); // re-SELECT winner

    const result = await enqueueLessonCompile({
      workspaceId: WORKSPACE_ID,
      teacherId: TEACHER_ID,
      sourceText: "x + 4 = 11",
      objective: "Isolate x",
      subject: "Mathematics",
      gradeLevel: "8",
    });

    expect(result.status).toBe("queued");
    if (result.status === "queued") {
      expect(result.deduped).toBe(true);
      expect(result.job.id).toBe(JOB_ID);
    }
  });

  it("runs sync fallback when Redis is off and marks the job completed", async () => {
    const inserted = baseJobRow();
    // 1) dedupe miss
    h.query.mockResolvedValueOnce({ rows: [] });
    // 2) insert job
    h.query.mockResolvedValueOnce({ rows: [inserted] });
    // 3) fetchJob at start of runCompile
    h.query.mockResolvedValueOnce({ rows: [inserted] });
    // 4) claim running
    h.query.mockResolvedValueOnce({ rows: [{ id: JOB_ID }] });
    // 5) cancellation checkpoint fetch
    h.query.mockResolvedValueOnce({ rows: [{ ...inserted, status: "running" }] });
    // 6) after generate fetch
    h.query.mockResolvedValueOnce({ rows: [{ ...inserted, status: "running" }] });
    // 7) update progress persisting
    h.query.mockResolvedValueOnce({ rows: [] });
    // 8) create draft lesson version
    h.query.mockResolvedValueOnce({ rows: [{ id: VERSION_ID }] });
    // 9) mark completed (RETURNING id)
    h.query.mockResolvedValueOnce({ rows: [{ id: JOB_ID }] });
    // 10) refresh after sync
    h.query.mockResolvedValueOnce({
      rows: [baseJobRow({ status: "completed", lesson_version_id: VERSION_ID })],
    });

    const result = await enqueueLessonCompile({
      workspaceId: WORKSPACE_ID,
      teacherId: TEACHER_ID,
      sourceText: "x + 4 = 11",
      objective: "Isolate x",
      subject: "Mathematics",
      gradeLevel: "8",
    });

    expect(h.generateLessonScript).toHaveBeenCalled();
    expect(result.status).toBe("completed");
    if (result.status === "completed") {
      expect(result.job.lessonVersionId).toBe(VERSION_ID);
      expect(result.deduped).toBe(false);
    }
  });
});

describe("cancelCompilerJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.pgReady = true;
  });

  it("cancels a queued job owned by the teacher", async () => {
    h.query
      .mockResolvedValueOnce({ rows: [baseJobRow()] }) // fetchJob
      .mockResolvedValueOnce({ rows: [{ id: JOB_ID }] }); // mark cancelled
    const result = await cancelCompilerJob(JOB_ID, {
      workspaceId: WORKSPACE_ID,
      teacherId: TEACHER_ID,
    });
    expect(result).toBe("cancelled");
  });

  it("rejects cancel for another teacher", async () => {
    h.query.mockResolvedValueOnce({ rows: [baseJobRow()] });
    const result = await cancelCompilerJob(JOB_ID, {
      workspaceId: WORKSPACE_ID,
      teacherId: 999,
    });
    expect(result).toBe("forbidden");
  });
});

describe("getCompilerJob", () => {
  it("maps a row to CompilerJobRow", async () => {
    h.query.mockResolvedValueOnce({ rows: [baseJobRow({ status: "failed", error_message: "boom" })] });
    const job = await getCompilerJob(JOB_ID);
    expect(job?.status).toBe("failed");
    expect(job?.errorMessage).toBe("boom");
    expect(job?.workspaceId).toBe(WORKSPACE_ID);
  });
});
