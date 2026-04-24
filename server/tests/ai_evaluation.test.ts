import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockEvaluate, mockStorage } = vi.hoisted(() => ({
  mockEvaluate: vi.fn(),
  mockStorage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
    getAnswer: vi.fn(),
    getQuestion: vi.fn(),
    getTestAttempt: vi.fn(),
    getTest: vi.fn(),
    updateAnswer: vi.fn(),
  },
}));

import express from "express";
import request from "supertest";
import session from "express-session";
import { registerRoutes } from "../routes";

// ── Dependency mocks ───────────────────────────────────────────────────────

vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../shared/mongo-schema", () => {
  const saveMock = vi.fn().mockResolvedValue(true);
  function MockUser(this: any, data: any) {
    Object.assign(this, data);
    this.save = saveMock;
  }
  MockUser.findOne = vi.fn();
  return {
    MongoUser: MockUser,
    getNextSequenceValue: vi.fn().mockResolvedValue(1),
    MongoWorkspace: { findOne: vi.fn() },
    MongoChannel: { findOne: vi.fn() },
    MongoMessage: {
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    },
  };
});

vi.mock("../message", () => ({
  setupMessagePalWebSocket: vi.fn(),
  startMessagePalServer: vi.fn(),
  default: { router: express.Router() },
}));

vi.mock("../chat-ws", () => ({ setupChatWebSocket: vi.fn() }));

vi.mock("../lib/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

vi.mock("../lib/tesseract", () => ({ processOCRImage: vi.fn() }));

// ── AI evaluation mock ─────────────────────────────────────────────────────
vi.mock("../lib/openai", () => ({
  aiChat: vi.fn(),
  evaluateSubjectiveAnswer: mockEvaluate,
  generateStudyPlan: vi.fn(),
  analyzeTestPerformance: vi.fn(),
}));

// ── Storage mock ───────────────────────────────────────────────────────────
vi.mock("../storage", () => ({
  storage: mockStorage,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";

const JWT_SECRET = "super_secret_jwt_key_learning_pro_123";

function makeToken(userId: number, role: "teacher" | "student") {
  return jwt.sign({ userId, role, email: `${role}${userId}@test.com` }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

const TEACHER_ID = 50;
const OTHER_TEACHER_ID = 99;
const STUDENT_ID = 10;

// ── Test data ────────────────────────────────────────────────────────────────

const mockAnswer = {
  id: 101,
  attemptId: 201,
  questionId: 301,
  text: "Photosynthesis converts sunlight into glucose.",
  ocrText: null,
  score: null,
  aiConfidence: null,
  aiFeedback: null,
};

const mockQuestion = {
  id: 301,
  text: "What is photosynthesis?",
  marks: 10,
  aiRubric: "Award marks for: light energy, glucose, chlorophyll, CO2 + H2O.",
  type: "subjective",
};

const mockAttempt = { id: 201, testId: 401, studentId: STUDENT_ID };

const mockTest = { id: 401, teacherId: TEACHER_ID, class: "10A" };

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/evaluate — AI-Powered Subjective Grading", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { MongoUser } = await import("../../shared/mongo-schema");
    (MongoUser.findOne as any).mockImplementation((q: any) => {
      if (q.id === TEACHER_ID)
        return Promise.resolve({ id: TEACHER_ID, role: "teacher", email: "teacher@test.com" });
      if (q.id === OTHER_TEACHER_ID)
        return Promise.resolve({ id: OTHER_TEACHER_ID, role: "teacher", email: "other@test.com" });
      if (q.id === STUDENT_ID)
        return Promise.resolve({ id: STUDENT_ID, role: "student", email: "student@test.com" });
      return Promise.resolve(null);
    });

    // Default happy-path storage chain
    mockStorage.getAnswer.mockResolvedValue(mockAnswer);
    mockStorage.getQuestion.mockResolvedValue(mockQuestion);
    mockStorage.getTestAttempt.mockResolvedValue(mockAttempt);
    mockStorage.getTest.mockResolvedValue(mockTest);
    mockStorage.updateAnswer.mockImplementation((id: any, updates: any) =>
      Promise.resolve({ ...mockAnswer, ...updates })
    );

    app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(app);
  });

  // ── CASE 1: Student cannot evaluate ───────────────────────────────────────
  it("should return 401 when a student tries to evaluate an answer", async () => {
    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
      .send({ answerId: 101 });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/only teachers/i);
  });

  // ── CASE 2: Missing answerId ───────────────────────────────────────────────
  it("should return 400 when answerId is not provided", async () => {
    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/answer id is required/i);
  });

  // ── CASE 3: Answer not found ───────────────────────────────────────────────
  it("should return 404 when answerId does not correspond to any answer", async () => {
    mockStorage.getAnswer.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 9999 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/answer not found/i);
  });

  // ── CASE 4: Question not found ────────────────────────────────────────────
  it("should return 404 when the question linked to the answer is missing", async () => {
    mockStorage.getQuestion.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/question not found/i);
  });

  // ── CASE 5: Test attempt not found ────────────────────────────────────────
  it("should return 404 when the test attempt is missing", async () => {
    mockStorage.getTestAttempt.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/test attempt not found/i);
  });

  // ── CASE 6: Test not found ─────────────────────────────────────────────────
  it("should return 404 when the test linked to the attempt is missing", async () => {
    mockStorage.getTest.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/test not found/i);
  });

  // ── CASE 7: Wrong teacher — cross-test access forbidden ───────────────────
  it("should return 403 when a teacher tries to evaluate an answer from another teacher's test", async () => {
    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(OTHER_TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    // mockTest.teacherId = TEACHER_ID, but request comes from OTHER_TEACHER_ID
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not your test/i);
  });

  // ── CASE 8: Happy path — typed text answer ────────────────────────────────
  it("should evaluate a typed text answer and return updated answer with AI score and feedback", async () => {
    const aiResult = {
      score: 8,
      confidence: 90,
      feedback: "Good explanation. Mention chlorophyll next time.",
    };
    mockEvaluate.mockResolvedValue(aiResult);

    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(8);
    expect(res.body.aiConfidence).toBe(90);
    expect(res.body.aiFeedback).toBe("Good explanation. Mention chlorophyll next time.");

    // Should have been called with the text answer and question details
    expect(mockEvaluate).toHaveBeenCalledWith(
      mockAnswer.text,
      mockQuestion.text,
      mockQuestion.aiRubric,
      mockQuestion.marks
    );
  });

  // ── CASE 9: Happy path — uses OCR text when available ─────────────────────
  it("should prefer OCR-extracted text over typed text for evaluation", async () => {
    const answerWithOCR = {
      ...mockAnswer,
      ocrText: "Photosynthesis uses chlorophyll to make food from sunlight.",
    };
    mockStorage.getAnswer.mockResolvedValue(answerWithOCR);
    const aiResult = { score: 9, confidence: 85, feedback: "Excellent mention of chlorophyll." };
    mockEvaluate.mockResolvedValue(aiResult);

    await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    // Should pass the ocrText, not the typed text
    expect(mockEvaluate).toHaveBeenCalledWith(
      answerWithOCR.ocrText,
      mockQuestion.text,
      mockQuestion.aiRubric,
      mockQuestion.marks
    );
  });

  // ── CASE 10: Partial credit — paraphrased correct answer ─────────────────
  it("should accept partial AI scores between 0 and maxMarks", async () => {
    mockEvaluate.mockResolvedValue({
      score: 5,
      confidence: 70,
      feedback: "Partially correct. Missing key details.",
    });
    mockStorage.updateAnswer.mockResolvedValue({
      ...mockAnswer,
      score: 5,
      aiConfidence: 70,
      aiFeedback: "Partially correct. Missing key details.",
    });

    const res = await request(app)
      .post("/api/evaluate")
      .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
      .send({ answerId: 101 });

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(5);
    expect(res.body.aiFeedback).toMatch(/partially correct/i);
  });
});
