// Route-level tests for the Study Arena beta surface. The valuable, previously
// untested logic here is the gate-answer logging: it must fire ONLY for real
// students, must carry the grouping keys the adoption metric needs, and must
// NEVER let a logging failure break the student's flow.

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  user: null as any,
  generateLessonScript: vi.fn(),
  respondToInteraction: vi.fn(),
  pgIncrementAIUsage: vi.fn(),
  commitLearnerUpdate: vi.fn(),
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

vi.mock("../services/study-arena/lesson-script", () => ({
  generateLessonScript: h.generateLessonScript,
  respondToInteraction: h.respondToInteraction,
}));

vi.mock("../lib/pg-queries", () => ({
  pgIncrementAIUsage: h.pgIncrementAIUsage,
}));

vi.mock("../lib/learner-model", () => ({
  commitLearnerUpdate: h.commitLearnerUpdate,
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import router from "../routes/study-arena-beta";
import { logger } from "../lib/logger";

function makeApp() {
  const app = express();
  app.use(express.json());
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

describe("POST /api/study-arena-beta/interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.user = { id: 7, role: "student" };
    h.respondToInteraction.mockResolvedValue({ feedback: "nice try", proceed: true, attempt: 1 });
    h.pgIncrementAIUsage.mockResolvedValue(undefined);
    h.commitLearnerUpdate.mockResolvedValue(true);
  });

  it("401s when unauthenticated", async () => {
    h.user = null;
    const res = await request(makeApp())
      .post("/api/study-arena-beta/interaction")
      .send(validInteraction);
    expect(res.status).toBe(401);
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
});
