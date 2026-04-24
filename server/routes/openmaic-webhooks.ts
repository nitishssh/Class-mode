/**
 * server/routes/openmaic-webhooks.ts
 *
 * Webhook handlers for OpenMAIC events
 * Syncs AI classroom data back to EduAI
 */

import { Router, Request, Response } from 'express';
import { verifyOpenMAICWebhook, type OpenMAICWebhookPayload } from '../lib/openmaic-auth-bridge';
import { MongoUser, MongoTest, MongoTestAttempt, MongoAnalytics } from '@shared/mongo-schema';
import { logger } from '../lib/logger';

export const openmaicWebhookRouter = Router();

// Apply webhook verification middleware
openmaicWebhookRouter.use(verifyOpenMAICWebhook);

/**
 * @route POST /api/webhooks/openmaic/lesson-completed
 * @desc Handle lesson completion from OpenMAIC
 */
openmaicWebhookRouter.post('/lesson-completed', async (req: Request, res: Response) => {
  try {
    const payload: OpenMAICWebhookPayload = req.body;

    logger.info('[openmaic-webhook] Lesson completed', {
      classroomId: payload.classroomId,
      userId: payload.userId,
      lessonId: payload.data.lessonId,
    });

    // Find user
    const user = await MongoUser.findOne({ firebaseUid: payload.firebaseUid });
    if (!user) {
      logger.warn('[openmaic-webhook] User not found', { firebaseUid: payload.firebaseUid });
      return res.status(404).json({ message: 'User not found' });
    }

    // Store lesson completion in analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_lesson_completed',
      metadata: {
        classroomId: payload.classroomId,
        lessonId: payload.data.lessonId,
        duration: payload.data.duration,
        weaknesses: payload.data.weaknesses,
        strengths: payload.data.strengths,
        nextTopics: payload.data.nextTopics,
      },
      timestamp: new Date(payload.timestamp),
    });

    await analytics.save();

    // Update user's study plan with identified weaknesses
    if (payload.data.weaknesses && payload.data.weaknesses.length > 0) {
      const u = user as any;
      u.studyPlan = u.studyPlan || {};
      payload.data.weaknesses.forEach((weakness: string) => {
        u.studyPlan[weakness] = (u.studyPlan[weakness] || 0) + 1;
      });
      await user.save();
    }

    logger.info('[openmaic-webhook] Lesson completion processed', { userId: user.id });

    res.status(200).json({
      success: true,
      message: 'Lesson completion recorded',
      userId: user.id,
    });
  } catch (error) {
    logger.error('[openmaic-webhook] Lesson completion error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/openmaic/quiz-completed
 * @desc Handle quiz completion from OpenMAIC
 */
openmaicWebhookRouter.post('/quiz-completed', async (req: Request, res: Response) => {
  try {
    const payload: OpenMAICWebhookPayload = req.body;

    logger.info('[openmaic-webhook] Quiz completed', {
      classroomId: payload.classroomId,
      userId: payload.userId,
      quizId: payload.data.quizId,
      score: payload.data.score,
    });

    // Find user
    const user = await MongoUser.findOne({ firebaseUid: payload.firebaseUid });
    if (!user) {
      logger.warn('[openmaic-webhook] User not found', { firebaseUid: payload.firebaseUid });
      return res.status(404).json({ message: 'User not found' });
    }

    // Create test attempt record
    const testAttempt = new MongoTestAttempt({
      userId: user.id,
      testId: payload.data.quizId,
      score: payload.data.score,
      totalQuestions: 0, // Will be updated if we have more data
      correctAnswers: Math.round((payload.data.score || 0) / 100 * 10), // Estimate
      metadata: {
        source: 'openmaic',
        classroomId: payload.classroomId,
        duration: payload.data.duration,
      },
      completedAt: new Date(payload.timestamp),
    });

    await testAttempt.save();

    // Update analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_quiz_completed',
      metadata: {
        classroomId: payload.classroomId,
        quizId: payload.data.quizId,
        score: payload.data.score,
        duration: payload.data.duration,
        weaknesses: payload.data.weaknesses,
        strengths: payload.data.strengths,
      },
      timestamp: new Date(payload.timestamp),
    });

    await analytics.save();

    logger.info('[openmaic-webhook] Quiz completion processed', {
      userId: user.id,
      score: payload.data.score,
    });

    res.status(200).json({
      success: true,
      message: 'Quiz completion recorded',
      userId: user.id,
      testAttemptId: testAttempt.id,
    });
  } catch (error) {
    logger.error('[openmaic-webhook] Quiz completion error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/openmaic/session-ended
 * @desc Handle session end from OpenMAIC
 */
openmaicWebhookRouter.post('/session-ended', async (req: Request, res: Response) => {
  try {
    const payload: OpenMAICWebhookPayload = req.body;

    logger.info('[openmaic-webhook] Session ended', {
      classroomId: payload.classroomId,
      userId: payload.userId,
      duration: payload.data.duration,
    });

    // Find user
    const user = await MongoUser.findOne({ firebaseUid: payload.firebaseUid });
    if (!user) {
      logger.warn('[openmaic-webhook] User not found', { firebaseUid: payload.firebaseUid });
      return res.status(404).json({ message: 'User not found' });
    }

    // Record session analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_session_ended',
      metadata: {
        classroomId: payload.classroomId,
        duration: payload.data.duration,
        nextTopics: payload.data.nextTopics,
      },
      timestamp: new Date(payload.timestamp),
    });

    await analytics.save();

    logger.info('[openmaic-webhook] Session end processed', { userId: user.id });

    res.status(200).json({
      success: true,
      message: 'Session end recorded',
      userId: user.id,
    });
  } catch (error) {
    logger.error('[openmaic-webhook] Session end error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route POST /api/webhooks/openmaic/error
 * @desc Handle errors from OpenMAIC
 */
openmaicWebhookRouter.post('/error', async (req: Request, res: Response) => {
  try {
    const payload: OpenMAICWebhookPayload = req.body;

    logger.error('[openmaic-webhook] Error from OpenMAIC', {
      classroomId: payload.classroomId,
      userId: payload.userId,
      error: payload.data.error,
    });

    // Find user
    const user = await MongoUser.findOne({ firebaseUid: payload.firebaseUid });
    if (!user) {
      logger.warn('[openmaic-webhook] User not found', { firebaseUid: payload.firebaseUid });
      return res.status(404).json({ message: 'User not found' });
    }

    // Record error in analytics
    const analytics = new MongoAnalytics({
      userId: user.id,
      type: 'openmaic_error',
      metadata: {
        classroomId: payload.classroomId,
        error: payload.data.error,
      },
      timestamp: new Date(payload.timestamp),
    });

    await analytics.save();

    res.status(200).json({
      success: true,
      message: 'Error recorded',
      userId: user.id,
    });
  } catch (error) {
    logger.error('[openmaic-webhook] Error handler failed:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * @route GET /api/webhooks/openmaic/health
 * @desc Health check for webhook endpoint
 */
openmaicWebhookRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'openmaic-webhooks',
    timestamp: new Date().toISOString(),
  });
});
