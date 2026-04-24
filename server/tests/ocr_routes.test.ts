import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockProcessOCR } = vi.hoisted(() => ({ mockProcessOCR: vi.fn() }));

import express from "express";
import request from "supertest";
import session from "express-session";
import { registerRoutes } from "../routes";

// ── Mock all heavy dependencies ────────────────────────────────────────────

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

// ── The KEY mock: Tesseract OCR lib ────────────────────────────────────────
vi.mock("../lib/tesseract", () => ({
  processOCRImage: mockProcessOCR,
}));

// ── openai stub (required by routes.ts import) ─────────────────────────────
vi.mock("../lib/openai", () => ({
  aiChat: vi.fn(),
  evaluateSubjectiveAnswer: vi.fn(),
  generateStudyPlan: vi.fn(),
  analyzeTestPerformance: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

import jwt from "jsonwebtoken";

const JWT_SECRET = "super_secret_jwt_key_learning_pro_123";

function makeToken(userId = 10, role = "student") {
  return jwt.sign({ userId, role, email: `${role}@test.com` }, JWT_SECRET, { expiresIn: "1h" });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/ocr — Handwritten Image OCR", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { MongoUser } = await import("../../shared/mongo-schema");
    (MongoUser.findOne as any).mockImplementation((q: any) => {
      if (q.id === 10)
        return Promise.resolve({ id: 10, role: "student", email: "student@test.com" });
      if (q.id === 20)
        return Promise.resolve({ id: 20, role: "teacher", email: "teacher@test.com" });
      return Promise.resolve(null);
    });

    app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(app);
  });

  // ── CASE 1: No auth ────────────────────────────────────────────────────────
  it("should return 401 when no auth token is provided", async () => {
    const res = await request(app)
      .post("/api/ocr")
      .send({ imageData: "data:image/png;base64,abc123" });

    expect(res.status).toBe(401);
  });

  // ── CASE 2: Missing imageData ──────────────────────────────────────────────
  it("should return 400 when imageData is missing from the request body", async () => {
    mockProcessOCR.mockResolvedValue({ text: "" });

    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${makeToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Image data is required");
  });

  // ── CASE 3: Good clean handwriting — student auth ─────────────────────────
  it("should return 200 with extracted OCR text for a valid base64 image (student)", async () => {
    const fakeOCRResult = {
      text: "The force of gravity equals mass times gravitational acceleration.",
      confidence: 92,
    };
    mockProcessOCR.mockResolvedValue(fakeOCRResult);

    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${makeToken()}`)
      .send({ imageData: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(fakeOCRResult);
    expect(mockProcessOCR).toHaveBeenCalledOnce();
    expect(mockProcessOCR).toHaveBeenCalledWith("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA");
  });

  // ── CASE 4: Teacher can also use OCR ──────────────────────────────────────
  it("should return 200 for teacher-authenticated OCR request", async () => {
    mockProcessOCR.mockResolvedValue({ text: "Student answer text", confidence: 88 });

    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${makeToken(20, "teacher")}`)
      .send({ imageData: "data:image/jpeg;base64,/9j/4AAQSkZJRgAB" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("text");
  });

  // ── CASE 5: Low-confidence OCR (messy handwriting) returns result anyway ──
  it("should return the low-confidence OCR result without erroring", async () => {
    const lowConfidenceResult = {
      text: "Th3 f0rce 0f gr4v1ty",
      confidence: 31,
    };
    mockProcessOCR.mockResolvedValue(lowConfidenceResult);

    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${makeToken()}`)
      .send({ imageData: "data:image/png;base64,messybitshere" });

    expect(res.status).toBe(200);
    // API returns whatever OCR returns — caller decides if confidence is acceptable
    expect(res.body.confidence).toBe(31);
  });

  // ── CASE 6: Empty image / OCR returns blank string ────────────────────────
  it("should return 200 with empty text when OCR finds no readable content (blank page)", async () => {
    mockProcessOCR.mockResolvedValue({ text: "", confidence: 0 });

    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${makeToken()}`)
      .send({ imageData: "data:image/png;base64,AAAA" });

    expect(res.status).toBe(200);
    expect(res.body.text).toBe("");
  });

  // ── CASE 7: OCR library throws → 500 ──────────────────────────────────────
  it("should return 500 when the OCR library throws an unexpected error", async () => {
    mockProcessOCR.mockRejectedValue(new Error("Tesseract worker crashed"));

    const res = await request(app)
      .post("/api/ocr")
      .set("Authorization", `Bearer ${makeToken()}`)
      .send({ imageData: "data:image/png;base64,corruptdata" });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to process ocr/i);
  });
});
