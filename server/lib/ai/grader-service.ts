import { generate, type ChatMessage } from "./gateway";
import { commitTurnOutcome } from "./orchestrator";
import { buildGraderSystemPrompt } from "../prompts/grader";
import { logger } from "../logger";

export interface GradeTutorTurnParams {
  studentId: number;
  concept: string;
  subject?: string | null;
  history: ChatMessage[];
  latestMessage: string;
}

/**
 * Assess a student response asynchronously out-of-band.
 *
 * Invokes the logical grader model in JSON mode with an 8-second abort signal timeout.
 * Calls commitTurnOutcome to persist the results (mastery updates via knowledge tracing,
 * review rescheduling via spaced repetition) to PostgreSQL.
 *
 * If the call fails or times out, it logs the failure and degrades gracefully
 * without blocking the user conversation.
 */
export async function gradeTutorTurn(params: GradeTutorTurnParams): Promise<void> {
  const { studentId, concept, subject, history, latestMessage } = params;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const system = buildGraderSystemPrompt();
    const messages: ChatMessage[] = [...history, { role: "user", content: latestMessage }];

    logger.info(
      `[Grader Service] Dispatching grading request for student ${studentId}, concept: ${concept}`
    );

    const rawResponse = await generate({
      model: "grader",
      system,
      messages,
      jsonMode: true,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const match = rawResponse.match(/\{[\s\S]*\}/);
    const jsonText = match ? match[0] : rawResponse;
    const parsed = JSON.parse(jsonText);
    const correct = !!parsed.correct;
    const reviewQuality =
      typeof parsed.reviewQuality === "number" ? Math.min(Math.max(0, parsed.reviewQuality), 5) : 0;

    logger.info(
      `[Grader Service] Grading outcome for student ${studentId}: correct=${correct}, reviewQuality=${reviewQuality}, rationale=${
        parsed.rationale || "N/A"
      }`
    );

    await commitTurnOutcome({
      studentId,
      concept,
      subject,
      correct,
      reviewQuality,
    });
  } catch (error) {
    const err = error as Error;
    if (err.name === "AbortError" || err.message?.includes("aborted")) {
      logger.error(
        `[Grader Service] Grading timed out (8s) for student ${studentId}, concept: ${concept}`
      );
    } else {
      logger.error(
        `[Grader Service] Background grading failed for student ${studentId}, concept: ${concept}:`,
        error
      );
    }
    // Graceful degradation: do not throw to caller
  }
}
