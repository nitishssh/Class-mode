import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() runs before ANY vi.mock hoisting, so these refs are safe to use
// inside vi.mock factory functions.
const { mockAiChat } = vi.hoisted(() => ({ mockAiChat: vi.fn() }));

import express from "express";
import request from "supertest";
import session from "express-session";
import { registerRoutes } from "../routes";

// ── Mock all heavy dependencies ────────────────────────────────────────────

vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn().mockResolvedValue(null), // default: Firebase fails → JWT path
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

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
  },
}));

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

// ── The KEY mock: openai lib ────────────────────────────────────────────────
vi.mock("../lib/openai", () => ({
  aiChat: mockAiChat,
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

    // JWT student user in Mongo
    const { MongoUser } = await import("../../shared/mongo-schema");
    (MongoUser.findOne as any).mockImplementation((q: any) => {
      if (q.id === 42)
        return Promise.resolve({ id: 42, role: "student", email: "student@test.com" });
      return Promise.resolve(null);
    });

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
    mockAiChat.mockResolvedValue({ content: "Gravity is…" });

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
    mockAiChat.mockResolvedValue({
      content: "Gravity is the force that attracts two masses toward each other.",
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
    expect(res.body.content.length).toBeGreaterThan(0);
    expect(mockAiChat).toHaveBeenCalledOnce();
  });

  // ── CASE 5: Multi-turn conversation preserved ──────────────────────────────
  it("should forward the full message history to aiChat", async () => {
    mockAiChat.mockResolvedValue({ content: "Yes, on the Moon gravity is 1/6th of Earth." });

    const messages = [
      { role: "user", content: "What is gravity?" },
      { role: "assistant", content: "Gravity is a fundamental force." },
      { role: "user", content: "Does it change on the Moon?" },
    ];

    await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({ messages });

    expect(mockAiChat.mock.calls[0][0]).toEqual(messages);
  });

  // ── CASE 6: AI service throws → 500 ───────────────────────────────────────
  it("should return 500 when the AI service throws an error", async () => {
    mockAiChat.mockRejectedValue(new Error("OpenAI API rate limit exceeded"));

    const res = await request(app)
      .post("/api/ai-chat")
      .set("Authorization", `Bearer ${makeStudentToken()}`)
      .send({
        messages: [{ role: "user", content: "Help me with chemistry homework." }],
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to generate/i);
  });
});
