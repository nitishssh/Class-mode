import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Request, Response } from "express";
import { authenticateToken } from "../routes";
import jwt from "jsonwebtoken";
import { pgFindUserById } from "../lib/pg-queries";

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
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

  it("should return 401 if no token and no session is provided", async () => {
    await authenticateToken(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" });
  });

  it("should authenticate with a valid JWT in authorization header", async () => {
    req.headers!.authorization = "Bearer valid-token";
    const payload = { userId: 123, role: "student", email: "test@example.com" };
    (jwt.verify as Mock).mockReturnValue(payload);

    await authenticateToken(req as Request, res as Response, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid-token", expect.any(String));
    expect(req.session!.userId).toBe(123);
    expect(req.session!.role).toBe("student");
    expect((req as any).user).toEqual({ id: 123, role: "student", email: "test@example.com" });
    expect(next).toHaveBeenCalled();
  });

  it("should authenticate with a valid JWT in cookie", async () => {
    req.cookies!.access_token = "valid-cookie-token";
    const payload = { userId: 456, role: "teacher", email: "teacher@example.com" };
    (jwt.verify as Mock).mockReturnValue(payload);

    await authenticateToken(req as Request, res as Response, next);

    expect(jwt.verify).toHaveBeenCalledWith("valid-cookie-token", expect.any(String));
    expect(req.session!.userId).toBe(456);
    expect(req.session!.role).toBe("teacher");
    expect(next).toHaveBeenCalled();
  });

  it("should fall back to session user if JWT verification fails", async () => {
    req.headers!.authorization = "Bearer invalid-token";
    (jwt.verify as Mock).mockImplementation(() => {
      throw new Error("Invalid token");
    });
    req.session!.userId = 789;

    const mockUser = { id: 789, role: "admin", email: "admin@example.com" };
    (pgFindUserById as Mock).mockResolvedValue(mockUser);

    await authenticateToken(req as Request, res as Response, next);

    expect(pgFindUserById).toHaveBeenCalledWith(789);
    expect((req as any).user).toEqual({ id: 789, role: "admin", email: "admin@example.com" });
    expect(next).toHaveBeenCalled();
  });

  it("should return 401 if JWT fails and session user does not exist in DB", async () => {
    req.headers!.authorization = "Bearer invalid-token";
    (jwt.verify as Mock).mockImplementation(() => {
      throw new Error("Invalid token");
    });
    req.session!.userId = 999;
    (pgFindUserById as Mock).mockResolvedValue(null);

    await authenticateToken(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });
});
