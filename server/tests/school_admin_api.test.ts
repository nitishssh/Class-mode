import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import { MongoUser } from "../../shared/mongo-schema";
import session from "express-session";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
}));

// Mock MongoDB
vi.mock("../../shared/mongo-schema", () => {
  const saveMock = vi.fn().mockResolvedValue(true);
  function MockUser(this: any, data: any) {
    Object.assign(this, data);
    this.save = saveMock;
  }
  // @ts-ignore
  MockUser.findOne = vi.fn();
  // @ts-ignore
  MockUser.find = vi.fn();
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

describe("School Admin API", () => {
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

  describe("GET /api/school/teachers", () => {
    it("should return 401 if not authenticated", async () => {
      const res = await request(app).get("/api/school/teachers");
      expect(res.status).toBe(401);
    });

    it("should return 403 if not a school_admin", async () => {
      const { verifyFirebaseToken } = await import("../lib/firebase-admin");
      (verifyFirebaseToken as vi.Mock).mockResolvedValue({
        uid: "student-uid",
        email: "student@test.com",
      });

      const mockStudent = {
        id: 1,
        firebaseUid: "student-uid",
        email: "student@test.com",
        role: "student",
        save: vi.fn().mockResolvedValue(true),
      };
      (MongoUser.findOne as vi.Mock).mockResolvedValue(mockStudent);

      const res = await request(app)
        .get("/api/school/teachers")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(403);
    });

    it("should return teachers for the same school if school_admin", async () => {
      const { verifyFirebaseToken } = await import("../lib/firebase-admin");
      (verifyFirebaseToken as vi.Mock).mockResolvedValue({
        uid: "admin-uid",
        email: "admin@school.com",
      });

      const mockAdmin = {
        id: 100,
        firebaseUid: "admin-uid",
        email: "admin@school.com",
        role: "school_admin",
        school_code: "SCHOOL123",
        save: vi.fn().mockResolvedValue(true),
      };
      (MongoUser.findOne as vi.Mock).mockResolvedValue(mockAdmin);

      const { storage } = await import("../storage");
      (storage.getUser as vi.Mock).mockResolvedValue(mockAdmin);

      const mockTeachers = [
        { id: 2, name: "Teacher 1", role: "teacher", school_code: "SCHOOL123", status: "pending" },
        { id: 3, name: "Teacher 2", role: "teacher", school_code: "SCHOOL123", status: "active" },
      ];
      (MongoUser.find as vi.Mock).mockResolvedValue(mockTeachers);

      const res = await request(app)
        .get("/api/school/teachers")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(MongoUser.find).toHaveBeenCalledWith({
        role: "teacher",
        school_code: "SCHOOL123",
      });
    });
  });

  describe("POST /api/school/teachers/:id/approve", () => {
    it("should approve a pending teacher", async () => {
      const { verifyFirebaseToken } = await import("../lib/firebase-admin");
      (verifyFirebaseToken as vi.Mock).mockResolvedValue({ uid: "admin-uid" });

      const mockAdmin = { id: 100, role: "school_admin", school_code: "SCHOOL123" };
      (MongoUser.findOne as vi.Mock).mockImplementation((query) => {
        if (query.firebaseUid === "admin-uid") return Promise.resolve(mockAdmin);
        return Promise.resolve(null);
      });
      const { storage } = await import("../storage");
      (storage.getUser as vi.Mock).mockResolvedValue(mockAdmin);

      const mockTeacher = {
        id: 2,
        role: "teacher",
        school_code: "SCHOOL123",
        status: "pending",
        save: vi.fn().mockResolvedValue(true),
      };
      (MongoUser.findOne as vi.Mock).mockImplementation((query) => {
        if (query.firebaseUid === "admin-uid") return Promise.resolve(mockAdmin);
        if (query.id === 2) return Promise.resolve(mockTeacher);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post("/api/school/teachers/2/approve")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(mockTeacher.status).toBe("active");
      expect(mockTeacher.save).toHaveBeenCalled();
    });

    it("should return 403 if teacher belongs to different school", async () => {
      const { verifyFirebaseToken } = await import("../lib/firebase-admin");
      (verifyFirebaseToken as vi.Mock).mockResolvedValue({ uid: "admin-uid" });

      const mockAdmin = { id: 100, role: "school_admin", school_code: "SCHOOL123" };
      const { storage } = await import("../storage");
      (storage.getUser as vi.Mock).mockResolvedValue(mockAdmin);

      const mockTeacher = {
        id: 2,
        role: "teacher",
        school_code: "DIFFERENT_SCHOOL",
        status: "pending",
      };
      (MongoUser.findOne as vi.Mock).mockImplementation((query) => {
        if (query.firebaseUid === "admin-uid") return Promise.resolve(mockAdmin);
        if (query.id === 2) return Promise.resolve(mockTeacher);
        return Promise.resolve(null);
      });

      const res = await request(app)
        .post("/api/school/teachers/2/approve")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(403);
    });
  });
});
