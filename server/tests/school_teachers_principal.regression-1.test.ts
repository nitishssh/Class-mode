// Regression: ISSUE-001 — principals locked out of /api/school/teachers
// Found by /qa on 2026-07-14
// Report: .gstack/qa-reports/qa-report-classmode-inmodel-in-2026-07-14.md
//
// Onboarding as "School Owner / Principal" sets role=principal, but the
// /school/teachers routes only allowed school_admin|admin — the outlier in
// the codebase (fees/attendance/analytics all include principal). School
// owners could not list or approve teachers.

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import session from "express-session";
import { pgFindUsers, pgFindUserById, pgFindFirstWorkspaceMembership } from "../lib/db/pg-queries";
import jwt from "jsonwebtoken";

const TEST_SECRET = process.env.JWT_SECRET ?? "super_secret_jwt_key_learning_pro_123";
const principalToken = jwt.sign(
  { userId: 200, role: "principal", email: "principal@school.com" },
  TEST_SECRET
);

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
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

describe("Regression ISSUE-001: principal access to /api/school/teachers", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    (pgFindUserById as Mock).mockImplementation((id: number) => {
      if (id === 200) {
        return Promise.resolve({
          id: 200,
          role: "principal",
          email: "principal@school.com",
          schoolCode: "SCHOOL123",
          school_code: "SCHOOL123",
          status: "active",
          emailVerified: true,
        });
      }
      return Promise.resolve(null);
    });
    (pgFindFirstWorkspaceMembership as Mock).mockResolvedValue(null);

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

  it("should return teachers for a principal of the same school", async () => {
    const mockTeachers = [
      { id: 2, name: "Teacher 1", role: "teacher", school_code: "SCHOOL123", status: "pending" },
    ];
    (pgFindUsers as Mock).mockResolvedValue(mockTeachers);

    const res = await request(app)
      .get("/api/school/teachers")
      .set("Authorization", `Bearer ${principalToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(pgFindUsers).toHaveBeenCalledWith({
      role: "teacher",
      schoolCode: "SCHOOL123",
    });
  });

  it("should allow a principal to approve a pending teacher in their school", async () => {
    const mockTeacher = {
      id: 2,
      role: "teacher",
      schoolCode: "SCHOOL123",
      status: "pending",
    };
    (pgFindUserById as Mock).mockImplementation((id: number) => {
      if (id === 2) return Promise.resolve(mockTeacher);
      if (id === 200) {
        return Promise.resolve({
          id: 200,
          role: "principal",
          email: "principal@school.com",
          schoolCode: "SCHOOL123",
          school_code: "SCHOOL123",
          status: "active",
          emailVerified: true,
        });
      }
      return Promise.resolve(null);
    });

    const res = await request(app)
      .post("/api/school/teachers/2/approve")
      .set("Authorization", `Bearer ${principalToken}`);

    // Not 403 — the pre-fix behavior. Approval flow may return 200 or 404
    // depending on downstream mocks; the regression is the role gate.
    expect(res.status).not.toBe(403);
  });
});
