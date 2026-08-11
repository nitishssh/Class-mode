/**
 * Regression: ISSUE-005 — school_admin was locked out of every Study Arena surface.
 * Found by /qa on 2026-08-06.
 * Report: .gstack/qa-reports/qa-report-localhost-2026-08-06.md
 *
 * `school_admin` is the TENANT admin (school owner); `admin` is the platform
 * super-role (server/lib/auth/tenant.ts). The Study Arena gates only accepted
 * "teacher" and "admin", so a principal running their own school hit 403 on
 * authoring, preview, reports, and follow-up — while the codebase elsewhere
 * (lifecycle, attendance, analytics, export) routinely grants school_admin.
 *
 * These tests pin BOTH directions: school_admin is admitted, and the roles that
 * must stay out (student, parent, anonymous) still are. The deny cases matter
 * most — a role gate that only tests the allow path can silently widen.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  user: null as any,
  pgQuery: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (!h.user) return res.status(401).json({ message: "unauthorized" });
    req.user = h.user;
    next();
  },
}));

vi.mock("../middleware/aiQuota", () => ({
  checkAIQuota: async () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../lib/db/pg-queries", () => ({ pgIncrementAIUsage: vi.fn() }));

vi.mock("../db-pg", () => ({
  getPgPool: () => ({
    query: h.pgQuery,
    connect: async () => ({ query: h.pgQuery, release: vi.fn() }),
  }),
  isPgReady: () => true,
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import router from "../routes/study-arena-beta";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).workspace = { id: 42 };
    next();
  });
  app.use("/api/study-arena-beta", router);
  return app;
}

const ASSIGNMENT_ID = "33333333-3333-4333-8333-333333333333";
const SESSION_ID = "44444444-4444-4444-8444-444444444444";

/** Every route below is an authoring/oversight surface behind the same gate. */
const GUARDED = [
  {
    name: "create a lesson draft",
    call: (app: express.Express) =>
      request(app)
        .post("/api/study-arena-beta/lesson-drafts")
        .send({
          subject: "math",
          objective: "Solve one-step linear equations",
          script: { topic: "Linear equations", conceptIds: [], scenes: [] },
        }),
  },
  {
    name: "read an assignment report",
    call: (app: express.Express) =>
      request(app).get(`/api/study-arena-beta/assignments/${ASSIGNMENT_ID}/report`),
  },
  {
    name: "record a follow-up intervention",
    call: (app: express.Express) =>
      request(app)
        .post(`/api/study-arena-beta/assignments/${ASSIGNMENT_ID}/interventions`)
        .send({ studentIds: [4], label: "needs review", suggestedAction: "reteach" }),
  },
  {
    // The legacy assign route carries its own inline copy of the gate, and it
    // validates the body BEFORE checking the role — so the payload has to be
    // schema-valid (scenes needs >= 1) or the request 400s short of the gate.
    name: "assign a lesson via the legacy route",
    call: (app: express.Express) =>
      request(app)
        .post("/api/study-arena-beta/assignments")
        .send({
          subject: "math",
          objective: "Solve one-step linear equations",
          script: {
            topic: "Linear equations",
            conceptIds: [],
            scenes: [
              {
                id: "check",
                actions: [
                  {
                    type: "ask",
                    agent: "teacher",
                    prompt: "Solve for x",
                    expects: "freeText",
                    gate: true,
                  },
                ],
              },
            ],
          },
          studentIds: [4],
        }),
  },
];

describe("Study Arena role gating (ISSUE-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STUDY_ARENA_BETA;
    h.pgQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  for (const route of GUARDED) {
    it(`admits school_admin to ${route.name}`, async () => {
      h.user = { id: 3, role: "school_admin" };
      const res = await route.call(makeApp());
      // Any non-403 proves the role gate opened; downstream may still 404/409
      // on the mocked-empty database, which is not what this test is about.
      expect(res.status).not.toBe(403);
    });

    it(`admits teacher to ${route.name} (unchanged)`, async () => {
      h.user = { id: 9, role: "teacher" };
      const res = await route.call(makeApp());
      expect(res.status).not.toBe(403);
    });

    it(`still denies student on ${route.name}`, async () => {
      h.user = { id: 4, role: "student" };
      const res = await route.call(makeApp());
      expect(res.status).toBe(403);
    });

    it(`still denies parent on ${route.name}`, async () => {
      h.user = { id: 5, role: "parent" };
      const res = await route.call(makeApp());
      expect(res.status).toBe(403);
    });

    it(`still denies anonymous on ${route.name}`, async () => {
      h.user = null;
      const res = await route.call(makeApp());
      expect(res.status).toBe(401);
    });
  }

  // canUseAttemptSession has its own role list (students PLUS authoring roles).
  // Without school_admin there, a principal could open a lesson preview but the
  // very next call would 403 — so it needs its own coverage.
  describe("canUseAttemptSession via /assignment-next-segment", () => {
    const nextSegment = (app: express.Express) =>
      request(app)
        .post("/api/study-arena-beta/assignment-next-segment")
        .send({ assignmentId: ASSIGNMENT_ID, attemptSessionId: SESSION_ID });

    // This route calls the real service, which also 403s (for session ownership)
    // against the empty mock DB. Assert on the GATE's own message so an
    // ownership 403 can never be mistaken for a role-gate pass or failure.
    const ROLE_GATE_MESSAGE =
      "Only assigned students or previewing teachers can load a lesson segment";

    it("admits school_admin (needed for teacher/principal lesson preview)", async () => {
      h.user = { id: 3, role: "school_admin" };
      const res = await nextSegment(makeApp());
      expect(res.body?.message).not.toBe(ROLE_GATE_MESSAGE);
    });

    it("admits student (unchanged)", async () => {
      h.user = { id: 4, role: "student" };
      const res = await nextSegment(makeApp());
      expect(res.body?.message).not.toBe(ROLE_GATE_MESSAGE);
    });

    it("still denies parent at the role gate", async () => {
      h.user = { id: 5, role: "parent" };
      const res = await nextSegment(makeApp());
      expect(res.status).toBe(403);
      expect(res.body?.message).toBe(ROLE_GATE_MESSAGE);
    });
  });

  it("does not grant principal — that remains a product decision (see TODOS.md)", async () => {
    h.user = { id: 8, role: "principal" };
    const res = await request(makeApp()).get(
      `/api/study-arena-beta/assignments/${ASSIGNMENT_ID}/report`
    );
    expect(res.status).toBe(403);
  });
});
