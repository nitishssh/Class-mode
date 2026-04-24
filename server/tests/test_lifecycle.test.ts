import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("../lib/openai", () => ({
  aiChat: vi.fn(),
  evaluateSubjectiveAnswer: vi.fn(),
  generateStudyPlan: vi.fn(),
  analyzeTestPerformance: vi.fn(),
}));

// ── Storage mock — full lifecycle surface ──────────────────────────────────
const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
    getTest: vi.fn(),
    getTests: vi.fn(),
    createTest: vi.fn(),
    updateTest: vi.fn(),
    createQuestion: vi.fn(),
    getQuestion: vi.fn(),
    getQuestionsByTest: vi.fn(),
    createTestAttempt: vi.fn(),
    getTestAttempt: vi.fn(),
    updateTestAttempt: vi.fn(),
    getTestAttemptsByStudent: vi.fn().mockResolvedValue([]),
    createAnswer: vi.fn(),
    getAnswer: vi.fn(),
    getTestsByClass: vi.fn(),
  },
}));

vi.mock("../storage", () => ({ storage: mockStorage }));

// ── Helpers ─────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";

const JWT_SECRET = "super_secret_jwt_key_learning_pro_123";

const TEACHER_ID = 50;
const STUDENT_ID = 10;

function makeToken(userId: number, role: "teacher" | "student") {
  return jwt.sign({ userId, role, email: `${role}@test.com` }, JWT_SECRET, { expiresIn: "1h" });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const draftTest = {
  id: 1,
  teacherId: TEACHER_ID,
  class: "10A",
  status: "draft",
  title: "Physics Quiz",
};
const publishedTest = { ...draftTest, status: "published" };

const mcqQuestion = {
  id: 10,
  testId: 1,
  text: "Which planet is closest to the Sun?",
  type: "mcq",
  correctAnswer: "0", // index 0 = Mercury
  marks: 5,
};

const studentUser = { id: STUDENT_ID, role: "student", class: "10A" };
const teacherUser = { id: TEACHER_ID, role: "teacher", class: "10A" };

const inProgressAttempt = { id: 100, testId: 1, studentId: STUDENT_ID, status: "in_progress" };
const completedAttempt = { ...inProgressAttempt, status: "completed" };

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Test Lifecycle — Teacher creates, Student attempts and answers", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { MongoUser } = await import("../../shared/mongo-schema");
    (MongoUser.findOne as any).mockImplementation((q: any) => {
      if (q.id === TEACHER_ID) return Promise.resolve(teacherUser);
      if (q.id === STUDENT_ID) return Promise.resolve(studentUser);
      return Promise.resolve(null);
    });

    app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(app);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TESTS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /api/tests — Test creation", () => {
    it("should allow a teacher to create a test", async () => {
      const payload = {
        title: "Physics Quiz",
        class: "10A",
        teacherId: TEACHER_ID,
        subject: "Physics",
        testDate: "2026-03-09",
        questionTypes: ["mcq"],
      };
      mockStorage.createTest.mockResolvedValue({ id: 1, ...payload, status: "draft" });

      const res = await request(app)
        .post("/api/tests")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ title: "Physics Quiz", status: "draft" });
    });

    it("should return 401 when a student tries to create a test", async () => {
      const res = await request(app)
        .post("/api/tests")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({
          title: "Hack Test",
          class: "10A",
          teacherId: STUDENT_ID,
          subject: "Cheat",
          testDate: "2026-03-09",
          questionTypes: ["mcq"],
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/only teachers/i);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/tests")
        .send({
          title: "No auth",
          class: "10A",
          teacherId: 1,
          subject: "Math",
          testDate: "2026-03-09",
          questionTypes: ["mcq"],
        });

      expect(res.status).toBe(401);
    });

    it("should return 403 when teacher tries to create a test for another teacher", async () => {
      const res = await request(app)
        .post("/api/tests")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send({
          title: "Physics Quiz",
          class: "10A",
          teacherId: 999,
          subject: "Physics",
          testDate: "2026-03-09",
          questionTypes: ["mcq"],
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/only create tests for yourself/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST PUBLISH (PATCH)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("PATCH /api/tests/:id — Publish a test", () => {
    it("should allow a teacher to publish their own test", async () => {
      mockStorage.getTest.mockResolvedValue(draftTest);
      mockStorage.updateTest.mockResolvedValue(publishedTest);

      const res = await request(app)
        .patch("/api/tests/1")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send({ status: "published" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("published");
    });

    it("should return 403 when a teacher tries to update another teacher's test", async () => {
      const anotherTeachersTest = { ...draftTest, teacherId: 999 };
      mockStorage.getTest.mockResolvedValue(anotherTeachersTest);

      const res = await request(app)
        .patch("/api/tests/1")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send({ status: "published" });

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUESTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /api/questions — Question creation", () => {
    it("should allow a teacher to add a question to their own test", async () => {
      mockStorage.getTest.mockResolvedValue(draftTest);
      mockStorage.createQuestion.mockResolvedValue(mcqQuestion);

      const payload = {
        testId: 1,
        text: "Which planet is closest to the Sun?",
        type: "mcq",
        options: ["Mercury", "Venus", "Earth", "Mars"],
        correctAnswer: "0",
        marks: 5,
        order: 1,
      };

      const res = await request(app)
        .post("/api/questions")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.type).toBe("mcq");
    });

    it("should return 403 when teacher adds question to another teacher's test", async () => {
      mockStorage.getTest.mockResolvedValue({ ...draftTest, teacherId: 999 });

      const res = await request(app)
        .post("/api/questions")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send({ testId: 1, text: "Hack?", type: "mcq", correctAnswer: "0", marks: 5, order: 1 });

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST ATTEMPTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /api/test-attempts — Student starts a test", () => {
    it("should allow a student to start a published test for their class", async () => {
      mockStorage.getTest.mockResolvedValue(publishedTest);
      mockStorage.getUser.mockResolvedValue(studentUser);
      mockStorage.getTestAttemptsByStudent.mockResolvedValue([]);
      mockStorage.createTestAttempt.mockResolvedValue(inProgressAttempt);

      const res = await request(app)
        .post("/api/test-attempts")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ testId: 1, studentId: STUDENT_ID, status: "in_progress" });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("in_progress");
    });

    it("should return 401 when a teacher tries to start a test attempt", async () => {
      const res = await request(app)
        .post("/api/test-attempts")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send({ testId: 1, studentId: TEACHER_ID, status: "in_progress" });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/only students/i);
    });

    it("should prevent starting a test that is not yet published", async () => {
      mockStorage.getTest.mockResolvedValue(draftTest); // status = 'draft'
      mockStorage.getUser.mockResolvedValue(studentUser);

      const res = await request(app)
        .post("/api/test-attempts")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ testId: 1, studentId: STUDENT_ID, status: "in_progress" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not published/i);
    });

    it("should prevent a duplicate in-progress attempt for the same test", async () => {
      mockStorage.getTest.mockResolvedValue(publishedTest);
      mockStorage.getUser.mockResolvedValue(studentUser);
      // Already has an in-progress attempt
      mockStorage.getTestAttemptsByStudent.mockResolvedValue([inProgressAttempt]);

      const res = await request(app)
        .post("/api/test-attempts")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ testId: 1, studentId: STUDENT_ID, status: "in_progress" });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already have an in-progress attempt/i);
    });

    it("should prevent a student from starting a test for a different class", async () => {
      mockStorage.getTest.mockResolvedValue(publishedTest); // class: '10A'
      mockStorage.getUser.mockResolvedValue({ ...studentUser, class: "11B" }); // wrong class
      mockStorage.getTestAttemptsByStudent.mockResolvedValue([]);

      const res = await request(app)
        .post("/api/test-attempts")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ testId: 1, studentId: STUDENT_ID, status: "in_progress" });

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ANSWERS — MCQ AUTO-GRADING
  // ═══════════════════════════════════════════════════════════════════════════

  describe("POST /api/answers — MCQ answer auto-grading", () => {
    it("should award full marks for a correct MCQ answer", async () => {
      mockStorage.getTestAttempt.mockResolvedValue(inProgressAttempt);
      mockStorage.getQuestion.mockResolvedValue(mcqQuestion); // correctAnswer: '0'
      const expectedAnswer = {
        id: 200,
        attemptId: 100,
        questionId: 10,
        selectedOption: 0,
        isCorrect: true,
        score: 5, // full marks
      };
      mockStorage.createAnswer.mockResolvedValue(expectedAnswer);

      const res = await request(app)
        .post("/api/answers")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ attemptId: 100, questionId: 10, selectedOption: 0 }); // option 0 = Mercury ✓

      expect(res.status).toBe(201);
      expect(res.body.isCorrect).toBe(true);
      expect(res.body.score).toBe(5);
    });

    it("should award zero marks for an incorrect MCQ answer", async () => {
      mockStorage.getTestAttempt.mockResolvedValue(inProgressAttempt);
      mockStorage.getQuestion.mockResolvedValue(mcqQuestion);
      const wrongAnswer = {
        id: 201,
        attemptId: 100,
        questionId: 10,
        selectedOption: 2,
        isCorrect: false,
        score: 0,
      };
      mockStorage.createAnswer.mockResolvedValue(wrongAnswer);

      const res = await request(app)
        .post("/api/answers")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ attemptId: 100, questionId: 10, selectedOption: 2 }); // option 2 = Earth ✗

      expect(res.status).toBe(201);
      expect(res.body.isCorrect).toBe(false);
      expect(res.body.score).toBe(0);
    });

    it("should return 403 when student submits answer to another student's attempt", async () => {
      const anotherStudentsAttempt = { ...inProgressAttempt, studentId: 999 };
      mockStorage.getTestAttempt.mockResolvedValue(anotherStudentsAttempt);
      mockStorage.getQuestion.mockResolvedValue(mcqQuestion);

      const res = await request(app)
        .post("/api/answers")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ attemptId: 100, questionId: 10, selectedOption: 0 });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/not your test attempt/i);
    });

    it("should block answer submission on an already-completed attempt", async () => {
      mockStorage.getTestAttempt.mockResolvedValue(completedAttempt);
      mockStorage.getQuestion.mockResolvedValue(mcqQuestion);

      const res = await request(app)
        .post("/api/answers")
        .set("Authorization", `Bearer ${makeToken(STUDENT_ID, "student")}`)
        .send({ attemptId: 100, questionId: 10, selectedOption: 0 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already completed/i);
    });

    it("should return 401 when a teacher tries to submit an answer", async () => {
      const res = await request(app)
        .post("/api/answers")
        .set("Authorization", `Bearer ${makeToken(TEACHER_ID, "teacher")}`)
        .send({ attemptId: 100, questionId: 10, selectedOption: 0 });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/only students/i);
    });
  });
});
