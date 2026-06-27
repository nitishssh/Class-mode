/**
 * Pedagogical-ability eval (LLM-as-judge), BEA 2025 four-dimension rubric:
 * mistake identification, mistake location, guidance quality, and feedback
 * actionability (see docs/second-tutor-research-report.md). Accuracy alone is
 * an invalid metric for a tutor — the goal is learning — so we score the
 * *teaching move*, not the answer.
 *
 * The judge is injectable: the default calls the gateway's `grader` model, but
 * unit tests pass a deterministic judge so the aggregation logic is testable
 * without a model.
 */
import { generate } from "../ai/gateway";
import { logger } from "../logger";

/** Each dimension scored 0 (No), 1 (To some extent), 2 (Yes) — the BEA scale. */
export interface PedagogyScores {
  mistakeIdentification: 0 | 1 | 2;
  mistakeLocation: 0 | 1 | 2;
  guidance: 0 | 1 | 2;
  actionability: 0 | 1 | 2;
}

export interface PedagogyCase {
  id: string;
  /** What the student said (often containing a mistake). */
  studentMessage: string;
  /** The tutor's reply being judged. */
  tutorReply: string;
  concept?: string;
}

export type Judge = (c: PedagogyCase) => Promise<PedagogyScores>;

const DIMENSIONS: (keyof PedagogyScores)[] = [
  "mistakeIdentification",
  "mistakeLocation",
  "guidance",
  "actionability",
];

const clampScore = (n: unknown): 0 | 1 | 2 => {
  const v = Math.round(Number(n));
  return (v <= 0 ? 0 : v >= 2 ? 2 : 1) as 0 | 1 | 2;
};

const JUDGE_SYSTEM = `You are a strict evaluator of TUTORING quality (BEA 2025 rubric). You judge the teaching move, not whether the tutor gave the answer. Score each dimension 0 (No), 1 (To some extent), or 2 (Yes):
- mistakeIdentification: did the tutor recognise the student has a mistake/misconception?
- mistakeLocation: did it pinpoint WHERE the error is?
- guidance: is the guidance Socratic and appropriately scaffolded (not just the answer)?
- actionability: can the student act on the feedback to make progress?
Reply with ONLY a JSON object: {"mistakeIdentification":N,"mistakeLocation":N,"guidance":N,"actionability":N}.`;

/** Default judge: asks the gateway's `grader` model and parses the rubric JSON. */
export async function gatewayJudge(c: PedagogyCase): Promise<PedagogyScores> {
  const raw = await generate({
    model: "grader",
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Concept: ${c.concept ?? "unknown"}\nStudent: ${c.studentMessage}\nTutor: ${c.tutorReply}`,
      },
    ],
    temperature: 0,
  });
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    return {
      mistakeIdentification: clampScore(parsed.mistakeIdentification),
      mistakeLocation: clampScore(parsed.mistakeLocation),
      guidance: clampScore(parsed.guidance),
      actionability: clampScore(parsed.actionability),
    };
  } catch (err) {
    logger.error("[eval/pedagogy] judge parse failed", { err: String(err), raw: raw.slice(0, 200) });
    return { mistakeIdentification: 0, mistakeLocation: 0, guidance: 0, actionability: 0 };
  }
}

export interface PedagogyResult {
  case: PedagogyCase;
  scores: PedagogyScores;
  /** Mean of the four dimensions, 0-2. */
  overall: number;
}

export interface PedagogyEvalReport {
  results: PedagogyResult[];
  /** Per-dimension averages across all cases (0-2). */
  averages: Record<keyof PedagogyScores, number>;
  /** Mean overall across all cases (0-2). */
  overall: number;
}

const meanOverall = (s: PedagogyScores): number =>
  DIMENSIONS.reduce((acc, d) => acc + s[d], 0) / DIMENSIONS.length;

/**
 * Judge every case and aggregate per-dimension + overall averages. Pass a
 * `judge` to score deterministically (tests); omit it to use the live model.
 */
export async function runPedagogyEval(
  cases: PedagogyCase[],
  judge: Judge = gatewayJudge
): Promise<PedagogyEvalReport> {
  const results: PedagogyResult[] = await Promise.all(
    cases.map(async (c) => {
      const scores = await judge(c);
      return { case: c, scores, overall: meanOverall(scores) };
    })
  );
  const averages = {
    mistakeIdentification: 0,
    mistakeLocation: 0,
    guidance: 0,
    actionability: 0,
  } as Record<keyof PedagogyScores, number>;
  for (const d of DIMENSIONS) {
    averages[d] = results.length
      ? results.reduce((acc, r) => acc + r.scores[d], 0) / results.length
      : 0;
  }
  return {
    results,
    averages,
    overall: results.length ? results.reduce((acc, r) => acc + r.overall, 0) / results.length : 0,
  };
}
