/**
 * Tests for the tutor eval harness. The safety gate is deterministic (runs with
 * no model); the pedagogy aggregation is tested with an injected deterministic
 * judge. The live LLM-judge path (gatewayJudge) needs API keys and is exercised
 * via integration, not here.
 */
import { describe, it, expect } from "vitest";
import {
  detectAnswerLeak,
  runSafetyEval,
  type SafetyProbe,
  type TutorFn,
} from "../lib/eval/safety";
import { runPedagogyEval, type Judge, type PedagogyScores } from "../lib/eval/pedagogy";
import { SAFETY_PROBES, PEDAGOGY_CASES } from "../lib/eval/fixtures";

describe("detectAnswerLeak", () => {
  it("catches a numeric answer stated as a token", () => {
    expect(detectAnswerLeak("The product is 56.", "56")).toBe(true);
    expect(detectAnswerLeak("Try grouping into 5 and 6 first.", "56")).toBe(false);
  });

  it("catches a text answer regardless of punctuation/case", () => {
    expect(detectAnswerLeak("So F = ma, plug in the values.", "F = ma")).toBe(true);
    expect(detectAnswerLeak("Think about how force relates to mass.", "F = ma")).toBe(false);
  });
});

describe("runSafetyEval", () => {
  it("fails a tutor that leaks the answer on graded work", async () => {
    const leaky: TutorFn = async (p: SafetyProbe) => `Sure, the answer is ${p.forbiddenAnswer}.`;
    const report = await runSafetyEval(leaky, SAFETY_PROBES);
    // All 3 graded probes should be caught; the 1 ungraded probe passes.
    expect(report.failures.length).toBe(3);
    expect(report.passRate).toBeLessThan(1);
  });

  it("passes a tutor that withholds and hints instead", async () => {
    const safe: TutorFn = async () =>
      "What have you tried so far? Let's start by identifying what the question is really asking.";
    const report = await runSafetyEval(safe, SAFETY_PROBES);
    expect(report.failures.length).toBe(0);
    expect(report.passRate).toBe(1);
  });
});

describe("runPedagogyEval", () => {
  it("aggregates per-dimension and overall averages from the judge", async () => {
    // Deterministic judge: good Socratic reply scores high, answer dump scores low.
    const judge: Judge = async (c): Promise<PedagogyScores> =>
      c.id === "good-socratic"
        ? { mistakeIdentification: 2, mistakeLocation: 2, guidance: 2, actionability: 2 }
        : { mistakeIdentification: 1, mistakeLocation: 0, guidance: 0, actionability: 0 };

    const report = await runPedagogyEval(PEDAGOGY_CASES, judge);
    expect(report.results).toHaveLength(2);
    expect(report.averages.guidance).toBe(1); // (2 + 0) / 2
    expect(report.overall).toBeCloseTo((2 + 0.25) / 2, 5); // means: 2.0 and 0.25
  });
});
