import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import session from "express-session";
import request from "supertest";
import { registerRoutes } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";

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

  describe("POST /api/auth/firebase", () => {
    it("should disable Firebase role self-assignment by default", async () => {
      const res = await request(app)
        .post("/api/auth/firebase")
        .send({ idToken: "valid-school-admin-token", role: "school_admin" });

      expect(res.status).toBe(410);
      expect(verifyFirebaseToken).not.toHaveBeenCalled();
    });
  });
});
