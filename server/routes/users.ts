import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { storage } from "../storage";
import { pgFindUsers, pgFindUserById, pgUpdateUser } from "../lib/pg-queries";
import { setCustomUserClaims } from "../lib/firebase-admin";
import { recordAuditEvent, AUDIT_EVENTS } from "../lib/audit";
import { logger } from "../lib/logger";
import { isPgReady } from "../db-pg";
import { getPgPool } from "../db-pg";

const router = Router();

// GET /api/users/me
router.get("/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Don't return the password
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

    const admin = await storage.getUser(req.session.userId);
    if (!admin || !admin.school_code) {
      return res.status(400).json({ message: "Admin school code not found" });
    }

    const teachers = await pgFindUsers({
      role: "teacher",
      schoolCode: admin.school_code ?? undefined,
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

      const admin = await storage.getUser(req.session.userId);
      if (!admin || !admin.school_code) {
        return res.status(400).json({ message: "Admin school code not found" });
      }

      const teacherId = parseInt(req.params.id);
      const teacher = await pgFindUserById(teacherId);

      if (!teacher || teacher.role !== "teacher") {
        return res.status(404).json({ message: "Teacher not found" });
      }

      if (teacher.schoolCode !== admin.school_code) {
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
        schoolCode: admin.school_code,
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

export default router;
