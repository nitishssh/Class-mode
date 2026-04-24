/**
 * server/routes/openmaic-api.ts
 *
 * API routes for OpenMAIC integration
 * Allows EduAI to create and manage AI classrooms
 */

import { Router, Request, Response } from 'express';
import { authenticateOpenMAICBridge, generateOpenMAICClassroomUrl, generateOpenMAICIframeEmbed } from '../lib/openmaic-auth-bridge';
import { getStudyArenaClient } from '../services/study-arena-client';
import { MongoUser, MongoAnalytics } from '@shared/mongo-schema';
import { logger } from '../lib/logger';
import { z } from 'zod';

export const openmaicApiRouter = Router();

// Apply authentication middleware
openmaicApiRouter.use(authenticateOpenMAICBridge);

// Validation schemas
const createClassroomSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  materials: z.array(z.string()).optional(),
  sceneTypes: z.array(z.enum(['slides', 'quiz', 'simulation', 'pbl'])).optional(),
  duration: z.number().min(5).max(180).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
});

/**
 * @route POST /api/openmaic/classroom/create
 * @desc Create a new AI classroom session
 */
openmaicApiRouter.post('/classroom/create', async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;

    // Validate request
    const validatedData = createClassroomSchema.parse(req.body);

    // Find user
    const user = await MongoUser.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info('[openmaic-api] Creating classroom', {
      userId: user.id,
      topic: validatedData.topic,
    });

    // Get OpenMAIC client
    const client = getStudyArenaClient();
    if (!client) {
      return res.status(503).json({
        message: 'OpenMAIC service is not available',
        error: 'OPENMAIC_UNAVAILABLE',
      });
    }

    // Submit async classroom generation job to Study Arena
    const job = await client.createClassroom({
      requirement: validatedData.topic,
    });

    // Record in analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_classroom_created',
      metadata: {
        jobId: job.jobId,
        topic: validatedData.topic,
        difficulty: validatedData.difficulty,
      },
      timestamp: new Date(),
    });

    await analytics.save();

    logger.info('[openmaic-api] Classroom generation started', {
      userId: user.id,
      jobId: job.jobId,
    });

    res.status(202).json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      message: job.message,
      pollUrl: job.pollUrl,
      topic: validatedData.topic,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: error.errors,
      });
    }

    logger.error('[openmaic-api] Classroom creation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route GET /api/openmaic/classroom/:classroomId
 * @desc Get classroom details and status
 */
openmaicApiRouter.get('/classroom/:classroomId', async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const openmaicToken = (req as any).openmaicToken;
    const { classroomId } = req.params;

    // Find user
    const user = await MongoUser.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get OpenMAIC client
    const client = getStudyArenaClient();
    if (!client) {
      return res.status(503).json({
        message: 'OpenMAIC service is not available',
      });
    }

    // Get classroom from Study Arena
    const classroom = await client.getClassroom(classroomId) as any;

    // Generate classroom URL
    const classroomUrl = generateOpenMAICClassroomUrl(classroomId, openmaicToken);

    res.status(200).json({
      success: true,
      classroom: {
        id: classroom?.classroomId ?? classroomId,
        status: classroom?.status,
        url: classroomUrl,
        scenes: classroom?.scenes,
      },
    });
  } catch (error) {
    logger.error('[openmaic-api] Get classroom error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route POST /api/openmaic/classroom/:classroomId/embed
 * @desc Get iframe embed code for classroom
 */
openmaicApiRouter.post('/classroom/:classroomId/embed', async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const openmaicToken = (req as any).openmaicToken;
    const { classroomId } = req.params;
    const { width = '100%', height = '600px' } = req.body;

    // Find user
    const user = await MongoUser.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate iframe embed code
    const embedCode = generateOpenMAICIframeEmbed(classroomId, openmaicToken, width, height);

    res.status(200).json({
      success: true,
      embed: embedCode,
      classroomId,
    });
  } catch (error) {
    logger.error('[openmaic-api] Embed generation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route POST /api/openmaic/quiz/generate
 * @desc Generate an interactive quiz from a topic
 */
openmaicApiRouter.post('/quiz/generate', async (_req: Request, res: Response) => {
  res.status(503).json({
    message: 'Standalone quiz generation is not supported. Use /classroom/create to generate a classroom with embedded quizzes.',
    error: 'UNSUPPORTED_OPERATION',
  });
});

/**
 * @route POST /api/openmaic/slides/generate
 * @desc Generate slides from content
 */
openmaicApiRouter.post('/slides/generate', async (_req: Request, res: Response) => {
  res.status(503).json({
    message: 'Standalone slide generation is not supported. Use /classroom/create to generate a classroom with embedded slides.',
    error: 'UNSUPPORTED_OPERATION',
  });
});

/**
 * @route GET /api/openmaic/health
 * @desc Health check for OpenMAIC API
 */
openmaicApiRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const client = getStudyArenaClient();

    if (!client) {
      return res.status(503).json({
        status: 'unavailable',
        message: 'OpenMAIC client not initialized',
      });
    }

    const isHealthy = await client.healthCheck();

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'openmaic-api',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[openmaic-api] Health check error:', error);
    res.status(503).json({
      status: 'error',
      message: 'Health check failed',
    });
  }
});
