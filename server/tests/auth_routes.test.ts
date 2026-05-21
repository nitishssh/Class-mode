import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { MongoUser } from "../../shared/mongo-schema";
import session from "express-session";
import {
  pgFindUserByAuthSubject,
  pgFindUserByEmail,
  pgCreateUser,
} from "../lib/pg-queries";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(true),
  checkFirebaseAdminReadiness: vi.fn(),
}));

// Mock MongoDB
vi.mock("../../shared/mongo-schema");

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../message", () => ({
  setupMessagePalWebSocket: vi.fn(),
}));

vi.mock("../chat-ws", () => ({
  setupChatWebSocket: vi.fn(),
}));

vi.mock("../lib/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

describe("Auth Routes", () => {
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
    await registerRoutes(app);
  });

  describe("POST /api/auth/firebase", () => {
    it("should return 400 if idToken is missing", async () => {
      const res = await request(app).post("/api/auth/firebase").send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("idToken is required");
    });

    it("should return 401 if token is invalid", async () => {
      (verifyFirebaseToken as vi.Mock).mockResolvedValue(null);

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "invalid-token" });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Invalid or expired Firebase ID token");
    });

    it("should return 200 and user data for existing user by UID", async () => {
      const decoded = { uid: "uid123", email: "test@test.com", name: "Test User" };
      (verifyFirebaseToken as vi.Mock).mockResolvedValue(decoded);

      const mockDbUser = {
        id: 1,
        firebaseUid: "uid123",
        email: "test@test.com",
        role: "student",
        displayName: "Test User",
      };

      (pgFindUserByAuthSubject as vi.Mock).mockImplementation((provider, uid) => {
        if (provider === "firebase" && uid === "uid123") return Promise.resolve(mockDbUser);
        return Promise.resolve(null);
      });
      (pgFindUserByEmail as vi.Mock).mockImplementation((email) => {
        if (email === "test@test.com") return Promise.resolve(mockDbUser);
        return Promise.resolve(null);
      });

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "valid-token" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        token: expect.any(String),
        userId: 1,
        email: "test@test.com",
        role: "student",
        avatar: null,
      });
    });

    it("should create a new user if one does not exist", async () => {
      const decoded = {
        uid: "new_uid",
        email: "new@test.com",
        name: "New User",
        picture: "pic_url",
      };
      (verifyFirebaseToken as vi.Mock).mockResolvedValue(decoded);

      (pgFindUserByAuthSubject as vi.Mock).mockResolvedValue(null);
      (pgFindUserByEmail as vi.Mock).mockResolvedValue(null);
      const mockCreatedUser = {
        id: 123,
        firebaseUid: "new_uid",
        email: "new@test.com",
        role: "student",
        displayName: "New User",
        avatar: "pic_url",
      };
      (pgCreateUser as vi.Mock).mockResolvedValue(mockCreatedUser);

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "valid-token" });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        token: expect.any(String),
        userId: 123,
        email: "new@test.com",
        role: "student",
        avatar: "pic_url",
      });
    });
  });
});
