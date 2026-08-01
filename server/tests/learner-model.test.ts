import { describe, it, expect, vi, beforeEach } from "vitest";

// Local pool mock so we can drive query results per-test. Overrides the global
// db-pg mock from setup.ts.
const mockQuery = vi.fn();
vi.mock("../db-pg", () => ({
  isPgReady: () => true,
  getPgPool: () => ({ query: mockQuery }),
  connectPostgres: vi.fn(),
  withPgClient: vi.fn(),
}));

import { getMasteryDashboard } from "../lib/ai/learner-model";

describe("getMasteryDashboard", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("maps mastery rows and computes dueCount from past/future due dates", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();

    // First query → mastery, second query → reviews (Promise.all order).
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            concept: "Pythagorean Theorem",
            subject: "Math",
            p_mastery: 0.82,
            confidence: 0.7,
            updated_at: new Date().toISOString(),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            concept: "Pythagorean Theorem",
            sm2_ef: 2.5,
            interval_days: 1,
            repetitions: 2,
            due_at: past,
            last_reviewed_at: null,
          },
          {
            concept: "Trigonometry",
            sm2_ef: 2.6,
            interval_days: 4,
            repetitions: 3,
            due_at: future,
            last_reviewed_at: null,
          },
        ],
      });

    const result = await getMasteryDashboard(1);

    expect(result.mastery).toHaveLength(1);
    expect(result.mastery[0]).toMatchObject({
      concept: "Pythagorean Theorem",
      subject: "Math",
      pMastery: 0.82,
    });
    expect(result.reviews).toHaveLength(2);
    // Only the past-due review counts toward dueCount.
    expect(result.dueCount).toBe(1);
  });

  it("returns an empty dashboard (does not throw) when a query fails", async () => {
    mockQuery.mockRejectedValue(new Error("connection lost"));
    const result = await getMasteryDashboard(1);
    expect(result).toEqual({ mastery: [], reviews: [], dueCount: 0 });
  });
});
