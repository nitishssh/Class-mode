import { describe, it, expect, beforeAll } from "vitest";
import { StudyArenaClient } from "../services/study-arena-client";

// Point at the running Express server; fall back to localhost dev port.
const BASE_URL = process.env.API_URL || process.env.STUDY_ARENA_URL || "http://localhost:5001";
const isConfigured = !!process.env.API_URL || !!process.env.STUDY_ARENA_URL;

describe.skipIf(!isConfigured)("Study Arena Integration", () => {
  let client: StudyArenaClient;

  beforeAll(() => {
    client = new StudyArenaClient({
      baseUrl: BASE_URL,
      bridgeSecret: process.env.BRIDGE_SECRET,
    });
  });

  it("should report healthy", async () => {
    const isHealthy = await client.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it("should submit a classroom generation job and return a jobId", async () => {
    const response = await client.createClassroom({
      requirement: "Introduction to Machine Learning",
    });

    expect(response).toBeDefined();
    expect(typeof response.jobId).toBe("string");
    expect(response.jobId.length).toBeGreaterThan(0);
  });

  it("should poll a submitted job and return valid status fields", async () => {
    const { jobId } = await client.createClassroom({
      requirement: "Test Topic for Polling",
    });

    const status = await client.pollJob(jobId);

    expect(status.jobId).toBe(jobId);
    expect(["pending", "running", "succeeded", "failed"]).toContain(status.status);
    expect(typeof status.done).toBe("boolean");
  });
});
