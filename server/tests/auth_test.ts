import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Request, Response } from "express";
import { authenticateToken } from "../routes";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { pgFindUserById } from "../lib/pg-queries";

// Mock dependencies
vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
  setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/pg-queries", () => ({
  pgFindUserById: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
  },
}));

describe("Authentication Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      cookies: {},
      headers: {},
      session: {} as any,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it("should return 401 if no token is provided", async () => {
    await authenticateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" });
  });

  it("should return 403 if token verification fails", async () => {
    req.headers!.authorization = "Bearer invalid-token";
    (verifyFirebaseToken as Mock).mockResolvedValue(null);

    await authenticateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid or expired token" });
  });

  it("should auto-create user and call next() if Firebase token is valid but no PostgreSQL user exists", async () => {
    req.headers!.authorization = "Bearer valid-token";
    const decodedToken = { uid: "firebase-uid", email: "test@example.com", name: "Test User" };
    (verifyFirebaseToken as Mock).mockResolvedValue(decodedToken);
    (pgFindUserById as Mock).mockResolvedValue(null); // user doesn't exist

    await authenticateToken(req as Request, res as Response, next);
    // New behavior: auto-creates the user and continues
    expect(next).toHaveBeenCalled();
  });

  it("should call next() if token is valid and user exists", async () => {
    req.headers!.authorization = "Bearer valid-token";
    const decodedToken = { uid: "firebase-uid", email: "test@example.com" };
    const user = { id: 1, firebaseUid: "firebase-uid", role: "student" };

    (verifyFirebaseToken as Mock).mockResolvedValue(decodedToken);
    (pgFindUserById as Mock).mockResolvedValue(user);

    await authenticateToken(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(req.session!.userId).toBe(1);
    expect(req.session!.role).toBe("student");
  });
});
