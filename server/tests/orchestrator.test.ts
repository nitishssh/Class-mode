/**
 * Unit tests for the orchestrator's pure context builder. The gateway-calling
 * paths (runTutorTurn / streamTutorTurn) require a live model and are exercised
 * via integration, not here; buildLearnerContext is pure and testable.
 */
import { describe, it, expect } from "vitest";
import { buildLearnerContext } from "../lib/ai/orchestrator";
import type { LearnerSnapshot } from "../lib/ai/learner-model";

const snap = (over: Partial<LearnerSnapshot> = {}): LearnerSnapshot => ({
  mastery: [],
  dueReviews: [],
  recentMemory: [],
  ...over,
});

describe("buildLearnerContext", () => {
  it("flags weak concepts for reteaching and strong ones for stretch", () => {
    const ctx = buildLearnerContext(
      snap({
        mastery: [
          {
            concept: "Fractions",
            subject: "Math",
            pMastery: 0.2,
            confidence: 0.5,
            updatedAt: new Date(),
          },
          {
            concept: "Addition",
            subject: "Math",
            pMastery: 0.95,
            confidence: 0.9,
            updatedAt: new Date(),
          },
        ],
      })
    );
    expect(ctx).toMatch(/Weak.*Fractions/);
    expect(ctx).toMatch(/Strong.*Addition/);
  });

  it("surfaces targeted mastery for the current concept", () => {
    const ctx = buildLearnerContext(
      snap({
        mastery: [
          {
            concept: "Photosynthesis",
            subject: "Bio",
            pMastery: 0.6,
            confidence: 0.4,
            updatedAt: new Date(),
          },
        ],
      }),
      { concept: "Photosynthesis" }
    );
    expect(ctx).toMatch(/Photosynthesis.*60%/);
  });

  it("marks an unseen current concept as new", () => {
    const ctx = buildLearnerContext(snap(), { concept: "Trigonometry" });
    expect(ctx).toMatch(/Trigonometry.*new/);
  });

  it("enforces the no-answers gate on graded work", () => {
    const ctx = buildLearnerContext(snap(), { graded: true });
    expect(ctx).toMatch(/GRADED WORK/);
    expect(ctx).toMatch(/do NOT reveal the final answer/);
  });

  it("omits the graded gate by default", () => {
    const ctx = buildLearnerContext(snap());
    expect(ctx).not.toMatch(/GRADED WORK/);
  });

  it("lists the due-review queue", () => {
    const ctx = buildLearnerContext(
      snap({
        dueReviews: [
          {
            concept: "Newton's Laws",
            sm2Ef: 2.5,
            intervalDays: 6,
            repetitions: 2,
            dueAt: new Date(),
            lastReviewedAt: null,
          },
        ],
      })
    );
    expect(ctx).toMatch(/Due for review now.*Newton's Laws/);
  });
});
