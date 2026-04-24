import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import { MongoUser } from "../../shared/mongo-schema";
import session from "express-session";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
}));

// Mock MongoDB
const instances: any[] = [];
vi.mock("../../shared/mongo-schema", () => {
  const saveMock = vi.fn().mockResolvedValue(true);
  function MockUser(this: any, data: any) {
    Object.assign(this, data);
    this.save = saveMock;
    instances.push(this);
  }
  // @ts-ignore
  MockUser.findOne = vi.fn();
  // @ts-ignore
  MockUser.findOneAndUpdate = vi.fn();
  // @ts-ignore
  MockUser.save = saveMock;

  return {
    MongoUser: MockUser,
    getNextSequenceValue: vi.fn().mockResolvedValue(123),
    MongoWorkspace: { findOne: vi.fn() },
    MongoChannel: { findOne: vi.fn() },
    MongoMessage: {
      findOne: vi.fn(),
      find: vi
        .fn()
        .mockReturnValue({
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
  default: {
    router: express.Router(),
  },
}));

vi.mock("../chat-ws", () => ({
  setupChatWebSocket: vi.fn(),
}));

vi.mock("../lib/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

describe("User Registration Status", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    instances.length = 0; // Clear instances array
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-secret",
        resave: false,
        saveUninitialized: false,
      })
    );
    await registerRoutes(app);
  });

  it("should set status to pending when a teacher registers", async () => {
    (MongoUser.findOne as vi.Mock).mockResolvedValue(null);

    const registrationData = {
      name: "Teacher Test",
      email: "teacher@test.com",
      password: "password123",
      role: "teacher",
    };

    const res = await request(app).post("/api/auth/register").send(registrationData);

    expect(res.status).toBe(201);
    expect(instances.length).toBe(1);
    expect(instances[0].role).toBe("teacher");
    expect(instances[0].status).toBe("pending");
  });

  it("should set status to active when a student registers", async () => {
    (MongoUser.findOne as vi.Mock).mockResolvedValue(null);

    const registrationData = {
      name: "Student Test",
      email: "student@test.com",
      password: "password123",
      role: "student",
    };

    const res = await request(app).post("/api/auth/register").send(registrationData);

    expect(res.status).toBe(201);
    expect(instances.length).toBe(1);
    expect(instances[0].role).toBe("student");
    expect(instances[0].status).toBe("active");
  });

  it("should set status to pending when a teacher registers via Firebase bridge", async () => {
    const { verifyFirebaseToken } = await import("../lib/firebase-admin");
    (verifyFirebaseToken as vi.Mock).mockResolvedValue({
      uid: "fire-uid-1",
      email: "fire-teacher@test.com",
      name: "Fire Teacher",
    });
    (MongoUser.findOne as vi.Mock).mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/firebase")
      .send({ idToken: "valid-token", role: "teacher" });

    expect(res.status).toBe(200);
    expect(instances.length).toBe(1);
    expect(instances[0].role).toBe("teacher");
    expect(instances[0].status).toBe("pending");
  });
});
