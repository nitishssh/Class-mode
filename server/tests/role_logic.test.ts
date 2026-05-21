import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { registerRoutes } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { MongoUser } from "../../shared/mongo-schema";
import {
  pgFindUserByAuthSubject,
  pgFindUserByEmail,
  pgCreateUser,
  pgUpdateUser,
} from "../lib/pg-queries";

// Mock the dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(true),
  checkFirebaseAdminReadiness: vi.fn(),
}));

// Mock MongoDB
vi.mock("../../shared/mongo-schema");

describe("Role Logic - School Admin", () => {
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

  describe("POST /api/auth/firebase with school_admin role", () => {
    it("should not let new users self-assign school_admin", async () => {
      const mockDecodedToken = {
        uid: "school-admin-uid",
        email: "admin@school.com",
        name: "School Administrator",
      };

      (verifyFirebaseToken as vi.Mock).mockResolvedValue(mockDecodedToken);

      (pgFindUserByAuthSubject as vi.Mock).mockResolvedValue(null);
      (pgFindUserByEmail as vi.Mock).mockResolvedValue(null);
      const mockCreatedUser = {
        id: 101,
        firebaseUid: "school-admin-uid",
        email: "admin@school.com",
        role: "student", // should default to student
        displayName: "School Administrator",
        avatar: null,
      };
      (pgCreateUser as vi.Mock).mockResolvedValue(mockCreatedUser);

      const res = await request(app)
        .post("/api/auth/firebase")
        .send({ idToken: "valid-school-admin-token", role: "school_admin" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("student");
    });

    it("should maintain school_admin role for existing users", async () => {
      const mockDecodedToken = {
        uid: "existing-admin-uid",
        email: "existing@school.com",
      };

      (verifyFirebaseToken as vi.Mock).mockResolvedValue(mockDecodedToken);

      const existingUser = {
        id: 102,
        email: "existing@school.com",
        role: "school_admin",
        username: "school_admin_user",
        firebaseUid: null,
      };

      (pgFindUserByAuthSubject as vi.Mock).mockResolvedValue(null);
      (pgFindUserByEmail as vi.Mock).mockResolvedValue(existingUser);
      (pgUpdateUser as vi.Mock).mockResolvedValue(existingUser);

      const res = await request(app).post("/api/auth/firebase").send({ idToken: "valid-token" });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe("school_admin");
      // Since it patches missing fields, we verify pgUpdateUser was called with correct updates
      expect(pgUpdateUser).toHaveBeenCalledWith(102, { authSubject: "existing-admin-uid" });
    });
  });
});
