import {
  GradingRequest,
  GradingResponse,
  ScoreBreakdown,
  Rubric,
} from "../../shared/grading-schema";
import { RubricCriterionSchema } from "../../shared/grading-schema";
import { parseRubric, validateWeights, rubricToPrompt, normalizeToPercentage } from "../lib/rubricParser";
import { buildGradingUserMessage, getSystemPrompt, getEssayFewShotExamples } from "../lib/prompts/grading";
import { MongoGradingResult, getNextSequenceValue } from "../../shared/mongo-schema";
import { geminiChat } from "../lib/gemini";
import { logger } from "../lib/logger";

const MODEL = "gemini-2.0-flash";

/**
 * Main entry point: grade a submission using OpenAI GPT-4o.
 */
export async function gradeSubmission(
  request: GradingRequest
): Promise<GradingResponse> {
  const startTime = Date.now();

  // 1. Parse and validate rubric
  const rubric: Rubric = parseRubric(request.rubric);

  // 2. Build prompts
  const rubricText = rubricToPrompt(rubric);
  const systemPrompt = getSystemPrompt(rubric.gradingType, request.language);
  const userMessage = buildGradingUserMessage({
    rubricText,
    contentType: request.contentType,
    content: request.content,
    language: request.language,
    studentId: request.studentId,
  });

  // 3. Build few-shot examples into the system prompt for essay grading
  const fewShotSection = rubric.gradingType === "essay"
    ? "\n\n" + getEssayFewShotExamples().map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
    : "";
  const fullSystemPrompt = systemPrompt + fewShotSection;

  // 4. Call Gemini with JSON mode
  try {
    const content = await geminiChat(fullSystemPrompt, userMessage, MODEL, { jsonMode: true });
    const parsed = JSON.parse(content);

    // 5. Validate and normalize scores
    const criteria = (parsed.criteria || []).map((c: any) => {
      const criterionDef = rubric.criteria.find((rc: any) => rc.name === c.criterionName);
      const maxScore = criterionDef?.maxPoints ?? c.maxScore ?? 10;
      const score = Math.min(Math.max(0, Number(c.score) || 0), maxScore);
      return {
        criterionName: c.criterionName || "Unknown",
        score,
        maxScore,
        feedback: c.feedback || "",
      };
    });

    const totalScore = criteria.reduce((sum: number, c: any) => sum + c.score, 0);
    const percentage = normalizeToPercentage(totalScore, rubric.totalPoints);

    const scoreBreakdown: ScoreBreakdown = {
      criteria,
      totalScore,
      maxScore: rubric.totalPoints,
      percentage,
    };

    const processingTimeMs = Date.now() - startTime;

    // 6. Store result in MongoDB
    const gradingResult = new MongoGradingResult({
      id: await getNextSequenceValue("GradingResult"),
      submissionId: request.submissionId,
      studentId: request.studentId,
      teacherId: 0, // TODO: get from auth context
      rubric: rubric as any,
      scoreBreakdown: scoreBreakdown as any,
      overallFeedback: parsed.overallFeedback || "",
      strengths: parsed.strengths || [],
      areasForImprovement: parsed.areasForImprovement || [],
      status: "completed",
      modelUsed: MODEL,
      processingTimeMs,
      attachments: request.attachments || [],
      contentType: request.contentType,
      completedAt: new Date(),
    });
    await gradingResult.save();

    return {
      submissionId: request.submissionId,
      studentId: request.studentId,
      status: "completed",
      scoreBreakdown,
      overallFeedback: parsed.overallFeedback || "",
      strengths: parsed.strengths || [],
      areasForImprovement: parsed.areasForImprovement || [],
      processingTimeMs,
      modelUsed: MODEL,
      createdAt: new Date(),
    };
  } catch (error: any) {
    logger.error("Grading service error:", error);

    // Store failed result
    const failedResult = new MongoGradingResult({
      id: await getNextSequenceValue("GradingResult"),
      submissionId: request.submissionId,
      studentId: request.studentId,
      teacherId: 0,
      rubric: rubric as any,
      status: "failed",
      contentType: request.contentType,
      createdAt: new Date(),
    });
    await failedResult.save();

    throw new Error(`Grading failed: ${error.message}`);
  }
}

/**
 * Get a grading result by submission ID.
 */
export async function getGradingResult(submissionId: string) {
  return MongoGradingResult.findOne({ submissionId });
}

/**
 * Get grading history for a student.
 */
export async function getGradingHistory(
  studentId: number,
  limit = 20,
  offset = 0
) {
  return MongoGradingResult.find({ studentId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
}

/**
 * Re-grade a submission (delete old result and re-process).
 */
export async function regradeSubmission(submissionId: string, request: GradingRequest) {
  // Delete old result if exists
  await MongoGradingResult.deleteOne({ submissionId });
  return gradeSubmission(request);
}
