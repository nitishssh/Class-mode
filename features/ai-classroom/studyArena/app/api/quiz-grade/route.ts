/**
 * Quiz Grading API
 *
 * POST: Receives a text question + user answer, calls LLM for scoring and feedback.
 * Used for short-answer (text) questions that cannot be graded locally.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
const log = createLogger('Quiz Grade');

interface GradeRequest {
  question: string;
  userAnswer: string;
  points: number;
  commentPrompt?: string;
  language?: string;
}

interface GradeResponse {
  score: number;
  comment: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GradeRequest;
    const { question, userAnswer, points, commentPrompt, language } = body;

    if (!question || !userAnswer) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'question and userAnswer are required');
    }

    // Resolve model from request headers
    const { model: languageModel } = resolveModelFromHeaders(req);

    const systemPrompt = `You are a professional educational assessor. Grade the student's answer and provide brief feedback.
You must reply in the following JSON format only (no other content):
{"score": <integer from 0 to ${points}>, "comment": "<one or two sentences of feedback>"}`;

    const userPrompt = `Question: ${question}
Full marks: ${points} points
${commentPrompt ? `Grading guidance: ${commentPrompt}\n` : ''}Student answer: ${userAnswer}`;

    const result = await callLLM(
      {
        model: languageModel,
        system: systemPrompt,
        prompt: userPrompt,
      },
      'quiz-grade',
    );

    // Parse the LLM response as JSON.
    // Strategy: try direct parse, then scan all flat {...} objects in reverse
    // order (last match is most likely the final answer when the LLM adds
    // preamble). The old greedy /\{[\s\S]*\}/ was wrong: it matched from the
    // first { to the very last }, producing invalid JSON when multiple objects
    // appeared in the response.
    const text = result.text.trim();
    let gradeResult: GradeResponse;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let parsed: Record<string, any> | null = null;

      try {
        parsed = JSON.parse(text);
      } catch {
        // Not pure JSON — scan for embedded flat objects (no nesting).
        const candidates = [...text.matchAll(/\{[^{}]+\}/g)].reverse();
        for (const m of candidates) {
          try {
            const candidate = JSON.parse(m[0]);
            if ('score' in candidate) { parsed = candidate; break; }
          } catch { /* try next */ }
        }
      }

      if (!parsed || !('score' in parsed)) throw new Error('No scoreable JSON found');

      gradeResult = {
        score: Math.max(0, Math.min(points, Math.round(Number(parsed.score)))),
        comment: String(parsed.comment || ''),
      };
    } catch {
      const isZh = language === 'zh' || language === 'zh-CN';
      gradeResult = {
        score: Math.round(points * 0.5),
        comment: isZh
          ? 'Answered, please refer to the standard answer.'
          : 'Answer received. Please refer to the standard answer.',
      };
    }

    return apiSuccess({ ...gradeResult });
  } catch (error) {
    log.error('Error:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to grade answer');
  }
}
