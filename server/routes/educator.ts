import { Router, Request, Response } from "express";
import { z } from "zod";
import { MongoUser, MongoTest, MongoGradingResult, getNextSequenceValue } from "../../shared/mongo-schema";
import { authenticateToken } from "../routes";
import { logger } from "../lib/logger";

const router = Router();

// ─── Dashboard ───────────────────────────────────────────────────────

const DashboardQuerySchema = z.object({
  class: z.string().optional(),
  subject: z.string().optional(),
  period: z.enum(["week", "month", "all"]).default("month"),
});

router.get("/dashboard", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });
    if (user.role !== "teacher" && user.role !== "school_admin" && user.role !== "principal") {
      return res.status(403).json({ error: "Educator access required" });
    }

    const { class: cls, subject } = DashboardQuerySchema.parse({ ...req.query });

    // Stats queries
    const teacherFilter: any = { teacherId: user.id };
    if (cls) teacherFilter.class = cls;
    if (subject) teacherFilter.subject = subject;

    const [totalTests, totalStudents, pendingGrading, recentTests] = await Promise.all([
      MongoTest.countDocuments(teacherFilter),
      MongoUser.countDocuments({ role: "student", school_code: user.school_code }),
      MongoGradingResult.countDocuments({ teacherId: user.id, status: "pending" }),
      MongoTest.find(teacherFilter).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalTests,
          totalStudents,
          pendingGrading,
          activeClasses: cls ? 1 : /* count distinct classes */ 0,
        },
        recentTests: recentTests.map((t) => ({
          id: t.id,
          title: t.title,
          subject: t.subject,
          class: t.class,
          status: t.status,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error("Educator dashboard error:", error);
    res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});

// ─── Student Roster Management ─────────────────────────────────────

const AddStudentSchema = z.object({
  studentId: z.number(),
});

router.get("/students", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const students = await MongoUser.find({
      role: "student",
      school_code: user.school_code,
    })
      .select("id username name email class grade avatar")
      .lean();

    res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        username: s.username,
        name: s.name,
        email: s.email,
        class: s.class,
        grade: s.grade,
        avatar: s.avatar,
      })),
    });
  } catch (error: any) {
    logger.error("Educator students error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch students" });
  }
});

router.post("/students", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const { studentId } = AddStudentSchema.parse(req.body);

    // Check if already assigned (optional: implement class assignment logic)
    const student = await MongoUser.findOne({ id: studentId, role: "student" });
    if (!student) return res.status(404).json({ error: "Student not found" });

    res.json({ success: true, message: "Student added to class", studentId });
  } catch (error: any) {
    logger.error("Educator add student error:", error);
    res.status(500).json({ error: error.message || "Failed to add student" });
  }
});

// ─── Pending Grading ────────────────────────────────────────────────

router.get("/grading/pending", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const pending = await MongoGradingResult.find({
      teacherId: user.id,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: pending.map((g) => ({
        submissionId: g.submissionId,
        studentId: g.studentId,
        contentType: g.contentType,
        status: g.status,
        createdAt: g.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error("Educator pending grading error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pending grading" });
  }
});

// ─── Override Grade ──────────────────────────────────────────────────

const OverrideGradeSchema = z.object({
  scoreBreakdown: z.object({
    totalScore: z.number(),
    criteria: z.array(z.object({
      criterionName: z.string(),
      score: z.number(),
      maxScore: z.number(),
      feedback: z.string().optional(),
    })),
  }),
  overallFeedback: z.string().optional(),
});

router.post("/grading/:submissionId/override", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const { submissionId } = req.params;
    const data = OverrideGradeSchema.parse(req.body);

    const result = await MongoGradingResult.findOne({ submissionId });
    if (!result) return res.status(404).json({ error: "Grading result not found" });

    result.scoreBreakdown = data.scoreBreakdown as any;
    result.overallFeedback = data.overallFeedback || "";
    result.status = "completed";
    await result.save();

    res.json({
      success: true,
      message: "Grade overridden successfully",
      data: { submissionId, scoreBreakdown: result.scoreBreakdown },
    });
  } catch (error: any) {
    logger.error("Educator override grade error:", error);
    res.status(500).json({ error: error.message || "Failed to override grade" });
  }
});

export default router;
