/**
 * Unit tests for the tutor adaptivity engine: Bayesian Knowledge Tracing
 * (bktUpdate) and SM-2 spaced repetition (sm2Next). These are the pure cores —
 * no DB — so they exercise the math that drives mastery estimation and review
 * scheduling.
 */
import { describe, it, expect } from "vitest";
import { bktUpdate, DEFAULT_BKT } from "../lib/knowledge-tracing";
import { sm2Next, DEFAULT_SM2 } from "../lib/spaced-repetition";

describe("bktUpdate", () => {
  it("raises mastery after a correct answer", () => {
    const after = bktUpdate(0.25, true);
    expect(after).toBeGreaterThan(0.25);
  });

  it("lowers the posterior after a wrong answer (vs the correct case)", () => {
    const right = bktUpdate(0.5, true);
    const wrong = bktUpdate(0.5, false);
    expect(wrong).toBeLessThan(right);
  });

  it("stays within [0,1] across extremes", () => {
    for (const p of [0, 0.01, 0.5, 0.99, 1]) {
      for (const correct of [true, false]) {
        const v = bktUpdate(p, correct);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it("converges toward mastery under repeated correct answers", () => {
    let p = DEFAULT_BKT.pInit;
    for (let i = 0; i < 8; i++) p = bktUpdate(p, true);
    expect(p).toBeGreaterThan(0.9);
  });

  it("models guess/slip: a single correct answer does not imply mastery", () => {
    const after = bktUpdate(DEFAULT_BKT.pInit, true);
    expect(after).toBeLessThan(0.85);
  });
});

describe("sm2Next", () => {
  it("first successful review schedules 1 day, second 6 days", () => {
    const first = sm2Next(DEFAULT_SM2, 5);
    expect(first.intervalDays).toBe(1);
    expect(first.repetitions).toBe(1);
    const second = sm2Next(first, 5);
    expect(second.intervalDays).toBe(6);
    expect(second.repetitions).toBe(2);
  });

  it("expands the interval by the easiness factor after the second rep", () => {
    let s = sm2Next(DEFAULT_SM2, 5); // 1d
    s = sm2Next(s, 5); // 6d
    const third = sm2Next(s, 5); // 6 * ef
    expect(third.intervalDays).toBeGreaterThan(6);
    expect(third.repetitions).toBe(3);
  });

  it("resets repetitions and reschedules tomorrow on a lapse (quality < 3)", () => {
    let s = sm2Next(DEFAULT_SM2, 5);
    s = sm2Next(s, 5);
    const lapsed = sm2Next(s, 1);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.intervalDays).toBe(1);
  });

  it("never lets the easiness factor drop below 1.3", () => {
    let s = DEFAULT_SM2;
    for (let i = 0; i < 10; i++) s = sm2Next(s, 0);
    expect(s.sm2Ef).toBeGreaterThanOrEqual(1.3);
  });
});
