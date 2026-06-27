/**
 * Tutor orchestrator — the thin TypeScript loop that turns the infrastructure
 * pieces into a single coherent tutor turn (see docs/second-tutor-research-report.md).
 *
 * Per the reference architecture, the orchestrator is the SOLE writer to the
 * learner model. Each turn it:
 *   1. reads the learner snapshot (mastery vector, due reviews, memory),
 *   2. injects that state as context AFTER the (injected, pedagogy-owned) system
 *      prompt so prompt caching holds and the tutor is student-aware,
 *   3. calls the provider-agnostic gateway (the `orchestrator` model alias),
 *   4. commits the graded outcome through the single writer (KT + SM-2).
 *
 * It is deliberately prompt-agnostic: the Socratic/answer-withholding policy is
 * passed in as `systemPrompt`, so this loop composes with whatever tutor prompt
 * the product defines rather than hard-coding pedagogy here.
 */
import { generate, streamGenerate, type ChatMessage } from "./ai/gateway";
import { getLearnerSnapshot, type LearnerSnapshot } from "./learner-model";
import { recordOutcome } from "./knowledge-tracing";
import { recordReview } from "./spaced-repetition";

export interface TutorTurnParams {
  studentId: number;
  /** The pedagogy/system prompt (Socratic policy, answer-withholding, etc.). */
  systemPrompt: string;
  /** Prior conversation turns, oldest first. */
  history?: ChatMessage[];
  /** The student's latest message. */
  message: string;
  /** Concept under study, used to surface targeted mastery context. */
  concept?: string;
  /**
   * Graded work: when true, the orchestrator instructs the model to withhold
   * the final answer. "No answers on graded work" is a product rule, enforced
   * here regardless of the injected prompt.
   */
  graded?: boolean;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

const WEAK = 0.4;
const STRONG = 0.8;

/**
 * Render the learner snapshot as a compact context block for the model.
 * Summarises weak/strong concepts, the due-review queue, and recent memory —
 * the volatile per-student state, injected after the cached system prefix.
 */
export function buildLearnerContext(
  snapshot: LearnerSnapshot,
  opts: { concept?: string; graded?: boolean } = {}
): string {
  const lines: string[] = ["[LEARNER STATE]"];

  if (opts.concept) {
    const m = snapshot.mastery.find((x) => x.concept.toLowerCase() === opts.concept!.toLowerCase());
    lines.push(
      m
        ? `Current concept "${opts.concept}": mastery ${(m.pMastery * 100).toFixed(0)}% (confidence ${(m.confidence * 100).toFixed(0)}%).`
        : `Current concept "${opts.concept}": no prior data — treat as new.`
    );
  }

  const weak = snapshot.mastery.filter((m) => m.pMastery < WEAK).map((m) => m.concept);
  const strong = snapshot.mastery.filter((m) => m.pMastery >= STRONG).map((m) => m.concept);
  if (weak.length) lines.push(`Weak (reteach/scaffold heavily): ${weak.slice(0, 8).join(", ")}.`);
  if (strong.length) lines.push(`Strong (fade support, stretch): ${strong.slice(0, 8).join(", ")}.`);

  if (snapshot.dueReviews.length) {
    lines.push(`Due for review now: ${snapshot.dueReviews.map((r) => r.concept).slice(0, 8).join(", ")}.`);
  }
  if (snapshot.recentMemory.length) {
    lines.push(`Remembered about this student: ${snapshot.recentMemory.slice(0, 3).map((n) => n.note).join(" | ")}.`);
  }

  if (opts.graded) {
    lines.push(
      "GRADED WORK: do NOT reveal the final answer. Diagnose, then give the next graduated hint only; require an attempt first."
    );
  }

  return lines.join("\n");
}

function composeMessages(params: TutorTurnParams, learnerContext: string): {
  system: string;
  messages: ChatMessage[];
} {
  const system = `${params.systemPrompt}\n\n${learnerContext}`;
  const messages: ChatMessage[] = [
    ...(params.history ?? []),
    { role: "user", content: params.message },
  ];
  return { system, messages };
}

export interface TutorTurnResult {
  reply: string;
  snapshot: LearnerSnapshot;
}

/**
 * Run one tutor turn: load the snapshot, inject learner state, and generate a
 * reply via the gateway's `orchestrator` model. Does not grade — call
 * `commitTurnOutcome` once the exchange is assessed.
 */
export async function runTutorTurn(params: TutorTurnParams): Promise<TutorTurnResult> {
  const snapshot = await getLearnerSnapshot(params.studentId);
  const learnerContext = buildLearnerContext(snapshot, {
    concept: params.concept,
    graded: params.graded,
  });
  const { system, messages } = composeMessages(params, learnerContext);
  const reply = await generate({
    model: "orchestrator",
    system,
    messages,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    signal: params.signal,
  });
  return { reply, snapshot };
}

/** Streaming variant of {@link runTutorTurn} for SSE/WebSocket delivery. */
export async function* streamTutorTurn(params: TutorTurnParams): AsyncIterable<string> {
  const snapshot = await getLearnerSnapshot(params.studentId);
  const learnerContext = buildLearnerContext(snapshot, {
    concept: params.concept,
    graded: params.graded,
  });
  const { system, messages } = composeMessages(params, learnerContext);
  yield* streamGenerate({
    model: "orchestrator",
    system,
    messages,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
    signal: params.signal,
  });
}

export interface TurnOutcome {
  studentId: number;
  concept: string;
  subject?: string | null;
  /** Whether the student's attempt was correct (drives knowledge tracing). */
  correct: boolean;
  /** Optional SM-2 recall grade (0-5); when present, reschedules the concept. */
  reviewQuality?: number;
}

/**
 * Commit a graded turn outcome through the single writer: update mastery
 * (knowledge tracing) and, if a recall grade is given, reschedule the concept
 * (spaced repetition). This is the orchestrator's write side.
 */
export async function commitTurnOutcome(outcome: TurnOutcome): Promise<void> {
  await recordOutcome(outcome.studentId, outcome.concept, outcome.subject ?? null, outcome.correct);
  if (typeof outcome.reviewQuality === "number") {
    await recordReview(outcome.studentId, outcome.concept, outcome.reviewQuality);
  }
}
