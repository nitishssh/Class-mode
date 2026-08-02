import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import session from "express-session";
import { pgFindUserById } from "../lib/db/pg-queries";

// Mock dependencies
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
}));

vi.mock("../chat-ws", () => ({
  setupChatWebSocket: vi.fn(),
}));

vi.mock("../lib/db/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

// Mock the internal Study Arena service used by the route
vi.mock("../services/study-arena/internal-service", () => ({
  studyArenaInternalService: {
    createClassroom: vi.fn().mockResolvedValue({ jobId: "job_abc123" }),
    pollJob: vi.fn().mockResolvedValue({
      jobId: "job_abc123",
      status: "succeeded",
      step: "completed",
      progress: 100,
      message: "Done",
      done: true,
      result: { classroomId: 1 },
    }),
    listClassrooms: vi.fn().mockResolvedValue({
      classrooms: [{ id: 1, topic: "React Testing", status: "ready", createdAt: new Date() }],
      total: 1,
    }),
    cancelJob: vi.fn().mockReturnValue(true),
    deleteClassroom: vi.fn().mockResolvedValue(true),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("AI Classroom Routes", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    (pgFindUserById as Mock).mockResolvedValue({
      id: 1,
      role: "student",
      email: "test@test.com",
    });
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
    const res = await request(app)
      .post("/api/ai-classroom/create")
      .set("Authorization", "Bearer valid_token")
      .send({
        topic: "Artificial Intelligence",
        sceneTypes: ["slides", "quiz"],
      });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe("job_abc123");
    expect(res.body.status).toBe("generating");
  });

  it("should poll job status", async () => {
    const res = await request(app)
      .get("/api/ai-classroom/status/job_abc123")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(res.body.jobId).toBe("job_abc123");
    expect(res.body.done).toBe(true);
    expect(res.body.status).toBe("succeeded");
  });

  it("should fetch user classrooms", async () => {
    const res = await request(app)
      .get("/api/ai-classroom/my-classrooms")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.classrooms)).toBe(true);
    expect(res.body.classrooms[0].topic).toBe("React Testing");
  });
});
