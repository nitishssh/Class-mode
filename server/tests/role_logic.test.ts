import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { MongoUser } from "../../shared/mongo-schema";

// Mock the dependencies
vi.mock("../lib/firebase-admin");

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
  MockUser.findOneAndUpdate = vi.fn();
  // @ts-ignore
  MockUser.save = saveMock;

  return {
    MongoUser: MockUser,
    getNextSequenceValue: vi.fn().mockResolvedValue(101),
    MongoSession: { findOne: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn() },
    MongoOtp: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoTest: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoQuestion: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoTestAttempt: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoAnswer: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoAnalytics: { findOne: vi.fn(), find: vi.fn() },
    MongoTestAssignment: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoWorkspace: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoChannel: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
    MongoMessage: { findOne: vi.fn(), find: vi.fn(), findOneAndUpdate: vi.fn() },
  };
});

describe("Role Logic - School Admin", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    registerRoutes(app);
  });

  describe("POST /api/auth/firebase with school_admin role", () => {
    it("should successfully sync a profile with school_admin role", async () => {
      const mockDecodedToken = {
        uid: "school-admin-uid",
        email: "admin@school.com",
        name: "School Administrator",
      };

      (verifyFirebaseToken as any).mockResolvedValue(mockDecodedToken);

      // Mock MongoUser.findOne to return null (new user)
      (MongoUser.findOne as any).mockResolvedValue(null);

      // Mock MongoUser.findOneAndUpdate to return the user
      (MongoUser.findOneAndUpdate as any).mockImplementation((query: any, update: any) =>
        Promise.resolve({
          ...update,
          id: 101,
          role: "school_admin",
        })
      );

      const res = await request(app)
        .post("/api/auth/firebase")
        .send({ idToken: "valid-school-admin-token", role: "school_admin" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("school_admin");
    });

    it("should maintain school_admin role for existing users", async () => {
      const mockDecodedToken = {
        uid: "existing-admin-uid",
        email: "existing@school.com",
      };

      (verifyFirebaseToken as any).mockResolvedValue(mockDecodedToken);

      // Mock MongoUser.findOne to return an existing user with a save method
      const existingUser = {
        id: 102,
        email: "existing@school.com",
        role: "school_admin",
        username: "school_admin_user",
        firebaseUid: null,
        save: vi.fn().mockResolvedValue(true),
        toObject: function () {
          return this;
        },
      };
      (MongoUser.findOne as any).mockResolvedValue(existingUser);

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "valid-token" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("school_admin");
      expect(existingUser.save).toHaveBeenCalled();
    });
  });
});
