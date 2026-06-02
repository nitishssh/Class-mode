import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { storage } from "../storage";
import { pgFindUsers, pgFindUserById, pgUpdateUser, pgDeleteUser, pgFindSchoolClassesBySchoolId, pgCreateSchoolClass, pgUpdateSchoolClass, pgDeleteSchoolClass, pgFindSchoolById, pgUpsertSchool } from "../lib/pg-queries";
import { setCustomUserClaims } from "../lib/firebase-admin";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import { logger } from "../lib/logger";
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

    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as any).password;

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
      ((req.session.role || "") !== "school_admin" && (req.session.role || "") !== "admin")
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
        ((req.session.role || "") !== "school_admin" && (req.session.role || "") !== "admin")
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
        return res
          .status(403)
          .json({ message: "Forbidden: Teacher belongs to a different school" });
      }

      await pgUpdateUser(teacherId, { status: "active" });
      if (teacher.firebaseUid) {
        setCustomUserClaims(teacher.firebaseUid, { role: teacher.role, status: "active" }).catch(
          (e) => logger.warn("[approve] Failed to update custom claims", { error: String(e) })
        );
      }
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden: Access restricted to administrators" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin) {
      return res.status(400).json({ message: "Admin not found" });
    }

    const role = req.query.role as string | undefined;
    const filters: any = {};
    if (role) {
      filters.role = role;
    }
    if (admin.schoolCode && admin.role !== "admin") {
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden: Access restricted to administrators" });
    }

    const admin = await pgFindUserById(req.session.userId);
    
    // In a real implementation we would validate the body using Zod schema
    const newUserData = req.body;
    
    // Generate a placeholder password hash
    const placeholderHash = "placeholder_hash"; 
    
    const user = await storage.createUser({
      ...newUserData,
      password: placeholderHash,
      schoolCode: admin?.schoolCode || newUserData.schoolCode,
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const userId = parseInt(req.params.id);
    const updatedUser = await pgUpdateUser(userId, req.body);
    
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const userId = parseInt(req.params.id);
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) {
      return res.status(400).json({ message: "Admin school not found" });
    }

    const cls = await pgCreateSchoolClass({
      name: req.body.name,
      grade: req.body.grade,
      teacherFirebaseUid: req.body.teacherFirebaseUid || admin.authSubject || "admin",
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const classId = parseInt(req.params.id);
    const updatedClass = await pgUpdateSchoolClass(classId, req.body);
    
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const classId = parseInt(req.params.id);
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
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) return res.status(400).json({ message: "School not found" });

    const school = await pgFindSchoolById(admin.schoolId);
    res.json(school);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch school profile" });
  }
});

// PUT /api/admin/school
router.put("/admin/school", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId || (req.session.role !== "school_admin" && req.session.role !== "admin" && req.session.role !== "principal")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const admin = await pgFindUserById(req.session.userId);
    if (!admin || !admin.schoolId) return res.status(400).json({ message: "School not found" });

    const school = await pgUpsertSchool({
      uid: admin.authSubject || "admin",
      name: req.body.name,
      city: req.body.city,
      board: req.body.board,
    });
    
    // the upsert might return the school or null, let's just refetch
    const updated = await pgFindSchoolById(admin.schoolId);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update school profile" });
  }
});

export default router;
