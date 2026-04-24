import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import session from "express-session";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(true),
}));

// Mock MongoDB AIClassroom model
vi.mock("../../shared/mongo-schema", () => {
  function MockAIClassroom(this: { [key: string]: unknown }, data: Record<string, unknown>) {
    Object.assign(this, data);
    this.save = vi.fn().mockResolvedValue(true);
  }
  MockAIClassroom.find = vi.fn().mockReturnValue({
    sort: vi.fn().mockResolvedValue([
      {
        studyArenaJobId: "job_abc123",
        classroomId: "class_1",
        userId: "uid123",
        topic: "React Testing",
        status: "ready",
        url: "http://localhost:3000/classroom/class_1",
        createdAt: new Date(),
      }
    ])
  });
  MockAIClassroom.findOneAndUpdate = vi.fn().mockResolvedValue(true);

  return {
    MongoAIClassroom: MockAIClassroom,
    MongoUser: {
      findOne: vi.fn().mockResolvedValue({
        id: 1,
        firebaseUid: "uid123",
        email: "test@test.com",
        role: "student",
        save: vi.fn().mockResolvedValue(true),
      })
    },
    MongoWorkspace: { findOne: vi.fn() },
    MongoChannel: { findOne: vi.fn() },
    MongoMessage: {
      findOne: vi.fn(),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    },
    getNextSequenceValue: vi.fn().mockResolvedValue(1),
  };
});

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
    sessionStore: {},
  },
}));

vi.mock("../message", () => ({
  setupMessagePalWebSocket: vi.fn(),
  startMessagePalServer: vi.fn(),
}));

vi.mock("../chat-ws", () => ({
  setupChatWebSocket: vi.fn(),
}));

vi.mock("../lib/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

// Mock Study Arena Client
vi.mock("../services/study-arena-client", () => ({
  getStudyArenaClient: vi.fn().mockImplementation(() => ({
    createClassroom: vi.fn().mockResolvedValue({
      jobId: "job_abc123",
      status: "pending",
      step: "Queued",
      message: "Classroom generation started",
      pollUrl: "http://localhost:3000/api/generate-classroom/job_abc123",
      pollIntervalMs: 5000,
    }),
    pollJob: vi.fn().mockResolvedValue({
      jobId: "job_abc123",
      status: "succeeded",
      step: "Complete",
      done: true,
      result: {
        classroomId: "class_new_456",
        url: "http://localhost:3000/classroom/class_new_456",
      },
    }),
    healthCheck: vi.fn().mockResolvedValue(true),
  })),
  StudyArenaClient: vi.fn(),
}));

describe("AI Classroom Routes", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
      })
    );
    
    // Inject mock user into session
    app.use((req, res, next) => {
      req.session.userId = 1;
      (req.session as unknown as { profile: Record<string, string> }).profile = {
        uid: "uid123",
        role: "student",
      };
      next();
    });

    await registerRoutes(app);
  });

  it("should submit a classroom generation job and return jobId", async () => {
    (verifyFirebaseToken as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      uid: "uid123",
      email: "test@test.com",
      role: "student",
    });

    const res = await request(app)
      .post("/api/ai-classroom/create")
      .set("Authorization", "Bearer valid_token")
      .send({
        topic: "Artificial Intelligence",
        sceneTypes: ["slides", "quiz"]
      });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe("job_abc123");
    expect(res.body.status).toBe("generating");
  });

  it("should poll job status", async () => {
    (verifyFirebaseToken as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      uid: "uid123",
      email: "test@test.com",
      role: "student",
    });

    const res = await request(app)
      .get("/api/ai-classroom/job/job_abc123")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe("job_abc123");
    expect(res.body.done).toBe(true);
    expect(res.body.status).toBe("succeeded");
  });

  it("should fetch user classrooms", async () => {
    (verifyFirebaseToken as unknown as { mockResolvedValue: (val: unknown) => void }).mockResolvedValue({
      uid: "uid123",
      email: "test@test.com",
      role: "student",
    });

    const res = await request(app)
      .get("/api/ai-classroom/my-classrooms")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].topic).toBe("React Testing");
  });
});
