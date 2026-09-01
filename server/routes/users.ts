import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { authenticateToken } from "../middleware";
import { storage } from "../storage";
import {
  insertSchoolClassSchema,
  insertUserSchema,
  updateSchoolClassSchema,
  updateSchoolSchema,
  updateUserSchema,
} from "../../shared/schema";
import {
  pgFindUsers,
  pgFindUserById,
  pgUpdateUser,
  pgDeleteUser,
  pgFindSchoolClassesBySchoolId,
  pgFindSchoolClassById,
  pgCreateSchoolClass,
  pgUpdateSchoolClass,
  pgDeleteSchoolClass,
  pgFindSchoolById,
  pgUpsertSchool,
} from "../lib/db/pg-queries";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import { isPgReady } from "../db-pg";
import { getPgPool } from "../db-pg";

const router = Router();

// GET /api/users/me
router.get("/users/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password: _password, ...userWithoutPassword } = user;

    res.status(200).json(userWithoutPassword);
  } catch {
    res.status(500).json({ message: "Failed to get user data" });
  }
});

// GET /api/school/teachers
router.get("/school/teachers", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      !["school_admin", "principal", "admin"].includes(req.session.role || "")
    ) {
      return res
        .status(403)
        .json({ message: "Forbidden: Access restricted to school administrators" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolCode) {
      return res.status(400).json({ message: "Admin school code not found" });
    }

    const teachers = await pgFindUsers({
      role: "teacher",
      schoolCode: admin.schoolCode ?? undefined,
    });
    res.status(200).json(teachers);
  } catch (error) {
    console.error("[api/school/teachers] Error:", error);
    res.status(500).json({ message: "Failed to fetch teachers" });
  }
});

// POST /api/school/teachers/:id/approve
router.post(
  "/school/teachers/:id/approve",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (
        !req.session?.userId ||
        !["school_admin", "principal", "admin"].includes(req.session.role || "")
      ) {
        return res
          .status(403)
          .json({ message: "Forbidden: Access restricted to school administrators" });
      }

      const admin = await pgFindUserById(req.session.userId);
      if (!admin || !admin.schoolCode) {
        return res.status(400).json({ message: "Admin school code not found" });
      }

      const teacherId = parseInt(req.params.id);
      const teacher = await pgFindUserById(teacherId);

      if (!teacher || teacher.role !== "teacher") {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.schoolCode !== admin.schoolCode) {
        recordAuditEvent({
          actorUserId: admin.id,
          targetUserId: teacher.id,
          schoolCode: admin.schoolCode,
          eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
          payload: {
            route: "POST /school/teachers/:id/approve",
            targetId: teacher.id,
            targetType: "teacher",
          },
        });
        return res
          .status(403)
          .json({ message: "Forbidden: Teacher belongs to a different school" });
      }

      await pgUpdateUser(teacherId, { status: "active" });
      if (isPgReady()) {
        getPgPool()
          .query("UPDATE memberships SET status = 'active' WHERE user_id = $1", [teacherId])
          .catch(() => null);
      }

      recordAuditEvent({
        actorUserId: admin.id,
        targetUserId: teacher.id,
        schoolCode: admin.schoolCode,
        eventType: AUDIT_EVENTS.TEACHER_APPROVED,
        payload: { previousStatus: "pending" },
      });

      res.status(200).json({ message: "Teacher approved", teacher });
    } catch (error) {
      console.error("[api/school/teachers/approve] Error:", error);
      res.status(500).json({ message: "Failed to approve teacher" });
    }
  }
);

// GET /api/users
router.get("/users", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden: Access restricted to administrators" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    const role = req.query.role as string | undefined;
    const filters: { role?: string; schoolCode?: string } = {};
    if (role) {
      filters.role = role;
    }
    // Tenant isolation: only the platform-level "admin" super-role may list
    // users across all schools. Everyone else is scoped to their own school —
    // and an account without a schoolCode must be denied rather than fall
    // through to an unscoped (global) query, which would leak every school.
    if (admin.role !== "admin") {
      if (!admin.schoolCode) {
        return res
          .status(403)
          .json({ message: "Forbidden: your account is not associated with a school yet" });
      }
      filters.schoolCode = admin.schoolCode;
    }

    const users = await pgFindUsers(filters);
    res.status(200).json(users);
  } catch (error) {
    console.error("[api/users] Error:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

// POST /api/users
router.post("/users", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden: Access restricted to administrators" });
    }

    const admin = await pgFindUserById(req.session.userId);

    const adminCreateUserSchema = insertUserSchema.omit({ password: true });
    const parsed = adminCreateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
    }

    // Hash a random token so the account is locked until the user sets a password
    const lockedHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

    const user = await storage.createUser({
      ...parsed.data,
      password: lockedHash,
      school_code: admin?.schoolCode || parsed.data.school_code,
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("[api/users] POST Error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

// PUT /api/users/:id
router.put("/users/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    const userId = parseInt(req.params.id);
    const targetUser = await pgFindUserById(userId);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Tenant isolation: school_admin and principal can only update users in their own school
    if (admin?.role !== "admin" && admin?.schoolCode !== targetUser.schoolCode) {
      recordAuditEvent({
        actorUserId: admin?.id,
        targetUserId: targetUser.id,
        schoolCode: admin?.schoolCode,
        eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
        payload: { route: "PUT /api/users/:id", targetId: targetUser.id, targetType: "user" },
      });
      return res
        .status(403)
        .json({ message: "Forbidden: You can only manage users in your own school" });
    }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid request data", errors: parsed.error.format() });
    }

    const updatedUser = await pgUpdateUser(userId, parsed.data);

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("[api/users] PUT Error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

// DELETE /api/users/:id
router.delete("/users/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    const userId = parseInt(req.params.id);
    const targetUser = await pgFindUserById(userId);

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Tenant isolation: school_admin and principal can only delete users in their own school
    if (admin?.role !== "admin" && admin?.schoolCode !== targetUser.schoolCode) {
      recordAuditEvent({
        actorUserId: admin?.id,
        targetUserId: targetUser.id,
        schoolCode: admin?.schoolCode,
        eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
        payload: { route: "DELETE /api/users/:id", targetId: targetUser.id, targetType: "user" },
      });
      return res
        .status(403)
        .json({ message: "Forbidden: You can only manage classes in your own school" });
    }

    const success = await pgDeleteUser(userId);

    if (!success) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    console.error("[api/users] DELETE Error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// GET /api/admin/classes
router.get("/admin/classes", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) {
      return res.status(400).json({ message: "Admin school not found" });
    }

    const classes = await pgFindSchoolClassesBySchoolId(admin.schoolId);
    res.status(200).json(classes);
  } catch (error) {
    console.error("[api/admin/classes] Error:", error);
    res.status(500).json({ message: "Failed to fetch classes" });
  }
});

// POST /api/admin/classes
router.post("/admin/classes", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) {
      return res.status(400).json({ message: "Admin school not found" });
    }

    const parsed = insertSchoolClassSchema.safeParse(req.body);
    if (!parsed.success) {
      recordAuditEvent({
        actorUserId: admin.id,
        schoolCode: admin.schoolCode,
        eventType: AUDIT_EVENTS.VALIDATION_FAILED,
        payload: { route: "POST /admin/classes", errors: parsed.error.format() },
      });
      return res
        .status(400)
        .json({ message: "Invalid request data", errors: parsed.error.format() });
    }

    const cls = await pgCreateSchoolClass({
      name: parsed.data.name,
      grade: parsed.data.grade,
      teacherFirebaseUid: parsed.data.teacherFirebaseUid || admin.authSubject || "admin",
      schoolId: admin.schoolId,
    });

    res.status(201).json(cls);
  } catch (error) {
    console.error("[api/admin/classes] POST Error:", error);
    res.status(500).json({ message: "Failed to create class" });
  }
});

// PUT /api/admin/classes/:id
router.put("/admin/classes/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    const classId = parseInt(req.params.id);
    const targetClass = await pgFindSchoolClassById(classId);

    if (!targetClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Tenant isolation: school_admin and principal can only update classes in their own school
    if (admin?.role !== "admin" && admin?.schoolId !== targetClass.schoolId) {
      recordAuditEvent({
        actorUserId: admin?.id,
        schoolCode: admin?.schoolCode,
        eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
        payload: { route: "PUT /api/admin/classes/:id", targetId: classId, targetType: "class" },
      });
      return res
        .status(403)
        .json({ message: "Forbidden: You can only manage classes in your own school" });
    }

    const parsed = updateSchoolClassSchema.safeParse(req.body);
    if (!parsed.success) {
      recordAuditEvent({
        actorUserId: admin?.id,
        schoolCode: admin?.schoolCode,
        eventType: AUDIT_EVENTS.VALIDATION_FAILED,
        payload: {
          route: "PUT /api/admin/classes/:id",
          targetId: classId,
          errors: parsed.error.format(),
        },
      });
      return res
        .status(400)
        .json({ message: "Invalid request data", errors: parsed.error.format() });
    }

    const updatedClass = await pgUpdateSchoolClass(classId, parsed.data);

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.status(200).json(updatedClass);
  } catch (error) {
    console.error("[api/admin/classes] PUT Error:", error);
    res.status(500).json({ message: "Failed to update class" });
  }
});

// DELETE /api/admin/classes/:id
router.delete("/admin/classes/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    const classId = parseInt(req.params.id);
    const targetClass = await pgFindSchoolClassById(classId);

    if (!targetClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    // Tenant isolation: school_admin and principal can only delete classes in their own school
    if (admin?.role !== "admin" && admin?.schoolId !== targetClass.schoolId) {
      recordAuditEvent({
        actorUserId: admin?.id,
        schoolCode: admin?.schoolCode,
        eventType: AUDIT_EVENTS.TENANT_ACCESS_DENIED,
        payload: { route: "DELETE /api/admin/classes/:id", targetId: classId, targetType: "class" },
      });
      return res
        .status(403)
        .json({ message: "Forbidden: You can only manage classes in your own school" });
    }

    const success = await pgDeleteSchoolClass(classId);

    if (!success) {
      return res.status(404).json({ message: "Class not found" });
    }

    res.status(200).json({ message: "Class deleted" });
  } catch (error) {
    console.error("[api/admin/classes] DELETE Error:", error);
    res.status(500).json({ message: "Failed to delete class" });
  }
});

// GET /api/admin/school
router.get("/admin/school", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) return res.status(400).json({ message: "School not found" });

    const school = await pgFindSchoolById(admin.schoolId);
    res.json(school);
  } catch {
    res.status(500).json({ message: "Failed to fetch school profile" });
  }
});

// PUT /api/admin/school
router.put("/admin/school", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) return res.status(400).json({ message: "School not found" });

    const parsed = updateSchoolSchema.safeParse(req.body);
    if (!parsed.success) {
      recordAuditEvent({
        actorUserId: admin?.id,
        schoolCode: admin?.schoolCode,
        eventType: AUDIT_EVENTS.VALIDATION_FAILED,
        payload: { route: "PUT /api/admin/school", errors: parsed.error.format() },
      });
      return res
        .status(400)
        .json({ message: "Invalid request data", errors: parsed.error.format() });
    }

    await pgUpsertSchool({
      uid: admin.authSubject || "admin",
      name: parsed.data.name,
      city: parsed.data.city ?? undefined,
      board: parsed.data.board ?? undefined,
    });

    // the upsert might return the school or null, let's just refetch
    const updated = await pgFindSchoolById(admin.schoolId);
    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update school profile" });
  }
});

// GET /api/admin/logs
router.get("/admin/logs", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    if (!isPgReady()) {
      return res.status(200).json([]);
    }

    let queryText = `
      SELECT 
        ae.id,
        ae.event_type as "eventType",
        ae.created_at as "createdAt",
        ae.payload,
        actor.name as "actorName",
        actor.role as "actorRole",
        target.name as "targetName",
        target.role as "targetRole"
      FROM audit_events ae
      LEFT JOIN users actor ON ae.actor_user_id = actor.id
      LEFT JOIN users target ON ae.target_user_id = target.id
    `;
    const queryParams: (string | number)[] = [];

    // Tenant isolation: non-platform admins only see their own school's audit
    // log. A missing schoolCode must fail closed, not return every school's log.
    if (admin.role !== "admin") {
      if (!admin.schoolCode) {
        return res
          .status(403)
          .json({ message: "Forbidden: your account is not associated with a school yet" });
      }
      queryText += ` WHERE ae.school_code = $1 `;
      queryParams.push(admin.schoolCode);
    }

    queryText += ` ORDER BY ae.created_at DESC LIMIT 50 `;

    const result = await getPgPool().query(queryText, queryParams);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[api/admin/logs] Error:", error);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
});

// POST /api/admin/keys
router.post("/admin/keys", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      (req.session.role !== "school_admin" &&
        req.session.role !== "admin" &&
        req.session.role !== "principal")
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    // Generate a long-lived API key token (e.g. 1 year)
    const apiKey = jwt.sign(
      {
        userId: admin.id,
        role: admin.role,
        email: admin.email,
        emailVerified: admin.emailVerified,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "365d" }
    );

    recordAuditEvent({
      actorUserId: admin.id,
      schoolCode: admin.schoolCode,
      eventType: AUDIT_EVENTS.API_KEY_ISSUED,
      payload: { route: "POST /api/admin/keys", userId: admin.id, role: admin.role },
    });

    res.status(201).json({ apiKey });
  } catch (error) {
    console.error("[api/admin/keys] Error:", error);
    res.status(500).json({ message: "Failed to generate API Key" });
  }
});

export default router;
