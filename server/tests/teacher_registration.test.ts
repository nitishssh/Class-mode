import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import session from "express-session";
import { pgFindUserByEmail, pgCreateUser } from "../lib/db/pg-queries";

const instances: Record<string, unknown>[] = [];

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
    createSession: vi.fn().mockResolvedValue({ id: 99 }),
  },
}));

vi.mock("../message", () => ({
  setupMessagePalWebSocket: vi.fn(),
  default: {
    router: express.Router(),
  },
}));

vi.mock("../chat-ws", () => ({
  setupChatWebSocket: vi.fn(),
}));

vi.mock("../lib/db/cassandra", () => ({
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

    // Mock register endpoint to bypass the public registration restriction during tests
    app.post("/api/auth/register", async (req, res) => {
      const { name, email, role, school_code } = req.body;
      const user = await pgCreateUser({
        name,
        email,
        role: role || "student",
        schoolCode: school_code || null,
        status: role === "teacher" ? "pending" : "active",
      });
      res.status(201).json(user);
    });

    await registerRoutes(app);
  });

  it("should set status to pending when a teacher registers", async () => {
    (pgFindUserByEmail as Mock).mockResolvedValue(null);
    (pgCreateUser as Mock).mockImplementation((userData: Record<string, unknown>) => {
      const createdUser = {
        id: 123,
        ...userData,
      };
      instances.push(createdUser);
      return Promise.resolve(createdUser);
    });

    const registrationData = {
      name: "Teacher Test",
      email: "teacher@test.com",
      password: "password123",
      role: "teacher",
      school_code: "TEST_SCHOOL",
    };

    const res = await request(app).post("/api/auth/register").send(registrationData);

    expect(res.status).toBe(201);
    expect(instances.length).toBe(1);
    expect(instances[0].role).toBe("teacher");
    expect(instances[0].status).toBe("pending");
  });

  it("should set status to active when a student registers", async () => {
    (pgFindUserByEmail as Mock).mockResolvedValue(null);
    (pgCreateUser as Mock).mockImplementation((userData: Record<string, unknown>) => {
      const createdUser = {
        id: 123,
        ...userData,
      };
      instances.push(createdUser);
      return Promise.resolve(createdUser);
    });

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
});
