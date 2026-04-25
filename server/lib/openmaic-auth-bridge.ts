/**
 * server/lib/openmaic-auth-bridge.ts
 *
 * Authentication bridge between EduAI and OpenMAIC
 * Validates Firebase JWT tokens and creates secure session links
 */

import { Request, Response, NextFunction } from 'express';
import { verifyFirebaseToken } from './firebase-admin';
import { MongoUser } from '@shared/mongo-schema';
import jwt from 'jsonwebtoken';
import { createHmac } from 'node:crypto';

const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'bridge-secret-dev';
const OPENMAIC_INTERNAL_URL = process.env.OPENMAIC_INTERNAL_URL || 'http://localhost:3000';

/**
 * OpenMAIC Session Token
 * Issued by EduAI, verified by OpenMAIC
 */
export interface OpenMAICSessionToken {
  userId: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Generate a secure session token for OpenMAIC
 * This token is passed to the OpenMAIC iframe/sub-path
 */
export async function generateOpenMAICSessionToken(
  firebaseUid: string,
  expiresIn: jwt.SignOptions['expiresIn'] = '24h'
): Promise<string> {
  try {
    const user = await MongoUser.findOne({ firebaseUid });

    if (!user) {
      throw new Error(`User not found for Firebase UID: ${firebaseUid}`);
    }

    const payload: OpenMAICSessionToken = {
      userId: user.id.toString(),
      firebaseUid,
      email: user.email,
      displayName: user.displayName || user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, BRIDGE_SECRET);
    return token;
  } catch (error) {
    console.error('[openmaic-auth-bridge] Token generation failed:', error);
    throw error;
  }
}

/**
 * Verify an OpenMAIC session token
 * Used by OpenMAIC to validate the session
 */
export function verifyOpenMAICSessionToken(token: string): OpenMAICSessionToken | null {
  try {
    const decoded = jwt.verify(token, BRIDGE_SECRET) as OpenMAICSessionToken;
    return decoded;
  } catch (error) {
    console.error('[openmaic-auth-bridge] Token verification failed:', error);
    return null;
  }
}

/**
 * Middleware: Authenticate and bridge to OpenMAIC
 * Validates Firebase token and generates OpenMAIC session token
 */
export async function authenticateOpenMAICBridge(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.access_token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(token);

    if (!decodedToken) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    // Generate OpenMAIC session token
    const openmaicToken = await generateOpenMAICSessionToken(decodedToken.uid);

    // Attach to request for downstream use
    (req as any).openmaicToken = openmaicToken;
    (req as any).firebaseUid = decodedToken.uid;

    next();
  } catch (error) {
    console.error('[openmaic-auth-bridge] Middleware error:', error);
    res.status(403).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Generate OpenMAIC classroom URL with embedded session token
 * Used to create deep links to specific classrooms
 */
export function generateOpenMAICClassroomUrl(
  classroomId: string,
  sessionToken: string
): string {
  const params = new URLSearchParams({
    token: sessionToken,
    classroom: classroomId,
  });

  return `${OPENMAIC_INTERNAL_URL}/classroom/${classroomId}?${params.toString()}`;
}

/**
 * Generate OpenMAIC iframe embed code
 * Securely embeds the AI classroom in EduAI dashboard
 */
export function generateOpenMAICIframeEmbed(
  classroomId: string,
  sessionToken: string,
  width: string = '100%',
  height: string = '600px'
): string {
  const url = generateOpenMAICClassroomUrl(classroomId, sessionToken);

  return `
    <iframe
      src="${url}"
      width="${width}"
      height="${height}"
      frameborder="0"
      allow="camera; microphone; clipboard-read; clipboard-write"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals"
      style="border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"
    ></iframe>
  `.trim();
}

/**
 * Webhook payload from OpenMAIC to EduAI
 * Sent when student completes a lesson or quiz
 */
export interface OpenMAICWebhookPayload {
  event: 'lesson_completed' | 'quiz_completed' | 'session_ended' | 'error';
  classroomId: string;
  userId: string;
  firebaseUid: string;
  timestamp: number;
  data: {
    lessonId?: string;
    quizId?: string;
    score?: number;
    duration?: number;
    weaknesses?: string[];
    strengths?: string[];
    nextTopics?: string[];
    error?: string;
  };
}

/**
 * Verify OpenMAIC webhook signature
 * Ensures webhooks are from trusted OpenMAIC instance
 */
export function verifyOpenMAICWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const hash = createHmac('sha256', BRIDGE_SECRET)
    .update(payload)
    .digest('hex');

  return hash === signature;
}

/**
 * Middleware: Verify OpenMAIC webhook
 */
export function verifyOpenMAICWebhook(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (req.method === 'GET' && req.path === '/health') {
      return next();
    }

    const signature = req.headers['x-openmaic-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (!signature || !verifyOpenMAICWebhookSignature(payload, signature)) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }

    next();
  } catch (error) {
    console.error('[openmaic-auth-bridge] Webhook verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
