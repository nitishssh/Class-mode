/**
 * server/routes/openmaic-api.ts
 *
 * API routes for OpenMAIC integration
 * Allows EduAI to create and manage AI classrooms
 */

import { Router, Request, Response } from 'express';
import { authenticateOpenMAICBridge, generateOpenMAICClassroomUrl, generateOpenMAICIframeEmbed } from '../lib/openmaic-auth-bridge';
import { getOpenMAICClient } from '../services/openmaic-client';
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
    const openmaicToken = (req as any).openmaicToken;

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
    const client = getOpenMAICClient();
    if (!client) {
      return res.status(503).json({
        message: 'OpenMAIC service is not available',
        error: 'OPENMAIC_UNAVAILABLE',
      });
    }

    // Create classroom in OpenMAIC
    const classroom = await client.createClassroom({
      topic: validatedData.topic,
      materials: validatedData.materials,
      sceneTypes: validatedData.sceneTypes,
      duration: validatedData.duration,
    });

    // Generate classroom URL with session token
    const classroomUrl = generateOpenMAICClassroomUrl(classroom.classroomId, openmaicToken);

    // Record in analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_classroom_created',
      metadata: {
        classroomId: classroom.classroomId,
        topic: validatedData.topic,
        difficulty: validatedData.difficulty,
      },
      timestamp: new Date(),
    });

    await analytics.save();

    logger.info('[openmaic-api] Classroom created successfully', {
      userId: user.id,
      classroomId: classroom.classroomId,
    });

    res.status(201).json({
      success: true,
      classroom: {
        id: classroom.classroomId,
        status: classroom.status,
        url: classroomUrl,
        topic: validatedData.topic,
        createdAt: new Date().toISOString(),
      },
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
    const client = getOpenMAICClient();
    if (!client) {
      return res.status(503).json({
        message: 'OpenMAIC service is not available',
      });
    }

    // Get classroom from OpenMAIC
    const classroom = await client.getClassroom(classroomId);

    // Generate classroom URL
    const classroomUrl = generateOpenMAICClassroomUrl(classroomId, openmaicToken);

    res.status(200).json({
      success: true,
      classroom: {
        id: classroom.classroomId,
        status: classroom.status,
        url: classroomUrl,
        scenes: classroom.scenes,
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
openmaicApiRouter.post('/quiz/generate', async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const { topic, questionCount = 5 } = req.body;

    // Validate input
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ message: 'Topic is required' });
    }

    // Find user
    const user = await MongoUser.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info('[openmaic-api] Generating quiz', {
      userId: user.id,
      topic,
      questionCount,
    });

    // Get OpenMAIC client
    const client = getOpenMAICClient();
    if (!client) {
      return res.status(503).json({
        message: 'OpenMAIC service is not available',
      });
    }

    // Generate quiz
    const quiz = await client.generateQuiz(topic, questionCount);

    // Record in analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_quiz_generated',
      metadata: {
        topic,
        questionCount,
      },
      timestamp: new Date(),
    });

    await analytics.save();

    logger.info('[openmaic-api] Quiz generated successfully', {
      userId: user.id,
      topic,
    });

    res.status(201).json({
      success: true,
      quiz,
    });
  } catch (error) {
    logger.error('[openmaic-api] Quiz generation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route POST /api/openmaic/slides/generate
 * @desc Generate slides from content
 */
openmaicApiRouter.post('/slides/generate', async (req: Request, res: Response) => {
  try {
    const firebaseUid = (req as any).firebaseUid;
    const { content, title } = req.body;

    // Validate input
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ message: 'Content is required' });
    }

    // Find user
    const user = await MongoUser.findOne({ firebaseUid });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info('[openmaic-api] Generating slides', {
      userId: user.id,
      title: title || 'Untitled',
    });

    // Get OpenMAIC client
    const client = getOpenMAICClient();
    if (!client) {
      return res.status(503).json({
        message: 'OpenMAIC service is not available',
      });
    }

    // Generate slides
    const slides = await client.generateSlides(content, title);

    // Record in analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_slides_generated',
      metadata: {
        title: title || 'Untitled',
        contentLength: content.length,
      },
      timestamp: new Date(),
    });

    await analytics.save();

    logger.info('[openmaic-api] Slides generated successfully', {
      userId: user.id,
      title,
    });

    res.status(201).json({
      success: true,
      slides,
    });
  } catch (error) {
    logger.error('[openmaic-api] Slides generation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route GET /api/openmaic/health
 * @desc Health check for OpenMAIC API
 */
openmaicApiRouter.get('/health', async (req: Request, res: Response) => {
  try {
    const client = getOpenMAICClient();

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
