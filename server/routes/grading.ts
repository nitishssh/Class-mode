import { Router, Request, Response } from "express";
import { GradingRequestSchema } from "../../shared/grading-schema";
import {
  gradeSubmission,
  getGradingResult,
  getGradingHistory,
  regradeSubmission,
} from "../services/gradingService";
import { pgFindGradingResultBySubmissionId } from "../lib/pg-queries";
import { authenticateToken } from "../routes";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/grading/submit
 * Submit a student submission for AI grading.
 * Body: GradingRequest
 */
router.post("/submit", authenticateToken, async (req: Request, res: Response) => {
  try {
    const data = GradingRequestSchema.parse(req.body);
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Run grading (this can take 10-30s for complex submissions)
    const result = await gradeSubmission(data);

    res.json({
      success: true,
      message: "Submission graded successfully",
      data: result,
    });
  } catch (error: any) {
    logger.error("Grading submit error:", error);
    res.status(500).json({
      error: error.message || "Grading failed",
      success: false,
    });
  }
});

/**
 * GET /api/grading/:submissionId
 * Get grading result for a specific submission.
 */
router.get("/:submissionId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const result = await getGradingResult(submissionId);

    if (!result) {
      return res.status(404).json({ error: "Grading result not found" });
    }

    res.json({
      success: true,
      data: {
        submissionId: result.submissionId,
        studentId: result.studentId,
        status: result.status,
        scoreBreakdown: result.scoreBreakdown,
        overallFeedback: result.overallFeedback,
        strengths: result.strengths,
        areasForImprovement: result.areasForImprovement,
        modelUsed: result.modelUsed,
        processingTimeMs: result.processingTimeMs,
        createdAt: result.createdAt,
        completedAt: result.completedAt,
      },
    });
  } catch (error: any) {
    logger.error("Get grading result error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch grading result" });
  }
});

/**
 * POST /api/grading/:submissionId/regrade
 * Re-grade a submission (overwrites previous result).
 */
router.post("/:submissionId/regrade", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const data = GradingRequestSchema.parse(req.body);

    const result = await regradeSubmission(submissionId, data);

    res.json({
      success: true,
      message: "Re-grading completed",
      data: result,
    });
  } catch (error: any) {
    logger.error("Regrade error:", error);
    res.status(500).json({ error: error.message || "Re-grading failed" });
  }
});

/**
 * GET /api/grading/history/:studentId
 * Get grading history for a student.
 * Query params: limit (default 20), offset (default 0)
 */
router.get("/history/:studentId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: "Invalid student ID" });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await getGradingHistory(studentId, limit, offset);

    res.json({
      success: true,
      data: history.map((h) => ({
        submissionId: h.submissionId,
        studentId: h.studentId,
        status: h.status,
        scoreBreakdown: h.scoreBreakdown,
        overallFeedback: h.overallFeedback,
        createdAt: h.createdAt,
        completedAt: h.completedAt,
      })),
      pagination: { limit, offset, count: history.length },
    });
  } catch (error: any) {
    logger.error("Grading history error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch grading history" });
  }
});

/**
 * GET /api/grading/status/:submissionId
 * Check grading status (for async/pending submissions).
 */
router.get("/status/:submissionId", authenticateToken, async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const result = await pgFindGradingResultBySubmissionId(submissionId);

    if (!result) {
      return res.status(404).json({
        success: false,
        status: "not_found",
        message: "No grading record found for this submission",
      });
    }

    res.json({
      success: true,
      status: result.status,
      submissionId: result.submissionId,
      completedAt: result.completedAt,
      scoreBreakdown: result.status === "completed" ? result.scoreBreakdown : null,
    });
  } catch (error: any) {
    logger.error("Grading status error:", error);
    res.status(500).json({ error: error.message || "Failed to check grading status" });
  }
});

export default router;
