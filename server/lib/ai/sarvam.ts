/**
 * server/lib/ai/sarvam.ts
 *
 * SARVAM AI PROVIDER — Indic-language generative tools.
 *
 * Sarvam serves 22 official Indian languages + English. It is the only provider
 * in this stack with first-class Indic speech and translation, which is what
 * Class Mode needs for parent-facing and regional-medium classrooms.
 *
 * Like ./gemini.ts and ./openai.ts, this is a PROVIDER DETAIL module: nothing
 * outside server/lib/ai/ should import it directly. Text generation is reached
 * through the gateway's `generate`/`streamGenerate`; the Indic tools below are
 * re-exported from ./gateway.ts so they share its observability seam.
 *
 * ── API SHAPE (verified against docs.sarvam.ai, Aug 2026) ───────────────────
 *   Auth        header `api-subscription-key: <key>` on every endpoint.
 *   Chat        POST /v1/chat/completions   — OpenAI-SHAPED body/response.
 *   Translate   POST /translate             — sarvam-translate:v1, 2000 chars.
 *   TTS         POST /text-to-speech        — bulbul:v3, 2500 chars, base64 out.
 *   STT         POST /speech-to-text        — saaras:v3, multipart upload.
 *   Translit    POST /transliterate
 *   Language ID POST /text-lid
 *
 * Note the inconsistency, which is Sarvam's and not a typo here: chat lives
 * under `/v1`, every other endpoint sits at the root.
 *
 * `sarvam-m` (24B) is DEPRECATED and removed from the chat API — do not add it
 * back. Current chat models are `sarvam-105b` and `sarvam-105b-conversations`.
 */

import { logger } from "../logger";
import type { ChatMessage } from "./gateway";

const DEFAULT_BASE_URL = "https://api.sarvam.ai";

/** Chat is the only endpoint under /v1; the rest are at the root. */
const CHAT_PATH = "/v1/chat/completions";

/** Hard input limits published per model. Exceeding them is a 400 upstream. */
export const SARVAM_TRANSLATE_MAX_CHARS = 2000;
export const SARVAM_TTS_MAX_CHARS = 2500;

export const SARVAM_DEFAULT_CHAT_MODEL = "sarvam-105b";
export const SARVAM_DEFAULT_TRANSLATE_MODEL = "sarvam-translate:v1";
export const SARVAM_DEFAULT_TTS_MODEL = "bulbul:v3";
export const SARVAM_DEFAULT_STT_MODEL = "saaras:v3";

/**
 * BCP-47 codes Sarvam accepts for TTS `language_code`. Translate accepts a
 * wider set (all 22 scheduled languages) plus the literal "auto" for source
 * detection, so it is validated upstream rather than here.
 */
export type SarvamLanguageCode =
  | "bn-IN" | "en-IN" | "gu-IN" | "hi-IN" | "kn-IN" | "ml-IN"
  | "mr-IN" | "od-IN" | "pa-IN" | "ta-IN" | "te-IN";

/** Saaras v3 output modes. `transcribe` keeps the source language. */
export type SarvamSttMode = "transcribe" | "translate" | "verbatim" | "translit" | "codemix";

export function isSarvamConfigured(): boolean {
  return Boolean(process.env.SARVAM_API_KEY);
}

function baseUrl(): string {
  return (process.env.SARVAM_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function apiKey(): string {
  const key =
    process.env.SARVAM_API_KEY || (process.env.NODE_ENV === "test" ? "dummy-key" : undefined);
  if (!key) {
    throw new Error(
      "SARVAM_API_KEY is not set — Sarvam Indic speech/translation features are unavailable."
    );
  }
  return key;
}

/**
 * Sarvam returns errors as JSON with varying key names (`error.message`,
 * `message`, `detail`). Squeezing them into one line keeps the thrown message
 * actionable instead of surfacing "[object Object]" or a raw HTML error page.
 */
async function readError(res: Response, endpoint: string): Promise<Error> {
  let detail: string;
  try {
    const text = await res.text();
    try {
      const body = JSON.parse(text) as Record<string, unknown>;
      const err = body.error as { message?: string } | undefined;
      detail = err?.message || (body.message as string) || (body.detail as string) || text;
    } catch {
      detail = text;
    }
  } catch {
    detail = "<unreadable response body>";
  }
  const hint =
    res.status === 403
      ? " (check SARVAM_API_KEY)"
      : res.status === 429
        ? " (rate limited or out of credits)"
        : "";
  return new Error(`Sarvam ${endpoint} failed: ${res.status} ${res.statusText}${hint} — ${detail.slice(0, 500)}`);
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  if (!res.ok) throw await readError(res, path);
  return (await res.json()) as T;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

interface SarvamChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Single chat completion. The request/response shape mirrors OpenAI's, so the
 * gateway's OpenAI message-building applies unchanged — but the auth header is
 * Sarvam's own, which is why the OpenAI SDK is not pointed at this base URL.
 */
export async function sarvamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = SARVAM_DEFAULT_CHAT_MODEL,
  options: { temperature?: number; maxTokens?: number; jsonMode?: boolean; signal?: AbortSignal } = {}
): Promise<string> {
  const turns = messages.filter((m) => m.role !== "system");
  const payload = {
    model,
    messages: systemPrompt ? [{ role: "system", content: systemPrompt }, ...turns] : turns,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    max_tokens: options.maxTokens ?? 4096,
    ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
  };

  const data = await postJson<SarvamChatResponse>(CHAT_PATH, payload, options.signal);
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * Streaming chat over SSE. Sarvam emits OpenAI-style `data:` frames terminated
 * by `data: [DONE]`. Frames can split across network chunks, so the trailing
 * partial line is carried in `buffer` rather than parsed and dropped.
 */
export async function* streamSarvamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  model: string = SARVAM_DEFAULT_CHAT_MODEL,
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const turns = messages.filter((m) => m.role !== "system");
  const res = await fetch(`${baseUrl()}${CHAT_PATH}`, {
    method: "POST",
    headers: {
      "api-subscription-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: systemPrompt ? [{ role: "system", content: systemPrompt }, ...turns] : turns,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) throw await readError(res, CHAT_PATH);
  if (!res.body) throw new Error("Sarvam chat stream returned no body.");

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // A frame that isn't JSON is a keep-alive or comment, not an error.
      }
    }
  }
}

// ── Translation ──────────────────────────────────────────────────────────────

/**
 * Split on sentence boundaries so each piece fits `limit`. Sarvam's own docs
 * prescribe this for over-length input. Splitting mid-word would corrupt the
 * translation, and truncating would silently drop content, so a single
 * oversized sentence is emitted as its own chunk and left for the API to
 * reject loudly rather than being cut.
 */
export function chunkForTranslation(input: string, limit = SARVAM_TRANSLATE_MAX_CHARS): string[] {
  if (input.length <= limit) return [input];

  // Keep the delimiter attached: split after ., !, ?, |, and the Devanagari danda.
  const sentences = input.match(/[^.!?|।]+[.!?|।]*\s*/g) ?? [input];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current && current.length + sentence.length > limit) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export interface SarvamTranslateOptions {
  /** BCP-47, or "auto" to let Sarvam detect the source. */
  sourceLanguageCode?: string;
  targetLanguageCode: string;
  model?: string;
  /** Fixes grammatical gender agreement in Hindi and similar languages. */
  speakerGender?: "Male" | "Female";
  signal?: AbortSignal;
}

/**
 * Translate text across English and the 22 scheduled Indian languages.
 *
 * Input over the 2000-character model limit is chunked at sentence boundaries
 * and rejoined — nothing is truncated. Chunks go sequentially, not in
 * parallel, because Sarvam rate-limits per key and a burst of parallel
 * requests on a long lesson would trip a 429 for the whole document.
 */
export async function sarvamTranslate(
  input: string,
  options: SarvamTranslateOptions
): Promise<string> {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const chunks = chunkForTranslation(trimmed);
  const out: string[] = [];

  for (const chunk of chunks) {
    const data = await postJson<{ translated_text?: string }>(
      "/translate",
      {
        input: chunk,
        source_language_code: options.sourceLanguageCode ?? "auto",
        target_language_code: options.targetLanguageCode,
        model: options.model ?? SARVAM_DEFAULT_TRANSLATE_MODEL,
        ...(options.speakerGender ? { speaker_gender: options.speakerGender } : {}),
      },
      options.signal
    );
    out.push(data.translated_text ?? "");
  }

  return out.join(" ").trim();
}

// ── Text to speech ───────────────────────────────────────────────────────────

export interface SarvamTtsOptions {
  languageCode: SarvamLanguageCode;
  /** bulbul:v3 ships 30+ voices; "shubh" is the model default. */
  speaker?: string;
  model?: string;
  /** 0.5–2.0 on bulbul:v3. */
  pace?: number;
  signal?: AbortSignal;
}

/**
 * Synthesize speech. Returns decoded WAV buffers — one per audio segment the
 * API returns — so callers never have to know the wire format is base64.
 *
 * Over-length text throws instead of being truncated: silently dropping the
 * tail of a parent-facing announcement would ship a half-spoken message with
 * no error anywhere. Callers that legitimately need long-form audio should
 * chunk deliberately and decide how to join the segments.
 */
export async function sarvamTextToSpeech(
  text: string,
  options: SarvamTtsOptions
): Promise<Buffer[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length > SARVAM_TTS_MAX_CHARS) {
    throw new Error(
      `Sarvam text-to-speech input is ${trimmed.length} characters, over the ` +
        `${SARVAM_TTS_MAX_CHARS}-character limit for ${options.model ?? SARVAM_DEFAULT_TTS_MODEL}. ` +
        "Split the text and synthesize each part."
    );
  }

  const data = await postJson<{ audios?: string[] }>(
    "/text-to-speech",
    {
      text: trimmed,
      language_code: options.languageCode,
      model: options.model ?? SARVAM_DEFAULT_TTS_MODEL,
      ...(options.speaker ? { speaker: options.speaker } : {}),
      ...(options.pace !== undefined ? { pace: options.pace } : {}),
    },
    options.signal
  );

  return (data.audios ?? []).map((b64) => Buffer.from(b64, "base64"));
}

// ── Speech to text ───────────────────────────────────────────────────────────

export interface SarvamSttOptions {
  /** Defaults to "transcribe" (same-language output) upstream. */
  mode?: SarvamSttMode;
  model?: string;
  /** Filename matters: Sarvam infers the container from the extension. */
  filename?: string;
  contentType?: string;
  signal?: AbortSignal;
}

export interface SarvamTranscript {
  transcript: string;
  languageCode?: string;
  requestId?: string;
}

/**
 * Transcribe audio with Saaras v3. Multipart, not JSON — the audio goes up as
 * a file part, so this bypasses `postJson`.
 */
export async function sarvamSpeechToText(
  audio: Buffer,
  options: SarvamSttOptions = {}
): Promise<SarvamTranscript> {
  const form = new FormData();
  form.append("model", options.model ?? SARVAM_DEFAULT_STT_MODEL);
  form.append("mode", options.mode ?? "transcribe");
  form.append(
    "file",
    new Blob([new Uint8Array(audio)], { type: options.contentType ?? "audio/wav" }),
    options.filename ?? "audio.wav"
  );

  // Content-Type is deliberately unset: fetch must add its own multipart
  // boundary, and setting the header by hand omits it and yields a 400.
  const res = await fetch(`${baseUrl()}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": apiKey() },
    body: form,
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!res.ok) throw await readError(res, "/speech-to-text");

  const data = (await res.json()) as {
    transcript?: string;
    language_code?: string;
    request_id?: string;
  };
  return {
    transcript: data.transcript ?? "",
    languageCode: data.language_code,
    requestId: data.request_id,
  };
}

// ── Transliteration and language identification ──────────────────────────────

/**
 * Romanize or convert script without translating meaning — e.g. rendering a
 * Hindi student name in Latin script for an English-medium register.
 */
export async function sarvamTransliterate(
  input: string,
  options: {
    sourceLanguageCode?: string;
    targetLanguageCode: string;
    signal?: AbortSignal;
  }
): Promise<string> {
  const data = await postJson<{ transliterated_text?: string }>(
    "/transliterate",
    {
      input,
      source_language_code: options.sourceLanguageCode ?? "auto",
      target_language_code: options.targetLanguageCode,
    },
    options.signal
  );
  return data.transliterated_text ?? "";
}

/** Detect which of the supported languages a string is written in. */
export async function sarvamDetectLanguage(
  input: string,
  options: { signal?: AbortSignal } = {}
): Promise<{ languageCode: string | null; scriptCode: string | null }> {
  const data = await postJson<{ language_code?: string; script_code?: string }>(
    "/text-lid",
    { input },
    options.signal
  );
  return {
    languageCode: data.language_code ?? null,
    scriptCode: data.script_code ?? null,
  };
}

// ── Health check ─────────────────────────────────────────────────────────────

/**
 * Boot-time credential check, mirroring verifyGeminiAccess: best-effort, never
 * throws, never blocks boot. Uses `/text-lid` because it is the cheapest
 * endpoint that still exercises the API key.
 */
export async function verifySarvamAccess(): Promise<void> {
  if (!isSarvamConfigured()) {
    logger.warn(
      "[Sarvam] SARVAM_API_KEY not set — Indic translation, text-to-speech, and " +
        "speech-to-text will be unavailable. Set SARVAM_API_KEY to enable them."
    );
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    await sarvamDetectLanguage("नमस्ते", { signal: controller.signal });
    logger.info("[Sarvam] Provider health check passed — Indic features are live.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/\b403\b|unauthorized|invalid/i.test(msg)) {
      logger.error(`[Sarvam] API key was rejected. Verify SARVAM_API_KEY. Underlying error: ${msg}`);
    } else {
      logger.warn(`[Sarvam] Provider health check failed (non-fatal): ${msg}`);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
