import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";
import session from "express-session";
import jwt from "jsonwebtoken";
import {
  pgFindUserById,
  pgFindSchoolClassesBySchoolId,
  pgFindSchoolClassById,
  pgCreateSchoolClass,
  pgUpdateSchoolClass,
  pgDeleteSchoolClass,
  pgFindSchoolById,
  pgUpsertSchool,
  pgFindUsers,
  pgCountUsers,
  pgUpdateUser,
  pgDeleteUser,
  pgGetFeatureUsageSummary,
  isPgReady,
} from "../lib/pg-queries";
import { getPgPool } from "../db-pg";

const TEST_SECRET = process.env.JWT_SECRET ?? "super_secret_jwt_key_learning_pro_123";
const adminToken = jwt.sign({ userId: 100, role: "admin", email: "admin@school.com" }, TEST_SECRET);
const unauthorizedToken = jwt.sign(
  { userId: 1, role: "student", email: "student@test.com" },
  TEST_SECRET
);

// Mock dependencies
vi.mock("../lib/pg-queries", () => ({
  pgFindUserById: vi.fn(),
  pgFindSchoolClassesBySchoolId: vi.fn(),
  pgFindSchoolClassById: vi.fn(),
  pgCreateSchoolClass: vi.fn(),
  pgUpdateSchoolClass: vi.fn(),
  pgDeleteSchoolClass: vi.fn(),
  pgFindSchoolById: vi.fn(),
  pgUpsertSchool: vi.fn(),
  pgFindUsers: vi.fn(),
  pgCountUsers: vi.fn(),
  pgCreateUser: vi.fn(),
  pgUpdateUser: vi.fn(),
  pgDeleteUser: vi.fn(),
  pgFindFirstWorkspaceMembership: vi.fn().mockResolvedValue(null),
  pgGetFeatureUsageSummary: vi.fn(),
  isPgReady: vi.fn().mockReturnValue(true),
}));

vi.mock("../db-pg", () => ({
  getPgPool: vi.fn().mockReturnValue({
    query: vi.fn(),
  }),
  isPgReady: vi.fn().mockReturnValue(true),
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    createUser: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
    getTasksByUser: vi.fn().mockResolvedValue([]),
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

describe("Admin Dashboard API", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();

    (pgFindUserById as Mock).mockImplementation((id: number) => {
      if (id === 100) {
        return Promise.resolve({
          id: 100,
          role: "admin",
          email: "admin@school.com",
          schoolId: 10,
          schoolCode: "SCHOOL123",
          status: "active",
          emailVerified: true,
        });
      }
      if (id === 1) {
        return Promise.resolve({
          id: 1,
          role: "student",
          email: "student@test.com",
          status: "active",
          emailVerified: true,
        });
      }
      return Promise.resolve(null);
    });

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

  describe("GET /api/admin/classes", () => {
    it("should return classes for the admin's school", async () => {
      const mockClasses = [{ id: 1, name: "Math 101", grade: "10", schoolId: 10 }];
      (pgFindSchoolClassesBySchoolId as Mock).mockResolvedValue(mockClasses);

      const res = await request(app)
        .get("/api/admin/classes")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockClasses);
      expect(pgFindSchoolClassesBySchoolId).toHaveBeenCalledWith(10);
    });

    it("should return 403 for unauthorized users", async () => {
      const res = await request(app)
        .get("/api/admin/classes")
        .set("Authorization", `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("Validation: Admin Routes", () => {
    it("should return 400 for POST /admin/classes with missing name", async () => {
      const res = await request(app)
        .post("/api/admin/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ grade: "10" }); // missing name

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid request data");
      expect(res.body.errors.name).toBeDefined();
    });

    it("should return 400 for PUT /admin/school with empty name", async () => {
      const res = await request(app)
        .put("/api/admin/school")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "", city: "Test City" });

      expect(res.status).toBe(400);
      expect(res.body.errors.name).toBeDefined();
    });
  });

  describe("POST /api/admin/classes", () => {
    it("should create a new class", async () => {
      const newClass = { id: 2, name: "Science 101", grade: "10", schoolId: 10 };
      (pgCreateSchoolClass as Mock).mockResolvedValue(newClass);

      const res = await request(app)
        .post("/api/admin/classes")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Science 101", grade: "10" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(newClass);
      expect(pgCreateSchoolClass).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Science 101",
          grade: "10",
          schoolId: 10,
        })
      );
    });
  });

  describe("PUT /api/admin/classes/:id", () => {
    it("should update an existing class", async () => {
      const updatedClass = { id: 1, name: "Advanced Math", grade: "10", schoolId: 10 };
      (pgFindSchoolClassById as Mock).mockResolvedValue({ id: 1, schoolId: 10 });
      (pgUpdateSchoolClass as Mock).mockResolvedValue(updatedClass);

      const res = await request(app)
        .put("/api/admin/classes/1")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Advanced Math" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(updatedClass);
      expect(pgUpdateSchoolClass).toHaveBeenCalledWith(1, { name: "Advanced Math" });
    });

    it("should return 404 if class not found", async () => {
      (pgFindSchoolClassById as Mock).mockResolvedValue(null);

      const res = await request(app)
        .put("/api/admin/classes/999")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Ghost Class" });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/admin/classes/:id", () => {
    it("should delete a class", async () => {
      (pgFindSchoolClassById as Mock).mockResolvedValue({ id: 1, schoolId: 10 });
      (pgDeleteSchoolClass as Mock).mockResolvedValue(true);

      const res = await request(app)
        .delete("/api/admin/classes/1")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Class deleted");
      expect(pgDeleteSchoolClass).toHaveBeenCalledWith(1);
    });
  });

  describe("GET /api/admin/school", () => {
    it("should return school profile", async () => {
      const mockSchool = { id: 10, name: "Test School", city: "Test City" };
      (pgFindSchoolById as Mock).mockResolvedValue(mockSchool);

      const res = await request(app)
        .get("/api/admin/school")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockSchool);
      expect(pgFindSchoolById).toHaveBeenCalledWith(10);
    });
  });

  describe("PUT /api/admin/school", () => {
    it("should update school profile", async () => {
      const updatedSchool = { id: 10, name: "Updated School", city: "Test City" };
      (pgUpsertSchool as Mock).mockResolvedValue(updatedSchool);
      (pgFindSchoolById as Mock).mockResolvedValue(updatedSchool);

      const res = await request(app)
        .put("/api/admin/school")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ name: "Updated School", city: "Test City" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Updated School");
      expect(pgUpsertSchool).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/trends", () => {
    it("should return demo trends without touching the database", async () => {
      const res = await request(app)
        .get("/api/admin/trends?demo=true&days=7")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBe(7);
      expect(res.body.daily).toHaveLength(7);
      expect(res.body.daily[0]).toHaveProperty("logins");
      expect(res.body.daily[0]).toHaveProperty("submissions");
      expect(res.body.scoreByClass.length).toBeGreaterThan(0);
    });

    it("should build a zero-filled daily axis when there is no activity", async () => {
      (getPgPool() as unknown as { query: Mock }).query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get("/api/admin/trends?days=7")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.daily).toHaveLength(7);
      expect(res.body.daily.every((d: { logins: number }) => d.logins === 0)).toBe(true);
      expect(res.body.scoreByClass).toEqual([]);
    });

    it("should clamp the days range to a max of 90", async () => {
      (getPgPool() as unknown as { query: Mock }).query.mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get("/api/admin/trends?days=999")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBe(90);
      expect(res.body.daily).toHaveLength(90);
    });

    it("should return 403 for unauthorized users", async () => {
      const res = await request(app)
        .get("/api/admin/trends")
        .set("Authorization", `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/admin/logs", () => {
    it("should return audit logs", async () => {
      const mockLogs = [{ id: 1, eventType: "LOGIN", createdAt: new Date() }];
      const mockQuery = vi.fn().mockResolvedValue({ rows: mockLogs });
      (getPgPool as Mock).mockReturnValue({ query: mockQuery });
      (isPgReady as Mock).mockReturnValue(true);

      const res = await request(app)
        .get("/api/admin/logs")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe("GET /api/admin/stats", () => {
    it("scopes counts to the admin's school for a school_admin with a schoolCode", async () => {
      const schoolAdminToken = jwt.sign(
        { userId: 103, role: "school_admin", email: "sadmin@school.com" },
        TEST_SECRET
      );
      (pgFindUserById as Mock).mockImplementation((id: number) => {
        if (id === 103) {
          return Promise.resolve({
            id: 103,
            role: "school_admin",
            schoolCode: "SCHOOL123",
            status: "active",
            emailVerified: true,
          });
        }
        return Promise.resolve(null);
      });
      (pgCountUsers as Mock).mockResolvedValue(5);
      (getPgPool as Mock).mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [{ count: "3" }] }),
      });

      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalStudents).toBe(5);
      // The scoping is the whole point of the fix: counts must carry schoolCode.
      expect(pgCountUsers).toHaveBeenCalledWith({ role: "student", schoolCode: "SCHOOL123" });
      expect(pgCountUsers).toHaveBeenCalledWith({ role: "teacher", schoolCode: "SCHOOL123" });
    });

    it("returns unscoped counts for the platform admin", async () => {
      (pgCountUsers as Mock).mockResolvedValue(42);
      (getPgPool as Mock).mockReturnValue({
        query: vi.fn().mockResolvedValue({ rows: [{ count: "7" }] }),
      });

      const res = await request(app)
        .get("/api/admin/stats")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalStudents).toBe(42);
      // Platform admin (role "admin") sees every school — no schoolCode filter.
      expect(pgCountUsers).toHaveBeenCalledWith({ role: "student" });
    });
  });

  describe("GET /api/admin/feature-usage", () => {
    it("returns the per-feature usage summary for a platform admin", async () => {
      (pgGetFeatureUsageSummary as Mock).mockResolvedValue([
        { feature: "attendance", count: 42, lastUsed: "2026-07-01T00:00:00.000Z" },
        { feature: "test_generation", count: 7, lastUsed: "2026-06-30T00:00:00.000Z" },
      ]);

      const res = await request(app)
        .get("/api/admin/feature-usage?days=14")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBe(14);
      expect(res.body.features).toHaveLength(2);
      // Platform admin sees all schools — no schoolCode filter.
      expect(pgGetFeatureUsageSummary).toHaveBeenCalledWith({
        schoolCode: undefined,
        sinceDays: 14,
      });
    });

    it("returns 403 for a non-admin role", async () => {
      const res = await request(app)
        .get("/api/admin/feature-usage")
        .set("Authorization", `Bearer ${unauthorizedToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/admin/keys", () => {
    it("should generate an API key", async () => {
      const res = await request(app)
        .post("/api/admin/keys")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(201);
      expect(res.body.apiKey).toBeDefined();
      const decoded = jwt.verify(res.body.apiKey, TEST_SECRET) as any;
      expect(decoded.userId).toBe(100);
      expect(decoded.role).toBe("admin");
    });
  });

  describe("User Management (/api/users)", () => {
    describe("GET /api/users", () => {
      it("should return all users for super admin", async () => {
        const mockUsers = [
          { id: 1, name: "Student 1", role: "student" },
          { id: 2, name: "Teacher 1", role: "teacher" },
        ];
        (pgFindUsers as Mock).mockResolvedValue(mockUsers);

        const res = await request(app)
          .get("/api/users")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(pgFindUsers).toHaveBeenCalled();
      });

      it("should filter users by school code for school admin", async () => {
        const schoolAdminToken = jwt.sign(
          { userId: 101, role: "school_admin", email: "sadmin@school.com" },
          TEST_SECRET
        );
        (pgFindUserById as Mock).mockImplementation((id: number) => {
          if (id === 101) {
            return Promise.resolve({
              id: 101,
              role: "school_admin",
              schoolCode: "SCHOOL123",
              status: "active",
              emailVerified: true,
            });
          }
          return Promise.resolve(null);
        });

        (pgFindUsers as Mock).mockResolvedValue([]);

        await request(app).get("/api/users").set("Authorization", `Bearer ${schoolAdminToken}`);

        expect(pgFindUsers).toHaveBeenCalledWith(
          expect.objectContaining({
            schoolCode: "SCHOOL123",
          })
        );
      });
    });

    describe("POST /api/users", () => {
      it("should create a new user", async () => {
        const newUser = { id: 3, name: "New User", role: "student", email: "new@test.com" };
        const { storage } = await import("../storage");
        (storage.createUser as Mock).mockResolvedValue(newUser);

        const res = await request(app)
          .post("/api/users")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ name: "New User", role: "student", email: "new@test.com" });

        expect(res.status).toBe(201);
        expect(res.body).toEqual(newUser);
        expect(storage.createUser).toHaveBeenCalled();
      });
    });

    describe("PUT /api/users/:id", () => {
      it("should update a user", async () => {
        const updatedUser = { id: 1, name: "Updated Name" };
        (pgFindUserById as Mock).mockImplementation((id: number) => {
          if (id === 100) return Promise.resolve({ id: 100, role: "admin", status: "active" });
          if (id === 1) return Promise.resolve({ id: 1, role: "student", status: "active" });
          return Promise.resolve(null);
        });
        (pgUpdateUser as Mock).mockResolvedValue(updatedUser);

        const res = await request(app)
          .put("/api/users/1")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ name: "Updated Name" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(updatedUser);
        expect(pgUpdateUser).toHaveBeenCalledWith(1, expect.any(Object));
      });
    });

    describe("DELETE /api/users/:id", () => {
      it("should delete a user", async () => {
        (pgFindUserById as Mock).mockImplementation((id: number) => {
          if (id === 100) return Promise.resolve({ id: 100, role: "admin", status: "active" });
          if (id === 1) return Promise.resolve({ id: 1, role: "student", status: "active" });
          return Promise.resolve(null);
        });
        (pgDeleteUser as Mock).mockResolvedValue(true);

        const res = await request(app)
          .delete("/api/users/1")
          .set("Authorization", `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("User deleted");
        expect(pgDeleteUser).toHaveBeenCalledWith(1);
      });
    });

    describe("Security: Tenant Isolation", () => {
      it("should prevent school_admin from deleting a user from another school", async () => {
        const schoolAdminToken = jwt.sign(
          { userId: 101, role: "school_admin", email: "sadmin@school.com" },
          TEST_SECRET
        );

        (pgFindUserById as Mock).mockImplementation((id: number) => {
          if (id === 101) {
            return Promise.resolve({
              id: 101,
              role: "school_admin",
              schoolCode: "SCHOOL_A",
              status: "active",
              emailVerified: true,
            });
          }
          if (id === 999) {
            return Promise.resolve({
              id: 999,
              role: "student",
              schoolCode: "SCHOOL_B",
            });
          }
          return Promise.resolve(null);
        });

        const res = await request(app)
          .delete("/api/users/999")
          .set("Authorization", `Bearer ${schoolAdminToken}`);

        // This should fail with 403, but currently it likely passes or fails with 404/500 depending on logic.
        // If it returns 200, it's vulnerable.
        expect(res.status).toBe(403);
      });

      it("should prevent school_admin from updating a user from another school", async () => {
        const schoolAdminToken = jwt.sign(
          { userId: 101, role: "school_admin", email: "sadmin@school.com" },
          TEST_SECRET
        );

        (pgFindUserById as Mock).mockImplementation((id: number) => {
          if (id === 101) {
            return Promise.resolve({
              id: 101,
              role: "school_admin",
              schoolCode: "SCHOOL_A",
              status: "active",
              emailVerified: true,
            });
          }
          if (id === 999) {
            return Promise.resolve({
              id: 999,
              role: "student",
              schoolCode: "SCHOOL_B",
            });
          }
          return Promise.resolve(null);
        });

        const res = await request(app)
          .put("/api/users/999")
          .set("Authorization", `Bearer ${schoolAdminToken}`)
          .send({ name: "Hacker" });

        expect(res.status).toBe(403);
      });

      // Regression: a school_admin / principal whose account has no schoolCode
      // (e.g. self-signup before completing school setup) must NOT fall through
      // to an unscoped, cross-tenant query. These endpoints must fail closed.
      describe("scoping fails closed when schoolCode is missing", () => {
        const noSchoolToken = jwt.sign(
          { userId: 102, role: "school_admin", email: "fresh@school.com" },
          TEST_SECRET
        );

        beforeEach(() => {
          (pgFindUserById as Mock).mockImplementation((id: number) => {
            if (id === 102) {
              return Promise.resolve({
                id: 102,
                role: "school_admin",
                schoolCode: null,
                schoolId: null,
                status: "active",
                emailVerified: true,
              });
            }
            return Promise.resolve(null);
          });
        });

        it("GET /api/users denies a school_admin without a schoolCode", async () => {
          (pgFindUsers as Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);

          const res = await request(app)
            .get("/api/users")
            .set("Authorization", `Bearer ${noSchoolToken}`);

          expect(res.status).toBe(403);
          expect(pgFindUsers).not.toHaveBeenCalled();
        });

        it("GET /api/admin/logs denies a school_admin without a schoolCode", async () => {
          const res = await request(app)
            .get("/api/admin/logs")
            .set("Authorization", `Bearer ${noSchoolToken}`);

          expect(res.status).toBe(403);
        });

        it("GET /api/admin/trends denies a school_admin without a schoolCode", async () => {
          const res = await request(app)
            .get("/api/admin/trends")
            .set("Authorization", `Bearer ${noSchoolToken}`);

          expect(res.status).toBe(403);
        });

        it("GET /api/admin/stats denies a school_admin without a schoolCode", async () => {
          const res = await request(app)
            .get("/api/admin/stats")
            .set("Authorization", `Bearer ${noSchoolToken}`);

          expect(res.status).toBe(403);
        });

        it("GET /api/analytics/students denies a school_admin without a schoolCode", async () => {
          // Regression: this endpoint used storage.getUsers("student") with no
          // tenant scope, leaking every school's students to any teacher/admin.
          (pgFindUsers as Mock).mockResolvedValue([{ id: 1 }, { id: 2 }]);

          const res = await request(app)
            .get("/api/analytics/students")
            .set("Authorization", `Bearer ${noSchoolToken}`);

          expect(res.status).toBe(403);
          expect(pgFindUsers).not.toHaveBeenCalled();
        });

        it("GET /api/admin/feature-usage denies a school_admin without a schoolCode", async () => {
          (pgGetFeatureUsageSummary as Mock).mockResolvedValue([]);
          const res = await request(app)
            .get("/api/admin/feature-usage")
            .set("Authorization", `Bearer ${noSchoolToken}`);
          expect(res.status).toBe(403);
          expect(pgGetFeatureUsageSummary).not.toHaveBeenCalled();
        });
      });

      it("should prevent school_admin from deleting a class from another school", async () => {
        const schoolAdminToken = jwt.sign(
          { userId: 101, role: "school_admin", email: "sadmin@school.com" },
          TEST_SECRET
        );

        (pgFindUserById as Mock).mockImplementation((id: number) => {
          if (id === 101) {
            return Promise.resolve({
              id: 101,
              role: "school_admin",
              schoolId: 10,
              status: "active",
              emailVerified: true,
            });
          }
          return Promise.resolve(null);
        });

        (pgFindSchoolClassById as Mock).mockResolvedValue({
          id: 555,
          name: "Other School Class",
          schoolId: 99,
        });

        const res = await request(app)
          .delete("/api/admin/classes/555")
          .set("Authorization", `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
      });
    });
  });

  describe("GET /api/dashboards/student (gamification honesty)", () => {
    // unauthorizedToken is userId 1 / role student — a verified student
    // requesting their OWN dashboard, which is authorized.
    it("returns honest zeroed XP/level/streak for accounts with no gamification data", async () => {
      // Regression: this endpoint previously hardcoded xp:450/level:12/streak:6,
      // so brand-new real accounts saw fabricated "Level 12 / 450 XP / 6 day
      // streak". There is no XP system yet, so it must return 0/1/0.
      (getPgPool().query as Mock).mockResolvedValue({ rows: [] });

      const res = await request(app)
        .get("/api/dashboards/student")
        .set("Authorization", `Bearer ${unauthorizedToken}`);

      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({ xp: 0, level: 1, streak: 0 });
      // The old fabricated values must never reappear.
      expect(res.body.profile.xp).not.toBe(450);
      expect(res.body.profile.level).not.toBe(12);
      expect(res.body.profile.streak).not.toBe(6);
    });
  });
});
