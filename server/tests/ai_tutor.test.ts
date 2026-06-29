import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

import { pgFindUserById, pgFindFirstWorkspaceMembership } from "../lib/pg-queries";

// vi.hoisted() runs before ANY vi.mock hoisting, so these refs are safe to use
// inside vi.mock factory functions.
const { mockRunTutorTurn, mockGradeTutorTurn } = vi.hoisted(() => ({
  mockRunTutorTurn: vi.fn(),
  mockGradeTutorTurn: vi.fn(),
}));

import express from "express";
import request from "supertest";
import session from "express-session";
import { registerRoutes } from "../routes";

// ── Mock all heavy dependencies ────────────────────────────────────────────

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

vi.mock("../lib/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

// Mock the orchestrator and grader service
vi.mock("../lib/orchestrator", () => ({
  runTutorTurn: mockRunTutorTurn,
  commitTurnOutcome: vi.fn(),
}));

vi.mock("../lib/grader-service", () => ({
  gradeTutorTurn: mockGradeTutorTurn,
}));

// ── The KEY mock: openai lib ────────────────────────────────────────────────
vi.mock("../lib/openai", () => ({
  aiChat: vi.fn(),
  evaluateSubjectiveAnswer: vi.fn(),
  generateStudyPlan: vi.fn(),
  analyzeTestPerformance: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";

const JWT_SECRET = "super_secret_jwt_key_learning_pro_123";

function makeStudentToken() {
  return jwt.sign({ userId: 42, role: "student", email: "student@test.com" }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/ai-chat — AI Tutor", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    (pgFindUserById as Mock).mockImplementation((id: number) => {
      if (id === 42)
        return Promise.resolve({
          id: 42,
          role: "student",
          email: "student@test.com",
          status: "active",
          emailVerified: true,
        });
      return Promise.resolve(null);
    });
    (pgFindFirstWorkspaceMembership as Mock).mockResolvedValue(null);

    mockRunTutorTurn.mockResolvedValue({
      reply: "Gravity is a force.",
      snapshot: { mastery: [], dueReviews: [], recentMemory: [] },
    });
    mockGradeTutorTurn.mockResolvedValue(undefined);

    app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(app);
  });

  // ── CASE 1: No auth token ──────────────────────────────────────────────────
  it("should return 401 when no Authorization header is provided", async () => {
    const res = await request(app)
      .post("/api/ai-chat")
      .send({ messages: [{ role: "user", content: "What is gravity?" }] });

    expect(res.status).toBe(401);
  });

  // ── CASE 2: Missing messages ───────────────────────────────────────────────
  it("should return 400 when messages field is missing", async () => {
    const res = await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid messages/i);
  });

  // ── CASE 3: messages is not an array ──────────────────────────────────────
  it("should return 400 when messages is not an array", async () => {
    const res = await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({ messages: "Tell me about gravity" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid messages/i);
  });

  // ── CASE 4: Happy path ─────────────────────────────────────────────────────
  it("should return 200 with AI tutor response for valid messages", async () => {
    mockRunTutorTurn.mockResolvedValue({
      reply: "Gravity is the force that attracts two masses toward each other.",
      snapshot: { mastery: [], dueReviews: [], recentMemory: [] },
    });

    const res = await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({
        messages: [{ role: "user", content: "What is gravity?" }],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("content");
    expect(typeof res.body.content).toBe("string");
    expect(res.body.content).toBe(
      "Gravity is the force that attracts two masses toward each other."
    );
    expect(mockRunTutorTurn).toHaveBeenCalledOnce();
  });

  // ── CASE 5: Multi-turn conversation preserved ──────────────────────────────
  it("should forward the full message history to runTutorTurn", async () => {
    const messages = [
      { role: "user", content: "What is gravity?" },
      { role: "assistant", content: "Gravity is a fundamental force." },
      { role: "user", content: "Does it change on the Moon?" },
    ];

    await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({ messages });

    const callArgs = mockRunTutorTurn.mock.calls[0][0];
    expect(callArgs.history).toEqual(messages.slice(0, -1));
    expect(callArgs.message).toBe("Does it change on the Moon?");
  });

  // ── CASE 6: AI service throws → 500 ───────────────────────────────────────
  it("should return 500 when the AI service throws an error", async () => {
    mockRunTutorTurn.mockRejectedValue(new Error("AI Gateway is down"));

    const res = await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({
        messages: [{ role: "user", content: "Help me with chemistry homework." }],
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to generate/i);
  });

  // ── CASE 7: Background grader hook triggered ──────────────────────────────
  it("should trigger background grader on response finish if concept is specified", async () => {
    mockRunTutorTurn.mockResolvedValue({
      reply: "Learning is fun!",
      snapshot: { mastery: [], dueReviews: [], recentMemory: [] },
    });

    const res = await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({
        messages: [{ role: "user", content: "What is gravity?" }],
        concept: "gravity-formula",
      });

    expect(res.status).toBe(200);
    expect(res.body.content).toBe("Learning is fun!");

    // Wait a brief moment for the express response finish event loop to fire
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGradeTutorTurn).toHaveBeenCalledWith({
      studentId: 42,
      concept: "gravity-formula",
      subject: undefined,
      history: [],
      latestMessage: "What is gravity?",
    });
  });
});
