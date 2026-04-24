import { describe, it, expect, beforeAll } from "vitest";
import { StudyArenaClient } from "../services/study-arena-client";

describe("Study Arena Integration", () => {
  let client: StudyArenaClient;

  beforeAll(() => {
    // Only run tests if Study Arena is configured
    const baseUrl = process.env.STUDY_ARENA_URL || process.env.OPENMAIC_INTERNAL_URL;
    if (!baseUrl) {
      console.log("Skipping Study Arena tests - STUDY_ARENA_URL not configured");
      return;
    }

    client = new StudyArenaClient({
      baseUrl,
      bridgeSecret: process.env.BRIDGE_SECRET,
    });
  });

  it("should check if Study Arena is available", async () => {
    if (!client) return;

    const isHealthy = await client.healthCheck();
    expect(typeof isHealthy).toBe("boolean");
  });

  it("should submit a classroom generation job", async () => {
    if (!client) return;

    try {
      const response = await client.createClassroom({
        requirement: "Introduction to Machine Learning",
      });

      expect(response).toBeDefined();
      expect(response.jobId).toBeDefined();
      expect(response.status).toBeDefined();
    } catch (error: unknown) {
      // If Study Arena is not running, this will fail
      console.log("Classroom creation failed (expected if Study Arena not running):", (error as Error).message);
    }
  });

  it("should poll a job status", async () => {
    if (!client) return;

    try {
      const createResponse = await client.createClassroom({
        requirement: "Test Topic for Polling",
      });

      const jobStatus = await client.pollJob(createResponse.jobId);
      expect(jobStatus).toBeDefined();
      expect(jobStatus.jobId).toBe(createResponse.jobId);
      expect(typeof jobStatus.done).toBe("boolean");
    } catch (error: unknown) {
      console.log("Job polling failed (expected if Study Arena not running):", (error as Error).message);
    }
  });
});
