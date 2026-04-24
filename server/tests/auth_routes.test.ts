import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { MongoUser } from "../../shared/mongo-schema";
import session from "express-session";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
}));

// Mock MongoDB
vi.mock("../../shared/mongo-schema", () => {
  const saveMock = vi.fn().mockResolvedValue(true);
  function MockUser(this: any, data: any) {
    Object.assign(this, data);
    this.save = saveMock;
  }
  MockUser.findOne = vi.fn();

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
        save: vi.fn().mockResolvedValue(true),
      };

      (MongoUser.findOne as vi.Mock).mockImplementation((query) => {
        if (query.firebaseUid === "uid123") return Promise.resolve(mockDbUser);
        return Promise.resolve(null);
      });

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "valid-token" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        userId: 1,
        displayName: "Test User",
        role: "student",
        avatar: undefined,
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

      (MongoUser.findOne as vi.Mock).mockResolvedValue(null);

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "valid-token" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        userId: 123,
        displayName: "New User",
        role: "student",
        avatar: "pic_url",
      });
    });
  });
});
