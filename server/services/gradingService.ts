import {
  GradingRequest,
  GradingResponse,
  ScoreBreakdown,
  Rubric,
} from "../../shared/grading-schema";
import {
  parseRubric,
  rubricToPrompt,
  calculateWeightedTotal,
} from "../lib/rubricParser";
import {
  buildGradingUserMessage,
  getSystemPrompt,
  getEssayFewShotExamples,
} from "../lib/prompts/grading";
import {
  pgCreateGradingResult, pgFindGradingResultBySubmissionId,
  pgFindGradingResults, pgDeleteGradingResult,
} from "../lib/pg-queries";
import { geminiChat } from "../lib/gemini";
import { logger } from "../lib/logger";

const MODEL = "gemini-2.0-flash";

/**
 * Main entry point: grade a submission using OpenAI GPT-4o.
 */
export async function gradeSubmission(request: GradingRequest): Promise<GradingResponse> {
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
  const fewShotSection =
    rubric.gradingType === "essay"
      ? "\n\n" +
        getEssayFewShotExamples()
          .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n\n")
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
      const weight = criterionDef?.weight ?? 0;
      const score = Math.min(Math.max(0, Number(c.score) || 0), maxScore);
      return {
        criterionName: c.criterionName || "Unknown",
        score,
        maxScore,
        weight,
        feedback: c.feedback || "",
      };
    });

    // Compute a weighted 0..1 fraction (criterion weights are validated to
    // sum to 1.0 in parseRubric), then derive percentage and total score.
    const weightedFraction = calculateWeightedTotal(
      criteria.map((c: any) => ({
        score: c.score,
        maxScore: c.maxScore,
        weight: c.weight,
      }))
    );
    const percentage = Math.round(weightedFraction * 100);
    const totalScore = Math.round(weightedFraction * rubric.totalPoints);

    const scoreBreakdown: ScoreBreakdown = {
      criteria,
      totalScore,
      maxScore: rubric.totalPoints,
      percentage,
    };

    const processingTimeMs = Date.now() - startTime;

    // 6. Store result in PostgreSQL
    await pgCreateGradingResult({
      submissionId: request.submissionId,
      studentId: request.studentId,
      teacherId: 0,
      rubric,
      scoreBreakdown,
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

    await pgCreateGradingResult({
      submissionId: request.submissionId,
      studentId: request.studentId,
      teacherId: 0,
      rubric,
      status: "failed",
      contentType: request.contentType,
    });

    throw new Error(`Grading failed: ${error.message}`, { cause: error });
  }
}

/**
 * Get a grading result by submission ID.
 */
export async function getGradingResult(submissionId: string) {
  return pgFindGradingResultBySubmissionId(submissionId);
}

export async function getGradingHistory(studentId: number, limit = 20, offset = 0) {
  return pgFindGradingResults({ studentId, limit, skip: offset });
}

export async function regradeSubmission(submissionId: string, request: GradingRequest) {
  await pgDeleteGradingResult(submissionId);
  return gradeSubmission(request);
}
