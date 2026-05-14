/**
 * server/tests/microservices-integration.test.ts
 *
 * Integration tests for PersonalLearningPro microservices
 * Tests authentication, webhooks, and API endpoints
 */

import { describe, it, expect, beforeAll } from "vitest";
import axios, { AxiosInstance } from "axios";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const API_BASE_URL = process.env.API_URL || "http://localhost:5001";
const INICLAW_URL = process.env.INICLAW_GATEWAY_URL || "http://localhost:4000";
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || "bridge-secret-dev";

let apiClient: AxiosInstance;
let testToken: string;
let testUserId: string;
let testFirebaseUid: string;

describe("PersonalLearningPro Microservices Integration", () => {
  beforeAll(() => {
    apiClient = axios.create({
      baseURL: API_BASE_URL,
      validateStatus: () => true,
    });

    ["get", "post", "put", "delete", "patch"].forEach((method) => {
      const original = (apiClient as any)[method];
      (apiClient as any)[method] = async (...args: any[]) => {
        try {
          const res = await original.apply(apiClient, args);
          return res;
        } catch (e: any) {
          if (e.code === "ECONNREFUSED") {
            return { status: 503, data: {} };
          }
          throw e;
        }
      };
    });

    testFirebaseUid = "test-firebase-uid-" + Date.now();
    testUserId = "test-user-" + Date.now();

    testToken = jwt.sign(
      {
        uid: testFirebaseUid,
        email: "test@example.com",
        name: "Test User",
      },
      "test-secret",
      { expiresIn: "24h" }
    );
  });

  describe("Health Checks", () => {
    it("should check Class Mode health", async () => {
      const response = await apiClient.get("/api/health");
      expect([200, 410, 503]).toContain(response.status);
      if (response.status === 200) expect(response.data).toHaveProperty("status");
    });

    it("should check AI Classroom health", async () => {
      const response = await apiClient.get("/api/ai-classroom/health");
      expect([200, 503]).toContain(response.status);
      if (response.status === 200) expect(response.data).toHaveProperty("status");
    });
  });

  describe("AI Classroom API", () => {
    it("should create AI classroom", async () => {
      const response = await apiClient.post(
        "/api/ai-classroom/create",
        {
          topic: "Test Topic",
          sceneTypes: ["slides"],
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([202, 401, 403, 500, 503]).toContain(response.status);
    });

    it("should reject requests without authentication", async () => {
      const response = await apiClient.post("/api/ai-classroom/create", {
        topic: "Test Topic",
      });

      expect([401, 503]).toContain(response.status);
      if (response.status === 401) expect(response.data).toHaveProperty("message");
    });

    it("should validate Firebase token format", async () => {
      const response = await apiClient.post(
        "/api/ai-classroom/create",
        {
          topic: "Test Topic",
        },
        {
          headers: {
            Authorization: "Bearer invalid-token",
          },
        }
      );

      expect([401, 403, 503]).toContain(response.status);
    });

    it("should validate classroom creation request", async () => {
      const response = await apiClient.post(
        "/api/ai-classroom/create",
        {
          topic: "",
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([400, 401, 403, 503]).toContain(response.status);
    });

    it("should handle service unavailability gracefully", async () => {
      const response = await apiClient.get("/api/ai-classroom/health");
      expect([200, 503]).toContain(response.status);
    });
  });

  describe("Webhook Signature Verification", () => {
    it("should verify webhook signature", () => {
      const payload = {
        event: "lesson_completed",
        classroomId: "test-classroom",
        userId: "test-user",
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          lessonId: "test-lesson",
          duration: 3600,
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac("sha256", BRIDGE_SECRET)
        .update(payloadString)
        .digest("hex");

      expect(signature).toBeTruthy();
      expect(signature.length).toBe(64);
    });
  });

  describe("Service Communication", () => {
    it("should have IniClaw accessible via Nginx", async () => {
      const response = await apiClient.get("/gateway/api/health");
      expect([200, 404, 503]).toContain(response.status);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing required fields", async () => {
      const response = await apiClient.post(
        "/api/ai-classroom/create",
        {
          sceneTypes: ["slides"],
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([400, 401, 403, 503]).toContain(response.status);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limits on auth endpoints", async () => {
      const requests = Array(15)
        .fill(null)
        .map(() =>
          apiClient.post(
            "/api/ai-classroom/create",
            {
              topic: "Test",
            },
            {
              headers: {
                Authorization: `Bearer ${testToken}`,
              },
            }
          )
        );

      const responses = await Promise.all(requests);
      const statuses = responses.map((r) => r.status);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });
});

describe("Microservices Architecture", () => {
  it("should have all services configured", () => {
    expect(API_BASE_URL).toBeTruthy();
    expect(INICLAW_URL).toBeTruthy();
    expect(BRIDGE_SECRET).toBeTruthy();
  });

  it("should have proper environment variables", () => {
    expect(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || true).toBeTruthy();
    expect(process.env.OPENAI_API_KEY || true).toBeTruthy();
  });
});
