import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../logger";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (genAI) return genAI;
  const API_KEY = process.env.GOOGLE_API_KEY || "";
  if (API_KEY) {
    logger.info("[Gemini] Initializing Gemini API with API Key");
    genAI = new GoogleGenerativeAI(API_KEY);
  } else {
    logger.warn("[Gemini] GOOGLE_API_KEY not set. Gemini features will be disabled.");
  }
  return genAI;
}

/**
 * Default Gemini chat/vision model.
 *
 * Was `gemini-2.0-flash` until 2026-09-01, when Google removed it: the API
 * answered 404 "This model models/gemini-2.0-flash is no longer available.
 * Please update your code to use models/gemini-3.6-flash". That 404 was
 * visible in the production boot log every restart, via verifyGeminiAccess.
 *
 * Declared once so the next retirement is a one-line change. Gemini is no
 * longer on any MODEL_REGISTRY role (all three chat roles moved to Sarvam on
 * 2026-09-01); it survives only for the PDF path, which is a Gemini-specific
 * capability with no Sarvam equivalent.
 */
export const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_API_KEY);
}

/**
 * Boot-time health check for the Gemini provider.
 *
 * Without this, a missing or blocked API key only surfaces deep inside a
 * feature (e.g. a 403 API_KEY_SERVICE_BLOCKED mid-lesson-generation), with no
 * obvious cause. This fires a tiny generateContent call at startup and logs a
 * loud, actionable warning so the operator can fix credentials before users
 * hit the failure. Best-effort: never throws, never blocks boot.
 */
export async function verifyGeminiAccess(): Promise<void> {
  if (!isGeminiConfigured()) {
    logger.warn(
      "[Gemini] GOOGLE_API_KEY not set — AI tutor, grading, test generation, and " +
        "Study Arena will be unavailable. Set GOOGLE_API_KEY to enable AI features."
    );
    return;
  }

  try {
    const ai = getGenAI();
    if (!ai) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const model = ai.getGenerativeModel({ model: GEMINI_DEFAULT_MODEL });
    await model.generateContent(
      { contents: [{ role: "user", parts: [{ text: "ping" }] }] },
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    logger.info("[Gemini] Provider health check passed — AI features are live.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/API_KEY_SERVICE_BLOCKED|blocked/i.test(msg)) {
      logger.error(
        "[Gemini] API key is BLOCKED for the Generative Language API. " +
          "Enable 'generativelanguage.googleapis.com' for this GCP project and remove any " +
          "API key restrictions, or issue a new unrestricted key. AI features will fail until fixed."
      );
    } else if (/403|PERMISSION_DENIED|API_KEY_INVALID|invalid/i.test(msg)) {
      logger.error(
        "[Gemini] API key was rejected (invalid or unauthorized). " +
          `Verify GOOGLE_API_KEY. Underlying error: ${msg}`
      );
    } else {
      logger.warn(`[Gemini] Provider health check failed (non-fatal): ${msg}`);
    }
  }
}

export async function geminiChat(
  systemPrompt: string,
  userPrompt: string,
  model: string = GEMINI_DEFAULT_MODEL,
  options: { jsonMode?: boolean; signal?: AbortSignal } = {}
): Promise<string> {
  const ai = getGenAI();
  if (!ai) throw new Error("Gemini service not initialized — set GOOGLE_API_KEY");

  const generativeModel = ai.getGenerativeModel({ model });
  const result = await generativeModel.generateContent(
    {
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      ...(options.jsonMode ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    },
    options.signal ? { signal: options.signal } : undefined
  );

  return result.response.text();
}

export async function* streamGeminiChat(
  systemPrompt: string,
  userPrompt: string,
  model: string = GEMINI_DEFAULT_MODEL,
  options: { signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const ai = getGenAI();
  if (!ai) throw new Error("Gemini service not initialized — set GOOGLE_API_KEY");

  const generativeModel = ai.getGenerativeModel({ model });
  const result = await generativeModel.generateContentStream(
    {
      systemInstruction: systemPrompt,
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    },
    options.signal ? { signal: options.signal } : undefined
  );

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export async function generateContentFromPdf(
  pdfBuffer: Buffer,
  prompt: string,
  model: string = GEMINI_DEFAULT_MODEL,
  options: { signal?: AbortSignal } = {}
): Promise<string> {
  const ai = getGenAI();
  if (!ai) throw new Error("Gemini service not initialized — set GOOGLE_API_KEY");

  const generativeModel = ai.getGenerativeModel({ model });
  const result = await generativeModel.generateContent(
    [
      {
        inlineData: {
          data: pdfBuffer.toString("base64"),
          mimeType: "application/pdf",
        },
      },
      { text: prompt },
    ],
    options.signal ? { signal: options.signal } : undefined
  );

  return result.response.text();
}
