import { Router, Request, Response } from "express";
import { z } from "zod";
import { MongoUser, MongoTest, MongoGradingResult, MongoTask, getNextSequenceValue } from "../../shared/mongo-schema";
import { authenticateToken } from "../routes";
import { logger } from "../lib/logger";

const router = Router();

// ─── Parent Dashboard ──────────────────────────────────────────────

router.get("/dashboard", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });
    if (user.role !== "parent") {
      return res.status(403).json({ error: "Parent access required" });
    }

    // Find linked children (assuming parent has a list or we search by parent email/phone)
    const children = await MongoUser.find({ role: "student", parentId: user.id })
      .select("id username name email class grade avatar")
      .lean();

    const childIds = children.map((c) => c.id);

    // Aggregate stats for all children
    const [totalTasks, completedTasks, upcomingTests, recentGrades] = await Promise.all([
      MongoTask.countDocuments({ userId: { $in: childIds } }),
      MongoTask.countDocuments({ userId: { $in: childIds }, status: "done" }),
      MongoTest.find({ status: "published" })
        .sort({ testDate: 1 })
        .limit(5)
        .select("id title testDate subject class")
        .lean(),
      MongoGradingResult.find({ studentId: { $in: childIds }, status: "completed" })
        .sort({ completedAt: -1 })
        .limit(10)
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        children: children.map((c) => ({
          id: c.id,
          name: c.name,
          class: c.class,
          grade: c.grade,
          avatar: c.avatar,
        })),
        stats: {
          totalTasks,
          completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
        upcomingTests: upcomingTests.map((t) => ({
          id: t.id,
          title: t.title,
          subject: t.subject,
          class: t.class,
          testDate: t.testDate,
        })),
        recentGrades: recentGrades.map((g) => ({
          submissionId: g.submissionId,
          studentId: g.studentId,
          scoreBreakdown: g.scoreBreakdown,
          completedAt: g.completedAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error("Parent dashboard error:", error);
    res.status(500).json({ error: error.message || "Failed to load dashboard" });
  }
});

// ─── Child Tasks ────────────────────────────────────────────────────

router.get("/tasks", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const children = await MongoUser.find({ role: "student", parentId: user.id }).select("id").lean();
    const childIds = children.map((c) => c.id);

    const tasks = await MongoTask.find({ userId: { $in: childIds } })
      .sort({ dueDate: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: tasks.map((t) => ({
        id: t.id,
        userId: t.userId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        tags: t.tags,
        createdAt: t.createdAt,
      })),
    });
  } catch (error: any) {
    logger.error("Parent tasks error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch tasks" });
  }
});

// ─── Progress Reports ───────────────────────────────────────────────

router.get("/reports", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const children = await MongoUser.find({ role: "student", parentId: user.id }).select("id name").lean();
    const childIds = children.map((c) => c.id);

    const grades = await MongoGradingResult.find({
      studentId: { $in: childIds },
      status: "completed",
    })
      .sort({ completedAt: -1 })
      .lean();

    // Group by student
    const reports = children.map((child) => {
      const childGrades = grades.filter((g) => g.studentId === child.id);
      const avgScore = childGrades.length > 0
        ? childGrades.reduce((sum, g) => {
            const sb = g.scoreBreakdown as any;
            return sum + (sb?.percentage || 0);
          }, 0) / childGrades.length
        : 0;

      return {
        studentId: child.id,
        studentName: child.name,
        totalGraded: childGrades.length,
        averageScore: Math.round(avgScore),
        lastGraded: childGrades[0]?.completedAt || null,
      };
    });

    res.json({ success: true, data: reports });
  } catch (error: any) {
    logger.error("Parent reports error:", error);
    res.status(500).json({ error: error.message || "Failed to generate reports" });
  }
});

// ─── Message Teacher ────────────────────────────────────────────────

const MessageTeacherSchema = z.object({
  teacherId: z.number(),
  content: z.string().min(1),
});

router.post("/message-teacher", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const { teacherId, content } = MessageTeacherSchema.parse(req.body);

    // This would integrate with the existing MessagePal WebSocket system
    // For now, return success placeholder
    res.json({
      success: true,
      message: "Message sent to teacher (MessagePal integration pending)",
      data: { teacherId, content },
    });
  } catch (error: any) {
    logger.error("Parent message teacher error:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
});

export default router;
