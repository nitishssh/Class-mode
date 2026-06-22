import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { registerRoutes } from "../routes";

// Regression guard for the student/teacher (school) invite routing.
//
// History: the client called /api/invite/student etc., but the onboarding
// router is mounted at /api/onboarding, so those calls 404'd and the whole
// student invite -> accept -> dashboard flow was broken. The client now uses
// the canonical /api/onboarding/invite/* paths. These tests assert those
// paths resolve to a handler (not 404) against the PRODUCTION route table.
describe("School invite routing (production mount)", () => {
  let app: express.Express;

  beforeEach(async () => {
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  it("canonical send path /api/onboarding/invite/student is mounted", async () => {
    const res = await request(app).post("/api/onboarding/invite/student").send({});
    // not 404 => route exists (401/403/400 from auth/validation is expected)
    expect(res.status).not.toBe(404);
  });

  it("canonical list path /api/onboarding/invite/student/list is mounted", async () => {
    const res = await request(app).get("/api/onboarding/invite/student/list").send();
    expect(res.status).not.toBe(404);
  });

  it("canonical validate path /api/onboarding/invite/validate/:token is mounted", async () => {
    const res = await request(app).get("/api/onboarding/invite/validate/sometoken").send();
    // The handler is reached (returns JSON {message:"Invalid invite link"} for an
    // unknown token). A missing route would instead return Express's HTML "Cannot GET".
    expect(res.body?.message).toBe("Invalid invite link");
  });

  it("canonical accept path /api/onboarding/invite/accept is mounted", async () => {
    const res = await request(app).post("/api/onboarding/invite/accept").send({});
    expect(res.status).not.toBe(404);
  });

  it("workspace join flow remains separate at /api/workspaces/join/:token", async () => {
    const res = await request(app).get("/api/workspaces/join/sometoken").send();
    // Separate path; must exist independently of the school invite flow.
    expect(res.status).not.toBe(404);
  });
});
