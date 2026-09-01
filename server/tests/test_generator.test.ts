import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { pgFindUserById, pgFindFirstWorkspaceMembership } from "../lib/db/pg-queries";

const { mockGenerate, mockGenerateContentFromPdf } = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockGenerateContentFromPdf: vi.fn(),
}));

import express from "express";
import request from "supertest";
import session from "express-session";
import { registerRoutes } from "../routes";

// Mock out heavy dependencies
vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../message", () => ({
  setupMessagePalWebSocket: vi.fn(),
  default: { router: express.Router() },
}));

vi.mock("../chat-ws", () => ({ setupChatWebSocket: vi.fn() }));

vi.mock("../lib/db/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

// Partial-mock: stub only `generate`, keep the real MODEL_REGISTRY etc. so
// other modules loaded via registerRoutes (e.g. gradingService) still work.
vi.mock("../lib/ai/gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/ai/gateway")>();
  return { ...actual, generate: mockGenerate };
});

vi.mock("../lib/ai/openai", () => ({
  evaluateSubjectiveAnswer: vi.fn(),
}));

// Full replacement, so it must cover every export the gateway reads.
// GEMINI_DEFAULT_MODEL is one: generateFromPdf pins the Gemini model itself
// now that the `fast` role resolves to Sarvam and no longer implies Gemini.
vi.mock("../lib/ai/gemini", () => ({
  generateContentFromPdf: mockGenerateContentFromPdf,
  geminiChat: vi.fn(),
  streamGeminiChat: vi.fn(),
  verifyGeminiAccess: vi.fn(),
  GEMINI_DEFAULT_MODEL: "gemini-3.6-flash",
}));

import jwt from "jsonwebtoken";
const JWT_SECRET = "super_secret_jwt_key_learning_pro_123";

function makeTeacherToken() {
  return jwt.sign({ userId: 1, role: "teacher", email: "teacher@test.com" }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

describe("Test Generator API Endpoints", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    (pgFindUserById as Mock).mockImplementation((id: number) => {
      if (id === 1)
        return Promise.resolve({
          id: 1,
          role: "teacher",
          email: "teacher@test.com",
          status: "active",
          emailVerified: true,
        });
      return Promise.resolve(null);
    });
    (pgFindFirstWorkspaceMembership as Mock).mockResolvedValue(null);

    app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(app);
  });

  describe("POST /api/ai/generate-test timeout behavior", () => {
    it("should handle timeout correctly and respond with 504", async () => {
      // Mock the AI gateway to reject with a timeout error.
      mockGenerate.mockRejectedValue(new Error("Request timed out"));

      const res = await request(app)
        .post("/api/ai/generate-test")
        .set("Authorization", `Bearer ${makeTeacherToken()}`)
        .send({ subject: "Physics", numQuestions: 5, difficulty: "medium", grade: "10" });

      expect(res.status).toBe(504);
      expect(res.body.message).toMatch(/timed out/i);
    });
  });

  describe("OPTIONS /api/ai/generate-from-pdf", () => {
    it("should respond to OPTIONS request with CORS headers", async () => {
      const res = await request(app)
        .options("/api/ai/generate-from-pdf")
        .set("Origin", "https://coachingcenter.com");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://coachingcenter.com");
      expect(res.headers["access-control-allow-methods"]).toContain("POST");
    });
  });

  describe("POST /api/ai/generate-from-pdf", () => {
    it("should successfully generate questions with valid pdfData (authenticated)", async () => {
      const mockQuestions = [
        {
          question: "What is gravity?",
          options: ["A force", "A chemical", "A particle", "A wave"],
          answer: "A force",
          explanation: "Gravity attracts mass.",
        },
      ];
      mockGenerateContentFromPdf.mockResolvedValue(JSON.stringify(mockQuestions));

      const res = await request(app)
        .post("/api/ai/generate-from-pdf")
        .set("Authorization", `Bearer ${makeTeacherToken()}`)
        .send({
          pdfData: "data:application/pdf;base64,dGVzdA==", // base64 for "test"
          numQuestions: 1,
          difficulty: "easy",
          grade: "9",
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockQuestions);
      expect(mockGenerateContentFromPdf).toHaveBeenCalledOnce();
    });

    it("should successfully generate questions (anonymous/unauthenticated)", async () => {
      const mockQuestions = [
        {
          question: "What is gravity?",
          options: ["A force", "A chemical", "A particle", "A wave"],
          answer: "A force",
          explanation: "Gravity attracts mass.",
        },
      ];
      mockGenerateContentFromPdf.mockResolvedValue(JSON.stringify(mockQuestions));

      const res = await request(app).post("/api/ai/generate-from-pdf").send({
        pdfData: "data:application/pdf;base64,dGVzdA==",
        numQuestions: 1,
        difficulty: "easy",
        grade: "9",
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockQuestions);
    });

    it("should return 400 if pdfData or file is missing", async () => {
      const res = await request(app).post("/api/ai/generate-from-pdf").send({
        numQuestions: 1,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/no pdf/i);
    });
  });
});
