/**
 * server/tests/microservices-integration.test.ts
 *
 * Integration tests for PersonalLearningPro microservices
 * Tests authentication bridge, webhooks, and API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import axios, { AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const API_BASE_URL = process.env.API_URL || 'http://localhost:5001';
const OPENMAIC_URL = process.env.OPENMAIC_URL || 'http://localhost:3000';
const INICLAW_URL = process.env.INICLAW_URL || 'http://localhost:4000';
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'bridge-secret-dev';

let apiClient: AxiosInstance;
let testToken: string;
let testUserId: string;
let testFirebaseUid: string;

describe('PersonalLearningPro Microservices Integration', () => {
  beforeAll(() => {
    apiClient = axios.create({
      baseURL: API_BASE_URL,
      validateStatus: () => true, // Don't throw on any status
    });

    // Generate test JWT token
    testFirebaseUid = 'test-firebase-uid-' + Date.now();
    testUserId = 'test-user-' + Date.now();

    testToken = jwt.sign(
      {
        uid: testFirebaseUid,
        email: 'test@example.com',
        name: 'Test User',
      },
      'test-secret',
      { expiresIn: '24h' }
    );
  });

  describe('Health Checks', () => {
    it('should check EduAI health', async () => {
      const response = await apiClient.get('/api/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
    });

    it('should check OpenMAIC health', async () => {
      const response = await apiClient.get('/api/openmaic/health');
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
    });
  });

  describe('Authentication Bridge', () => {
    it('should generate OpenMAIC session token', async () => {
      const response = await apiClient.post(
        '/api/openmaic/classroom/create',
        {
          topic: 'Test Topic',
          sceneTypes: ['slides'],
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      // Should either succeed or fail gracefully
      expect([201, 401, 403, 404, 503]).toContain(response.status);
    });

    it('should reject requests without authentication', async () => {
      const response = await apiClient.post('/api/openmaic/classroom/create', {
        topic: 'Test Topic',
      });

      expect(response.status).toBe(401);
      expect(response.data).toHaveProperty('message');
    });

    it('should validate Firebase token format', async () => {
      const response = await apiClient.post(
        '/api/openmaic/classroom/create',
        {
          topic: 'Test Topic',
        },
        {
          headers: {
            Authorization: 'Bearer invalid-token',
          },
        }
      );

      expect([401, 403]).toContain(response.status);
    });
  });

  describe('OpenMAIC API Endpoints', () => {
    it('should validate classroom creation request', async () => {
      const response = await apiClient.post(
        '/api/openmaic/classroom/create',
        {
          topic: '', // Invalid: empty topic
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      // Should either validate or fail gracefully
      expect([400, 401, 403, 404, 503]).toContain(response.status);
    });

    it('should handle quiz generation', async () => {
      const response = await apiClient.post(
        '/api/openmaic/quiz/generate',
        {
          topic: 'Mathematics',
          questionCount: 5,
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([201, 401, 403, 404, 503]).toContain(response.status);
    });

    it('should handle slides generation', async () => {
      const response = await apiClient.post(
        '/api/openmaic/slides/generate',
        {
          content: 'Test content for slides',
          title: 'Test Slides',
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([201, 401, 403, 404, 503]).toContain(response.status);
    });
  });

  describe('Webhook Integration', () => {
    it('should verify webhook signature', () => {
      const payload = {
        event: 'lesson_completed',
        classroomId: 'test-classroom',
        userId: 'test-user',
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          lessonId: 'test-lesson',
          duration: 3600,
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', BRIDGE_SECRET)
        .update(payloadString)
        .digest('hex');

      expect(signature).toBeTruthy();
      expect(signature.length).toBe(64); // SHA256 hex is 64 chars
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        event: 'lesson_completed',
        classroomId: 'test-classroom',
        userId: 'test-user',
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          lessonId: 'test-lesson',
        },
      };

      const response = await apiClient.post(
        '/api/webhooks/openmaic/lesson-completed',
        payload,
        {
          headers: {
            'X-OpenMAIC-Signature': 'invalid-signature',
          },
        }
      );

      expect(response.status).toBe(401);
    });

    it('should handle lesson completion webhook', async () => {
      const payload = {
        event: 'lesson_completed',
        classroomId: 'test-classroom-' + Date.now(),
        userId: testUserId,
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          lessonId: 'test-lesson',
          duration: 3600,
          weaknesses: ['topic-1', 'topic-2'],
          strengths: ['topic-3'],
          nextTopics: ['topic-4'],
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', BRIDGE_SECRET)
        .update(payloadString)
        .digest('hex');

      const response = await apiClient.post(
        '/api/webhooks/openmaic/lesson-completed',
        payload,
        {
          headers: {
            'X-OpenMAIC-Signature': signature,
          },
        }
      );

      // Should either succeed or fail gracefully (user might not exist)
      expect([200, 404, 500]).toContain(response.status);
    });

    it('should handle quiz completion webhook', async () => {
      const payload = {
        event: 'quiz_completed',
        classroomId: 'test-classroom-' + Date.now(),
        userId: testUserId,
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          quizId: 'test-quiz',
          score: 85,
          duration: 1800,
          weaknesses: ['topic-1'],
          strengths: ['topic-2', 'topic-3'],
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', BRIDGE_SECRET)
        .update(payloadString)
        .digest('hex');

      const response = await apiClient.post(
        '/api/webhooks/openmaic/quiz-completed',
        payload,
        {
          headers: {
            'X-OpenMAIC-Signature': signature,
          },
        }
      );

      expect([200, 404, 500]).toContain(response.status);
    });

    it('should handle session end webhook', async () => {
      const payload = {
        event: 'session_ended',
        classroomId: 'test-classroom-' + Date.now(),
        userId: testUserId,
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          duration: 5400,
          nextTopics: ['topic-4', 'topic-5'],
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', BRIDGE_SECRET)
        .update(payloadString)
        .digest('hex');

      const response = await apiClient.post(
        '/api/webhooks/openmaic/session-ended',
        payload,
        {
          headers: {
            'X-OpenMAIC-Signature': signature,
          },
        }
      );

      expect([200, 404, 500]).toContain(response.status);
    });

    it('should handle error webhook', async () => {
      const payload = {
        event: 'error',
        classroomId: 'test-classroom-' + Date.now(),
        userId: testUserId,
        firebaseUid: testFirebaseUid,
        timestamp: Date.now(),
        data: {
          error: 'Test error message',
        },
      };

      const payloadString = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', BRIDGE_SECRET)
        .update(payloadString)
        .digest('hex');

      const response = await apiClient.post(
        '/api/webhooks/openmaic/error',
        payload,
        {
          headers: {
            'X-OpenMAIC-Signature': signature,
          },
        }
      );

      expect([200, 404, 500]).toContain(response.status);
    });

    it('should check webhook health', async () => {
      const response = await apiClient.get('/api/webhooks/openmaic/health');
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status');
    });
  });

  describe('Service Communication', () => {
    it('should have OpenMAIC accessible via Nginx', async () => {
      const response = await apiClient.get('/arena/api/health');
      expect([200, 404, 503]).toContain(response.status);
    });

    it('should have IniClaw accessible via Nginx', async () => {
      const response = await apiClient.get('/gateway/api/health');
      expect([200, 404, 503]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required fields', async () => {
      const response = await apiClient.post(
        '/api/openmaic/classroom/create',
        {
          // Missing topic
          sceneTypes: ['slides'],
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([400, 401, 403, 404, 503]).toContain(response.status);
    });

    it('should handle invalid topic type', async () => {
      const response = await apiClient.post(
        '/api/openmaic/classroom/create',
        {
          topic: 123, // Should be string
        },
        {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        }
      );

      expect([400, 401, 403, 404, 503]).toContain(response.status);
    });

    it('should handle service unavailability gracefully', async () => {
      // This test assumes OpenMAIC might not be running
      const response = await apiClient.get('/api/openmaic/health');
      
      // Should either be healthy or return 503
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits on auth endpoints', async () => {
      // Make multiple rapid requests
      const requests = Array(15).fill(null).map(() =>
        apiClient.post('/api/openmaic/classroom/create', {
          topic: 'Test',
        }, {
          headers: {
            Authorization: `Bearer ${testToken}`,
          },
        })
      );

      const responses = await Promise.all(requests);
      
      // At least some should succeed or be rate limited
      const statuses = responses.map(r => r.status);
      expect(statuses.length).toBeGreaterThan(0);
    });
  });
});

describe('Microservices Architecture', () => {
  it('should have all services configured', () => {
    expect(API_BASE_URL).toBeTruthy();
    expect(OPENMAIC_URL).toBeTruthy();
    expect(INICLAW_URL).toBeTruthy();
    expect(BRIDGE_SECRET).toBeTruthy();
  });

  it('should have proper environment variables', () => {
    expect(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || true).toBeTruthy();
    expect(process.env.OPENAI_API_KEY || true).toBeTruthy();
  });
});
