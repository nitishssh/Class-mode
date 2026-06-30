import { Router, Request, Response } from "express";
import { authenticateToken, requireVerifiedEmail } from "../middleware";
import { storage } from "../storage";
import { pgFindUserById, pgCountUsers } from "../lib/pg-queries";
import { isPgReady, getPgPool } from "../db-pg";
import { logger } from "../lib/logger";
import { aiChat } from "../lib/openai";
import { checkAIQuota } from "../middleware/aiQuota";
import { pgIncrementAIUsage } from "../lib/pg-queries";

const router = Router();

/**
 * Student Dashboard Data Aggregation
 */
router.get(
  "/dashboards/student",
  authenticateToken,
  requireVerifiedEmail,
  async (req: Request, res: Response) => {
    const studentId = req.session.userId;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await pgFindUserById(studentId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const subjects = user.subjects || [];
      const pool = isPgReady() ? getPgPool() : null;

      const [upcomingAssignments, recentResults, tasks] = await Promise.all([
        pool
          ? pool
              .query(
                `
        SELECT ta.*, t.title as "testTitle", t.subject, t.description as topic
        FROM test_assignments ta
        JOIN tests t ON t.id = ta.test_id
        WHERE ta.student_id = $1 AND ta.status IN ('pending','started')
        ORDER BY ta.due_date ASC LIMIT 5`,
                [studentId]
              )
              .then((r) => r.rows)
          : [],
        pool
          ? pool
              .query(
                `
        SELECT * FROM test_attempts WHERE student_id = $1 AND status = 'evaluated'
        ORDER BY end_time DESC LIMIT 5`,
                [studentId]
              )
              .then((r) => r.rows)
          : [],
        storage.getTasksByUser(studentId),
      ]);

      res.json({
        profile: {
          name: user.name,
          displayName: user.displayName,
          grade: user.grade,
          xp: 450,
          level: 12,
          streak: 6,
        },
        subjects,
        upcomingTests: upcomingAssignments,
        recentResults,
        tasks,
      });
    } catch (error) {
      logger.error("Error fetching student dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * Teacher Dashboard Data Aggregation
 */
router.get(
  "/dashboards/teacher",
  authenticateToken,
  requireVerifiedEmail,
  async (req: Request, res: Response) => {
    const teacherId = req.session.userId;
    if (!teacherId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const user = await pgFindUserById(teacherId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const pool = isPgReady() ? getPgPool() : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const [myTests, pendingSubmissions, liveClasses] = await Promise.all([
        pool
          ? pool
              .query(
                `SELECT * FROM tests WHERE teacher_id = $1 ORDER BY created_at DESC LIMIT 10`,
                [teacherId]
              )
              .then((r) => r.rows)
          : [],
        pool
          ? pool
              .query(
                `
        SELECT ta.* FROM test_attempts ta
        JOIN tests t ON t.id = ta.test_id
        WHERE t.teacher_id = $1 AND ta.status = 'completed'
        ORDER BY ta.end_time DESC LIMIT 5`,
                [teacherId]
              )
              .then((r) => r.rows)
          : [],
        pool
          ? pool
              .query(
                `SELECT * FROM live_classes WHERE teacher_id = $1 AND scheduled_time >= $2 AND scheduled_time < $3`,
                [teacherId, today, tomorrow]
              )
              .then((r) => r.rows)
          : [],
      ]);

      res.json({
        stats: {
          activeTests: myTests.length,
          totalStudents: 0,
          avgScore: 0,
          classesCount: liveClasses.length,
        },
        tests: myTests,
        pendingSubmissions,
        liveClasses,
      });
    } catch (error) {
      logger.error("Error fetching teacher dashboard data:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// GET /api/student/weak-subjects
router.get("/student/weak-subjects", authenticateToken, async (req: Request, res: Response) => {
  try {
    const studentId = req.session?.userId;
    if (!studentId) return res.status(401).json({ message: "Unauthorized" });

    const weakSubjects = isPgReady()
      ? (
          await getPgPool().query(
            `
      SELECT t.subject,
        ROUND(AVG(ta.score::numeric / t.total_marks * 100), 2) AS "avgScore"
      FROM test_attempts ta
      JOIN tests t ON t.id = ta.test_id
      WHERE ta.student_id = $1 AND ta.status = 'evaluated'
      GROUP BY t.subject
      HAVING AVG(ta.score::numeric / t.total_marks * 100) < 60
      ORDER BY "avgScore" ASC`,
            [studentId]
          )
        ).rows
      : [];
    res.json(weakSubjects);
  } catch {
    res.status(500).json({ message: "Failed to fetch weak subjects" });
  }
});

// POST /api/ai/study-plan
router.post(
  "/ai/study-plan",
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    try {
      const { weakSubjects } = req.body;
      const userId = (req.user?.id || req.session?.userId) as number;
      const workspace = (req as any).workspace;

      let context = "";
      if (weakSubjects && weakSubjects.length > 0) {
        context = `This student's weak subjects based on recent test performance are:\n${weakSubjects.map((s: { subject: string; avgScore: number }) => `${s.subject}: ${Math.round(s.avgScore)}%`).join("\n")}\nCreate a focused 7-day study plan that prioritises these weak areas. Be specific: include what to study each day, for how long, and in what order. Do not include subjects they are already performing well in unless as brief revision.`;
      } else {
        context =
          "The student is doing well across all subjects (all scores above 60%). Create a maintenance plan. Pass top subjects as light revision targets.";
      }

      const prompt = `You are a study coach. ${context}\nReturn the plan as a JSON object with a "days" array, where each element is { "day": number, "title": "Day Title", "tasks": [{ "task": "string", "duration": "string" }] }`;

      const response = await aiChat(
        [{ role: "user", content: prompt }],
        "You are an expert study coach. Respond only with valid JSON."
      );
      const plan = JSON.parse(response.content);

      await pgIncrementAIUsage({
        userId,
        workspaceId: workspace?.id,
        feature: "ai_tutor",
        metadata: { type: "study_plan" },
      });

      res.json(plan);
    } catch (error) {
      logger.error("Study plan generation error:", error);
      res.status(500).json({ message: "Failed to generate study plan" });
    }
  }
);

// POST /api/ai/performance-analysis
router.post(
  "/ai/performance-analysis",
  await checkAIQuota("ai_tutor"),
  async (req: Request, res: Response) => {
    try {
      const studentId = req.session?.userId;
      if (!studentId) return res.status(401).json({ message: "Unauthorized" });
      const workspace = (req as any).workspace;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const results = isPgReady()
        ? (
            await getPgPool().query(
              `
        SELECT ta.*, t.subject, t.total_marks, ta.end_time as "endTime", ta.score
        FROM test_attempts ta JOIN tests t ON t.id = ta.test_id
        WHERE ta.student_id = $1 AND ta.status = 'evaluated' AND ta.end_time >= $2
        ORDER BY ta.end_time ASC`,
              [studentId, ninetyDaysAgo]
            )
          ).rows
        : [];

      if (results.length < 3) {
        return res.json({
          error: "Not enough data yet. Performance insights will appear after a few tests.",
        });
      }

      const resultSummary = results
        .map(
          (r) =>
            `${r.subject} | Score: ${r.score}/${r.total_marks} | Date: ${new Date(r.endTime).toLocaleDateString()}`
        )
        .join("\n");

      const prompt = `You are a learning analyst. Here is a student's test performance over the last 90 days:\n${resultSummary}\nIdentify:\n1. Subjects showing consistent improvement\n2. Subjects showing decline or stagnation\n3. One specific actionable recommendation\n4. Overall trend in 1 sentence\nBe direct. No filler phrases. Return as JSON: { "improving": ["subject"], "declining": ["subject"], "recommendation": "string", "summary": "string" }`;

      const response = await aiChat(
        [{ role: "user", content: prompt }],
        "You are a learning analyst. Respond only with valid JSON."
      );
      const analysis = JSON.parse(response.content);

      await pgIncrementAIUsage({
        userId: studentId,
        workspaceId: workspace?.id,
        feature: "ai_tutor",
        metadata: { type: "performance_analysis" },
      });

      res.json(analysis);
    } catch (error) {
      logger.error("Performance analysis error:", error);
      res.status(500).json({ message: "Failed to analyze performance" });
    }
  }
);

// GET /api/analytics/student/:studentId
router.get(
  "/analytics/student/:studentId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const studentId = parseInt(req.params.studentId);
      if (isNaN(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      if (req.session.role === "student" && req.session.userId !== studentId) {
        return res.status(403).json({ message: "Forbidden: Can only view your own analytics" });
      }

      if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
      const attempts = (
        await getPgPool().query(
          `
        SELECT ta.score, t.subject, t.total_marks
        FROM test_attempts ta JOIN tests t ON t.id = ta.test_id
        WHERE ta.student_id = $1 AND ta.status IN ('completed','evaluated') AND ta.score IS NOT NULL`,
          [studentId]
        )
      ).rows;

      if (attempts.length === 0) return res.status(200).json([]);

      const subjectScores = new Map<string, { total: number; count: number }>();

      for (const attempt of attempts) {
        const subject: string = attempt.subject;
        const score: number | null = attempt.score != null ? parseFloat(attempt.score) : null;
        if (subject && score != null) {
          const current = subjectScores.get(subject) || { total: 0, count: 0 };
          current.total += score;
          current.count += 1;
          subjectScores.set(subject, current);
        }
      }

      const result = Array.from(subjectScores.entries()).map(([subject, data]) => ({
        subject,
        avgScore: Math.round((data.total / data.count) * 100) / 100,
      }));

      res.status(200).json(result);
    } catch (error) {
      console.error("[api/analytics/student] Error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  }
);

// GET /api/progress/student/:studentId
router.get(
  "/progress/student/:studentId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const studentId = parseInt(req.params.studentId);
      if (isNaN(studentId)) {
        return res.status(400).json({ message: "Invalid student ID" });
      }

      if (req.session.role === "student" && req.session.userId !== studentId) {
        return res.status(403).json({ message: "Forbidden: Can only view your own progress" });
      }

      if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
      const pgRows = (
        await getPgPool().query(
          `
        SELECT TO_CHAR(end_time, 'YYYY-MM') as month, ROUND(AVG(score::numeric), 2) as "avgScore"
        FROM test_attempts
        WHERE student_id = $1 AND status IN ('completed','evaluated') AND score IS NOT NULL AND end_time IS NOT NULL
        GROUP BY month ORDER BY month ASC`,
          [studentId]
        )
      ).rows;

      const formatted = pgRows.map((r: any) => ({
        month: r.month,
        avgScore: parseFloat(r.avgScore),
      }));

      res.status(200).json(formatted);
    } catch (error) {
      console.error("[api/progress/student] Error:", error);
      res.status(500).json({ message: "Failed to fetch progress" });
    }
  }
);

// GET /api/admin/stats
router.get("/admin/stats", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!["admin", "principal", "school_admin"].includes(req.session.role || "")) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    if (req.query.demo === "true") {
      return res.status(200).json({
        totalStudents: 1240,
        totalTeachers: 87,
        testsThisMonth: 156,
        submissionsThisMonth: 4230,
        avgScore: 78.4,
        attendanceRate: 94.2,
        revenue: "₹2.4 Cr",
        pendingFees: "₹12.5 L",
        activeClasses: 36,
        subjectPerformance: [
          { subject: "Physics", avgScore: 78, passRate: 92 },
          { subject: "Chemistry", avgScore: 72, passRate: 88 },
          { subject: "Math", avgScore: 82, passRate: 95 },
          { subject: "Biology", avgScore: 76, passRate: 91 },
          { subject: "CS", avgScore: 85, passRate: 97 },
          { subject: "English", avgScore: 80, passRate: 94 },
        ],
        gradeDistribution: [
          { grade: "A+", count: 312, pct: 25 },
          { grade: "A", count: 436, pct: 35 },
          { grade: "B", count: 312, pct: 25 },
          { grade: "C", count: 124, pct: 10 },
          { grade: "Below C", count: 61, pct: 5 },
        ],
      });
    }

    if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const pool2 = getPgPool();

    const [studentCount, teacherCount, testsThisMonth, submissionsThisMonth] = await Promise.all([
      pgCountUsers({ role: "student" }),
      pgCountUsers({ role: "teacher" }),
      pool2
        .query("SELECT COUNT(*) FROM tests WHERE created_at >= $1", [startOfMonth])
        .then((r) => parseInt(r.rows[0].count)),
      pool2
        .query(
          "SELECT COUNT(*) FROM test_attempts WHERE status IN ('completed','evaluated') AND end_time >= $1",
          [startOfMonth]
        )
        .then((r) => parseInt(r.rows[0].count)),
    ]);

    res.status(200).json({
      totalStudents: studentCount,
      totalTeachers: teacherCount,
      testsThisMonth,
      submissionsThisMonth,
    });
  } catch (error) {
    console.error("[api/admin/stats] Error:", error);
    res.status(500).json({ message: "Failed to fetch admin stats" });
  }
});

// GET /api/admin/trends
// Returns a daily time series (signups, tests created, submissions, logins) over
// the last `days` days, plus an average-score-by-class breakdown for the Reports tab.
router.get("/admin/trends", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!["admin", "principal", "school_admin"].includes(req.session.role || "")) {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }

    // Clamp range to a sensible window (default 7, max 90 days).
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "7"), 10) || 7, 1), 90);

    // Build the date axis (oldest -> newest) so days with zero activity still render.
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const axis: { date: string; label: string }[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      axis.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        label: weekdays[d.getDay()],
      });
    }

    if (req.query.demo === "true") {
      const daily = axis.map((a, idx) => ({
        date: a.date,
        label: a.label,
        signups: 4 + ((idx * 3) % 11),
        tests: 2 + ((idx * 2) % 7),
        submissions: 40 + ((idx * 17) % 60),
        logins: 30 + ((idx * 13) % 45),
      }));
      return res.status(200).json({
        range: days,
        daily,
        scoreByClass: [
          { className: "Grade 9", avgScore: 72, attempts: 184 },
          { className: "Grade 10", avgScore: 78, attempts: 211 },
          { className: "Grade 11", avgScore: 84, attempts: 168 },
          { className: "Grade 12", avgScore: 80, attempts: 142 },
        ],
      });
    }

    if (!isPgReady()) return res.status(503).json({ message: "Database unavailable" });

    const admin = await pgFindUserById(req.session.userId);
    if (!admin) return res.status(400).json({ message: "Admin not found" });

    const pool = getPgPool();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));

    // Super-admins ("admin") see all schools; everyone else is scoped to their own.
    const scoped = admin.role !== "admin" && !!admin.schoolCode;
    const sc = admin.schoolCode || "";

    const [signupRows, testRows, submissionRows, loginRows, classRows] = await Promise.all([
      pool.query(
        `SELECT created_at::date AS d, COUNT(*)::int AS c
           FROM users
          WHERE created_at >= $1 ${scoped ? "AND school_code = $2" : ""}
          GROUP BY d`,
        scoped ? [start, sc] : [start]
      ),
      pool.query(
        `SELECT t.created_at::date AS d, COUNT(*)::int AS c
           FROM tests t
           ${scoped ? "JOIN users u ON t.teacher_id = u.id AND u.school_code = $2" : ""}
          WHERE t.created_at >= $1
          GROUP BY d`,
        scoped ? [start, sc] : [start]
      ),
      pool.query(
        `SELECT ta.end_time::date AS d, COUNT(*)::int AS c
           FROM test_attempts ta
           ${scoped ? "JOIN users u ON ta.student_id = u.id AND u.school_code = $2" : ""}
          WHERE ta.status IN ('completed','evaluated') AND ta.end_time >= $1
          GROUP BY d`,
        scoped ? [start, sc] : [start]
      ),
      pool.query(
        `SELECT created_at::date AS d, COUNT(*)::int AS c
           FROM audit_events
          WHERE event_type = 'user.login' AND created_at >= $1 ${scoped ? "AND school_code = $2" : ""}
          GROUP BY d`,
        scoped ? [start, sc] : [start]
      ),
      pool.query(
        `SELECT t.class_name AS class_name,
                ROUND(AVG(ta.score)::numeric, 1)::float AS avg_score,
                COUNT(*)::int AS attempts
           FROM test_attempts ta
           JOIN tests t ON ta.test_id = t.id
           ${scoped ? "JOIN users u ON t.teacher_id = u.id AND u.school_code = $1" : ""}
          WHERE ta.status IN ('completed','evaluated') AND ta.score IS NOT NULL
          GROUP BY t.class_name
          ORDER BY avg_score DESC NULLS LAST
          LIMIT 8`,
        scoped ? [sc] : []
      ),
    ]);

    // Index the per-day counts by ISO date for O(1) merge onto the axis.
    const toMap = (rows: { d: Date | string; c: number }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const key =
          r.d instanceof Date
            ? `${r.d.getFullYear()}-${String(r.d.getMonth() + 1).padStart(2, "0")}-${String(r.d.getDate()).padStart(2, "0")}`
            : String(r.d).slice(0, 10);
        m.set(key, r.c);
      }
      return m;
    };

    const signups = toMap(signupRows.rows);
    const tests = toMap(testRows.rows);
    const submissions = toMap(submissionRows.rows);
    const logins = toMap(loginRows.rows);

    const daily = axis.map((a) => ({
      date: a.date,
      label: a.label,
      signups: signups.get(a.date) ?? 0,
      tests: tests.get(a.date) ?? 0,
      submissions: submissions.get(a.date) ?? 0,
      logins: logins.get(a.date) ?? 0,
    }));

    res.status(200).json({
      range: days,
      daily,
      scoreByClass: classRows.rows.map((r) => ({
        className: r.class_name,
        avgScore: r.avg_score,
        attempts: r.attempts,
      })),
    });
  } catch (error) {
    console.error("[api/admin/trends] Error:", error);
    res.status(500).json({ message: "Failed to fetch admin trends" });
  }
});

// GET /api/analytics/students
router.get("/analytics/students", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (
      !req.session?.userId ||
      !["teacher", "admin", "principal"].includes(req.session.role || "")
    ) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    const students = await storage.getUsers("student");
    if (!students || students.length === 0) {
      return res.status(200).json([]);
    }

    const summaries = await Promise.all(
      students.map(async (student) => {
        const attempts = await storage.getTestAttemptsByStudent(student.id);
        const completedAttempts = attempts.filter(
          (a) => a.status === "completed" && a.score !== null
        );

        const averageScore =
          completedAttempts.length > 0
            ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) /
              completedAttempts.length
            : 0;

        const completionRate = attempts.length > 0 ? completedAttempts.length / attempts.length : 0;

        const subjectScores: Record<string, { total: number; count: number }> = Object.create(null);
        for (const attempt of completedAttempts) {
          const test = await storage.getTest(attempt.testId);
          if (test && test.subject) {
            const subject = test.subject;
            if (subject !== "__proto__" && subject !== "constructor" && subject !== "prototype") {
              if (!subjectScores[subject]) {
                subjectScores[subject] = { total: 0, count: 0 };
              }
              subjectScores[subject].total += attempt.score || 0;
              subjectScores[subject].count += 1;
            }
          }
        }

        const subjectBreakdown = Object.entries(subjectScores).map(([subject, data]) => ({
          subject,
          averageScore: data.total / data.count,
        }));

        const recentAttempts = completedAttempts.slice(0, 5).map((a) => ({
          testId: a.testId,
          score: a.score || 0,
          completedAt: a.endTime || new Date(),
        }));

        return {
          studentId: student.id,
          name: student.name,
          avatar: student.avatar,
          averageScore: Math.round(averageScore * 10) / 10,
          completionRate: Math.round(completionRate * 100) / 100,
          subjectBreakdown,
          recentAttempts,
        };
      })
    );

    return res.status(200).json(summaries);
  } catch (error) {
    console.error("[api/analytics/students] Error:", error);
    res.status(500).json({ message: "Failed to get student analytics" });
  }
});

export default router;
