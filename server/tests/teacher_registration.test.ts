import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import session from "express-session";
import { pgFindUserByEmail, pgFindUserByAuthSubject, pgCreateUser } from "../lib/pg-queries";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(true),
  checkFirebaseAdminReadiness: vi.fn(),
}));

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

  it("should set status to pending when a teacher registers via Firebase bridge", async () => {
    const originalCompat = process.env.ENABLE_FIREBASE_AUTH_COMPAT;
    process.env.ENABLE_FIREBASE_AUTH_COMPAT = "true";
    try {
      const { verifyFirebaseToken } = await import("../lib/firebase-admin");
      (verifyFirebaseToken as Mock).mockResolvedValue({
        uid: "fire-uid-1",
        email: "fire-teacher@test.com",
        name: "Fire Teacher",
        email_verified: true,
      });

      (pgFindUserByAuthSubject as Mock).mockResolvedValue(null);
      (pgFindUserByEmail as Mock).mockResolvedValue(null);
      (pgCreateUser as Mock).mockImplementation((userData: Record<string, unknown>) => {
        const createdUser = {
          id: 123,
          ...userData,
        };
        instances.push(createdUser);
        return Promise.resolve(createdUser);
      });

      const res = await request(app)
        .post("/api/auth/firebase")
        .send({ idToken: "valid-token", role: "teacher" });

      expect(res.status).toBe(200);
      expect(instances.length).toBe(1);
      expect(instances[0].role).toBe("teacher");
      expect(instances[0].status).toBe("pending");
    } finally {
      if (originalCompat !== undefined) {
        process.env.ENABLE_FIREBASE_AUTH_COMPAT = originalCompat;
      } else {
        delete process.env.ENABLE_FIREBASE_AUTH_COMPAT;
      }
    }
  });
});
