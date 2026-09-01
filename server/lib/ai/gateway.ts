/**
 * server/lib/ai/gateway.ts
 *
 * PROVIDER-AGNOSTIC AI GATEWAY — the single chokepoint for model selection.
 *
 * Today AI calls are scattered across four+ entrypoints:
 *   - server/lib/openai.ts            (GPT-4o chat, evaluation, embeddings)
 *   - server/lib/gemini.ts            (Gemini chat/stream/pdf; PDF path only now)
 *   - the AI-classroom generator      (server/.../ai-classroom*)
 *   - the study-arena director        (server/.../study-arena*)
 *
 * There is no unifying layer, so you cannot swap models, add central
 * caching / cost tracking / observability, or adopt a multi-model agent
 * architecture without touching every call site.
 *
 * This module fixes that. It exposes a tiny provider-agnostic surface
 * (`generate`, `streamGenerate`, `embed`) keyed on LOGICAL model roles
 * ("orchestrator", "fast", "grader", "embed") rather than concrete model
 * names. A single `MODEL_REGISTRY` maps each role to a concrete
 * provider+model, so switching providers (e.g. to Claude Opus 4.8 / Sonnet
 * 4.6 / Haiku 4.5 as proposed in docs/second-tutor-research-report.md) is a
 * one-line config change here — NOT a code change at every call site.
 *
 * The gateway does not force any particular provider; provider is config.
 * As of 2026-09-01 all three chat roles resolve to Sarvam; see MODEL_REGISTRY.
 *
 * It delegates to the EXISTING server/lib/openai.ts and server/lib/gemini.ts
 * code paths — it does not reimplement provider calls.
 *
 * ── MIGRATION STATUS ───────────────────────────────────────────────────────
 *   The four scattered entrypoints are now routed through this gateway:
 *     [x] server/lib/ai/openai.ts     → no external callers; provider detail only
 *     [x] server/lib/ai/gemini.ts     → no external callers; provider detail only
 *     [x] AI-classroom generator      → study-arena/generator.ts imports generate()
 *     [x] study-arena director        → {ai-sdk,gemini}-adapter.ts import generate()
 *   Verified by grep: nothing outside server/lib/ai/ imports the provider modules
 *   or their symbols directly. `openai.ts` still EXPORTS legacy helpers (aiChat,
 *   streamAIChat, generateStudyPlan, analyzeTestPerformance) that no longer have
 *   callers — dead surface, safe to delete in a separate cleanup PR.
 *
 *   Central caching / cost metering / tracing now has ONE place to live: the
 *   generate/streamGenerate/embed bodies below (logAiCall is the seam).
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../logger";
import {
  geminiChat,
  streamGeminiChat,
  generateContentFromPdf,
  verifyGeminiAccess,
  GEMINI_DEFAULT_MODEL,
} from "./gemini";
import { evaluateSubjectiveAnswer } from "./openai";
import {
  sarvamChat,
  streamSarvamChat,
  sarvamTranslate,
  sarvamTextToSpeech,
  sarvamSpeechToText,
  sarvamTransliterate,
  sarvamDetectLanguage,
  isSarvamConfigured,
  verifySarvamAccess,
  SARVAM_DEFAULT_CHAT_MODEL,
} from "./sarvam";
import type {
  SarvamLanguageCode,
  SarvamSttMode,
  SarvamSttOptions,
  SarvamTranscript,
  SarvamTranslateOptions,
  SarvamTtsOptions,
} from "./sarvam";

// ── Public types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  /** Logical role to resolve via MODEL_REGISTRY — NOT a concrete model name. */
  model: ModelAlias;
  /** Optional system prompt. Merged ahead of any "system" message in `messages`. */
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Optional cancellation signal, forwarded to the underlying provider. */
  signal?: AbortSignal;
  /** Enable JSON Mode for structured output. */
  jsonMode?: boolean;
  /**
   * Optional fallback role tried if the primary provider throws. Mirrors the
   * legacy `aiChat` resilience (Gemini primary → OpenAI fallback) so call sites
   * that relied on it don't lose it when migrating to the gateway.
   */
  fallback?: ModelAlias;
  /** Free-form label for cost/latency logs (e.g. "grading", "study_plan"). */
  feature?: string;
}

/** Concrete providers the gateway knows how to dispatch to. */
export type Provider = "openai" | "gemini" | "anthropic" | "sarvam";

/**
 * Logical model roles. Call sites pick a ROLE; the registry below decides
 * which concrete model serves it. This is the swappable indirection layer.
 */
export type ModelAlias = "orchestrator" | "fast" | "grader" | "embed";

export interface ModelMapping {
  provider: Provider;
  model: string;
}

// ── Model registry ──────────────────────────────────────────────────────────
//
// All three chat roles run on Sarvam (2026-09-01). Two things forced this:
//
//   1. Sarvam is the chosen provider for AI workload.
//   2. The previous `fast` and `grader` mapping pointed at gemini-2.0-flash,
//      which Google REMOVED — the API answers 404 "no longer available". Six
//      call sites pass no `fallback` and so threw outright, including all
//      three grader sites (gradingService, grader-service, eval/pedagogy),
//      which meant AI grading was dead in production. The other seven silently
//      degraded to `orchestrator` on OpenAI: working, but paying GPT-4o prices
//      for every call that was supposed to be the cheap path.
//
//   orchestrator → sarvam / sarvam-105b
//   fast         → sarvam / sarvam-105b
//   grader       → sarvam / sarvam-105b
//   embed        → openai / text-embedding-3-small  (1536-dim, see embed())
//
// REQUIRES SARVAM_API_KEY in the environment. Without it every chat role
// throws, including `orchestrator`, which used to work on OpenAI — so setting
// that variable is a PRECONDITION of deploying this, not a follow-up.
//
// The model id comes from SARVAM_DEFAULT_CHAT_MODEL rather than a literal:
// Sarvam has already retired one chat model (sarvam-m), and when the next one
// goes the id should change in ./sarvam.ts alone.
//
// The Anthropic adapter IS now wired, so adopting the multi-model Claude
// architecture from docs/second-tutor-research-report.md is a config change
// here — no code change at any call site. The research report proposes — but
// this gateway does NOT force — the following:
//
//   orchestrator → { provider: "anthropic", model: "claude-opus-5" }
//   fast         → { provider: "anthropic", model: "claude-haiku-4-5" }
//   grader       → { provider: "anthropic", model: "claude-sonnet-5" }
//
// Flipping any of these requires ANTHROPIC_API_KEY in the environment.
//
// Beyond the chat roles, Sarvam also serves the Indic tool surface below
// (translate / TTS / STT / transliterate / LID), which has no equivalent on
// the other providers and is reached through dedicated functions rather than
// through a model role.
export const MODEL_REGISTRY: Record<ModelAlias, ModelMapping> = {
  orchestrator: { provider: "sarvam", model: SARVAM_DEFAULT_CHAT_MODEL },
  fast: { provider: "sarvam", model: SARVAM_DEFAULT_CHAT_MODEL },
  grader: { provider: "sarvam", model: SARVAM_DEFAULT_CHAT_MODEL },
  // Sarvam serves NO embedding model, so this alias CANNOT move with the
  // others. It must also stay at 1536 dimensions to match content_chunks.
  embed: { provider: "openai", model: "text-embedding-3-small" },
};

/** Embedding dimension — MUST match the `content_chunks vector(1536)` column. */
export const EMBEDDING_DIMENSIONS = 1536;

// ── OpenAI client (same lazy/init pattern as server/lib/openai.ts) ───────────
//
// openai.ts constructs its client privately (not exported), so we mirror its
// init pattern here rather than duplicate API-key parsing in many spots.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const key =
      process.env.OPENAI_API_KEY || (process.env.NODE_ENV === "test" ? "dummy-key" : undefined);
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// ── Anthropic client (same lazy/init pattern as getOpenAI above) ─────────────
let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const key =
      process.env.ANTHROPIC_API_KEY || (process.env.NODE_ENV === "test" ? "dummy-key" : undefined);
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    _anthropic = new Anthropic({ apiKey: key });
  }
  return _anthropic;
}

/**
 * Anthropic models that REJECT sampling params (`temperature`/`top_p`/`top_k`)
 * with a 400. Passing a caller's `temperature` straight through would hard-fail
 * every request on these, so the adapter drops it instead. Older models
 * (Opus/Sonnet 4.6, Haiku 4.5) still accept sampling and keep the value.
 */
const ANTHROPIC_SAMPLING_REJECTED = [
  "claude-fable-5",
  "claude-mythos-5",
  "claude-opus-5",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-sonnet-5",
];

function anthropicAcceptsSampling(model: string): boolean {
  return !ANTHROPIC_SAMPLING_REJECTED.some((prefix) => model.startsWith(prefix));
}

/**
 * Anthropic takes the system prompt as a top-level param, never as a message.
 *
 * `jsonMode` has no native switch on the Messages API. Assistant prefill — the
 * old trick for forcing an opening brace — returns a 400 on every current
 * model, so JSON mode is expressed as a system-prompt instruction instead.
 * That is a WEAKER guarantee than OpenAI's `response_format: json_object`:
 * callers must keep parsing defensively (parseDirectorDecision already does).
 */
function buildAnthropicSystem(opts: GenerateOptions): string {
  const base = extractSystemPrompt(opts);
  if (!opts.jsonMode) return base;
  const instruction =
    "Respond with a single valid JSON object and nothing else. " +
    "Do not wrap it in markdown fences and do not add commentary.";
  return base ? `${base}\n\n${instruction}` : instruction;
}

/**
 * Anthropic's `messages` array accepts only user/assistant turns, must be
 * non-empty, and must open on a user turn. Violations are 400s from the API,
 * so they are caught here with a message that names the actual problem.
 */
function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  if (turns.length === 0) {
    throw new Error("AI gateway: Anthropic requires at least one user/assistant message.");
  }
  if (turns[0].role !== "user") {
    throw new Error('AI gateway: Anthropic requires the first message to have role "user".');
  }
  return turns;
}

function resolveModel(alias: ModelAlias): ModelMapping {
  const mapping = MODEL_REGISTRY[alias];
  if (!mapping) throw new Error(`Unknown model alias: ${alias}`);
  return mapping;
}

/** Pull a single system prompt out of opts.system + any "system" messages. */
function extractSystemPrompt(opts: GenerateOptions): string {
  if (opts.system) return opts.system;
  const sys = opts.messages.find((m) => m.role === "system");
  return sys?.content ?? "";
}

/** Flatten non-system messages into the single-string prompt Gemini expects. */
function flattenForGemini(messages: ChatMessage[]): string {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
}

/** Build the OpenAI chat message array, injecting the system prompt first. */
function buildOpenAIMessages(opts: GenerateOptions): ChatMessage[] {
  const out = opts.messages.filter((m) => m.role !== "system");
  const system = extractSystemPrompt(opts);
  if (system) out.unshift({ role: "system", content: system });
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a single completion for the given logical model role.
 * Resolves the alias via MODEL_REGISTRY, then delegates to the OpenAI, Gemini,
 * or Anthropic code path for that provider.
 */
export async function generate(opts: GenerateOptions): Promise<string> {
  const started = Date.now();
  try {
    const out = await dispatchGenerate(opts.model, opts);
    logAiCall(opts, opts.model, started, true);
    return out;
  } catch (primaryErr) {
    if (opts.fallback && opts.fallback !== opts.model) {
      logger.warn(`[ai] primary role "${opts.model}" failed, falling back to "${opts.fallback}"`, {
        feature: opts.feature,
        err: String(primaryErr),
      });
      try {
        const out = await dispatchGenerate(opts.fallback, opts);
        logAiCall(opts, opts.fallback, started, true);
        return out;
      } catch (fallbackErr) {
        logAiCall(opts, opts.fallback, started, false);
        throw fallbackErr;
      }
    }
    logAiCall(opts, opts.model, started, false);
    throw primaryErr;
  }
}

/**
 * Central cost/latency/observability hook. Every gateway completion passes
 * through here — the one place to add token metering, tracing, or per-feature
 * quota accounting (see #265). Kept cheap (a structured debug log) for now.
 */
function logAiCall(opts: GenerateOptions, alias: ModelAlias, startedMs: number, ok: boolean): void {
  const { provider, model } = MODEL_REGISTRY[alias];
  logger.info("[ai] completion", {
    feature: opts.feature ?? "unknown",
    role: alias,
    provider,
    model,
    ms: Date.now() - startedMs,
    ok,
  });
}

/** Resolve a role to a concrete provider and dispatch a single completion. */
async function dispatchGenerate(alias: ModelAlias, opts: GenerateOptions): Promise<string> {
  const { provider, model } = resolveModel(alias);

  switch (provider) {
    case "gemini": {
      // Delegate to existing server/lib/gemini.ts.
      return geminiChat(extractSystemPrompt(opts), flattenForGemini(opts.messages), model, {
        signal: opts.signal,
        jsonMode: opts.jsonMode,
      });
    }

    case "openai": {
      // Reuse the OpenAI client/init pattern from server/lib/openai.ts.
      const response = await getOpenAI().chat.completions.create(
        {
          model,
          messages: buildOpenAIMessages(opts),
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          max_tokens: opts.maxTokens ?? 4096,
          user: "default_user",
          ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        },
        opts.signal ? { signal: opts.signal } : undefined
      );

      const choice = response.choices[0];
      if (choice?.message?.refusal) {
        throw new Error(`Model refused request: ${choice.message.refusal}`);
      }
      return choice?.message?.content || "";
    }

    case "anthropic": {
      // `thinking` is deliberately omitted. On Claude Opus 5 that means adaptive
      // thinking (its default); on Opus 4.8/4.7 it means thinking off. Both are
      // sane defaults for a shared gateway — a role that wants a specific depth
      // should set it here rather than every call site guessing.
      const system = buildAnthropicSystem(opts);
      const response = await getAnthropic().messages.create(
        {
          model,
          max_tokens: opts.maxTokens ?? 4096,
          ...(system ? { system } : {}),
          messages: toAnthropicMessages(opts.messages),
          ...(opts.temperature !== undefined && anthropicAcceptsSampling(model)
            ? { temperature: opts.temperature }
            : {}),
        },
        opts.signal ? { signal: opts.signal } : undefined
      );

      if (response.stop_reason === "refusal") {
        throw new Error(
          `Model refused request: ${response.stop_details?.explanation ?? "no explanation given"}`
        );
      }

      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
    }

    case "sarvam": {
      // OpenAI-shaped body, so the same system-prompt hoisting applies.
      return sarvamChat(extractSystemPrompt(opts), opts.messages, model, {
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        jsonMode: opts.jsonMode,
        signal: opts.signal,
      });
    }

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

/**
 * Streaming variant of `generate`. Yields content deltas as they arrive.
 * Same alias resolution + delegation as `generate`.
 */
export async function* streamGenerate(opts: GenerateOptions): AsyncIterable<string> {
  const { provider, model } = resolveModel(opts.model);

  switch (provider) {
    case "gemini": {
      yield* streamGeminiChat(extractSystemPrompt(opts), flattenForGemini(opts.messages), model, {
        signal: opts.signal,
      });
      return;
    }

    case "openai": {
      const stream = await getOpenAI().chat.completions.create(
        {
          model,
          messages: buildOpenAIMessages(opts),
          stream: true,
          ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
          max_tokens: opts.maxTokens ?? 4096,
          user: "default_user",
        },
        opts.signal ? { signal: opts.signal } : undefined
      );

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (choice?.delta?.refusal) {
          throw new Error(`Model refused request during streaming: ${choice.delta.refusal}`);
        }
        const content = choice?.delta?.content || "";
        if (content) yield content;
      }
      return;
    }

    case "anthropic": {
      const system = buildAnthropicSystem(opts);
      const stream = await getAnthropic().messages.create(
        {
          model,
          max_tokens: opts.maxTokens ?? 4096,
          ...(system ? { system } : {}),
          messages: toAnthropicMessages(opts.messages),
          ...(opts.temperature !== undefined && anthropicAcceptsSampling(model)
            ? { temperature: opts.temperature }
            : {}),
          stream: true,
        },
        opts.signal ? { signal: opts.signal } : undefined
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
        // A mid-stream refusal arrives as a message_delta stop_reason, not a throw.
        if (event.type === "message_delta" && event.delta.stop_reason === "refusal") {
          throw new Error("Model refused request during streaming.");
        }
      }
      return;
    }

    case "sarvam": {
      yield* streamSarvamChat(extractSystemPrompt(opts), opts.messages, model, {
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        signal: opts.signal,
      });
      return;
    }

    default: {
      const _exhaustive: never = provider;
      throw new Error(`Unsupported provider: ${_exhaustive}`);
    }
  }
}

/**
 * Embed an array of texts with OpenAI `text-embedding-3-small`.
 *
 * Returns one 1536-dim vector per input text, in input order. The dimension
 * is pinned to EMBEDDING_DIMENSIONS (1536) so the output matches the
 * `content_chunks vector(1536)` Postgres column used for retrieval. Uses the
 * "embed" alias from MODEL_REGISTRY for the concrete model name.
 */
/**
 * Structured subjective-answer evaluation (score/confidence/feedback).
 *
 * Specialized JSON-schema call — delegates to the existing OpenAI
 * implementation but routes through the gateway so it shares the same central
 * observability. Behavior-preserving.
 */
export async function evaluateSubjective(args: {
  studentAnswer: string;
  question: string;
  rubric: string;
  maxMarks: number;
  feature?: string;
}): ReturnType<typeof evaluateSubjectiveAnswer> {
  const started = Date.now();
  const logOpts: GenerateOptions = {
    model: "orchestrator",
    messages: [],
    feature: args.feature ?? "answer_evaluation",
  };
  try {
    const result = await evaluateSubjectiveAnswer(
      args.studentAnswer,
      args.question,
      args.rubric,
      args.maxMarks
    );
    logAiCall(logOpts, "orchestrator", started, true);
    return result;
  } catch (err) {
    logAiCall(logOpts, "orchestrator", started, false);
    throw err;
  }
}

/**
 * Multimodal PDF → text extraction/generation. Delegates to the existing
 * Gemini multimodal path (the gateway's text `generate` can't carry a PDF),
 * routed through the gateway for central observability. Behavior-preserving.
 */
export async function generateFromPdf(
  pdfBuffer: Buffer,
  prompt: string,
  opts: { signal?: AbortSignal; feature?: string } = {}
): Promise<string> {
  const started = Date.now();
  // PDF extraction is a GEMINI capability with no Sarvam equivalent, so it
  // pins its own model instead of borrowing the `fast` role's. It used to read
  // resolveModel("fast").model and hand that straight to a Gemini-only call,
  // which was fine only while `fast` happened to BE Gemini — once that role
  // moved to Sarvam it would have sent "sarvam-105b" to Google's API.
  const model = GEMINI_DEFAULT_MODEL;
  const logOpts: GenerateOptions = {
    model: "fast",
    messages: [],
    feature: opts.feature ?? "pdf_extraction",
  };
  try {
    const out = await generateContentFromPdf(pdfBuffer, prompt, model, { signal: opts.signal });
    logAiCall(logOpts, "fast", started, true);
    return out;
  } catch (err) {
    logAiCall(logOpts, "fast", started, false);
    throw err;
  }
}

/**
 * Startup health check for the default text-model provider (Gemini today),
 * plus Sarvam when a key is present. Delegates to the existing verifiers,
 * routed through the gateway so the app has no direct provider imports outside
 * this module. Fire-and-forget: both verifiers swallow their own errors, and
 * `allSettled` keeps one provider's failure from hiding the other's result.
 */
export async function healthcheck(): Promise<void> {
  await Promise.allSettled([verifyGeminiAccess(), verifySarvamAccess()]);
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { provider, model } = resolveModel("embed");
  if (provider !== "openai") {
    throw new Error(
      `AI gateway: embeddings are only implemented for OpenAI (got provider "${provider}").`
    );
  }

  try {
    const response = await getOpenAI().embeddings.create({
      model,
      input: texts,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    // OpenAI may return data out of order; sort by index to preserve input order.
    return response.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding as number[]);
  } catch (error) {
    logger.error("AI gateway embed error:", error);
    throw error;
  }
}

// ── Indic language tools (Sarvam) ────────────────────────────────────────────
//
// Translation, speech synthesis, transcription, transliteration and language
// ID are NOT text-generation roles, so they are not in MODEL_REGISTRY and take
// no ModelAlias. They are exposed here rather than imported from ./sarvam
// directly so that the "nothing outside server/lib/ai imports a provider"
// property holds, and so they land in the same structured logs as completions.
//
// Every one of these degrades to a thrown error, never to a silent no-op: a
// lesson that quietly ships untranslated to a Kannada-medium classroom is
// worse than one that fails loudly at generation time.

/** Observability seam for the non-completion Sarvam tools. Mirrors logAiCall. */
function logIndicCall(
  feature: string,
  tool: string,
  model: string,
  startedMs: number,
  ok: boolean
): void {
  logger.info("[ai] indic", {
    feature,
    tool,
    provider: "sarvam" satisfies Provider,
    model,
    ms: Date.now() - startedMs,
    ok,
  });
}

async function withIndicLogging<T>(
  feature: string,
  tool: string,
  model: string,
  run: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  try {
    const out = await run();
    logIndicCall(feature, tool, model, started, true);
    return out;
  } catch (err) {
    logIndicCall(feature, tool, model, started, false);
    throw err;
  }
}

/** True when Indic tools are usable. Call sites should branch on this rather
 *  than catching the "SARVAM_API_KEY is not set" throw. */
export function indicToolsAvailable(): boolean {
  return isSarvamConfigured();
}

/**
 * Translate text between English and the 22 scheduled Indian languages.
 * Input longer than the model limit is chunked at sentence boundaries and
 * rejoined — no truncation.
 */
export async function translateText(
  input: string,
  opts: SarvamTranslateOptions & { feature?: string }
): Promise<string> {
  return withIndicLogging(
    opts.feature ?? "translation",
    "translate",
    opts.model ?? "sarvam-translate:v1",
    () => sarvamTranslate(input, opts)
  );
}

/**
 * Synthesize speech in an Indian language. Returns decoded audio buffers.
 * Throws rather than truncating when the text exceeds the model's limit.
 */
export async function textToSpeech(
  text: string,
  opts: SarvamTtsOptions & { feature?: string }
): Promise<Buffer[]> {
  return withIndicLogging(
    opts.feature ?? "text_to_speech",
    "text-to-speech",
    opts.model ?? "bulbul:v3",
    () => sarvamTextToSpeech(text, opts)
  );
}

/** Transcribe audio. `mode: "translate"` returns English for any input language. */
export async function speechToText(
  audio: Buffer,
  opts: SarvamSttOptions & { feature?: string } = {}
): Promise<SarvamTranscript> {
  return withIndicLogging(
    opts.feature ?? "speech_to_text",
    "speech-to-text",
    opts.model ?? "saaras:v3",
    () => sarvamSpeechToText(audio, opts)
  );
}

/** Convert script without translating meaning (e.g. Devanagari → Latin). */
export async function transliterateText(
  input: string,
  opts: {
    sourceLanguageCode?: string;
    targetLanguageCode: string;
    signal?: AbortSignal;
    feature?: string;
  }
): Promise<string> {
  return withIndicLogging(opts.feature ?? "transliteration", "transliterate", "sarvam", () =>
    sarvamTransliterate(input, opts)
  );
}

/** Identify which supported language and script a string is written in. */
export async function detectLanguage(
  input: string,
  opts: { signal?: AbortSignal; feature?: string } = {}
): Promise<{ languageCode: string | null; scriptCode: string | null }> {
  return withIndicLogging(opts.feature ?? "language_id", "text-lid", "sarvam", () =>
    sarvamDetectLanguage(input, opts)
  );
}

export type {
  SarvamLanguageCode,
  SarvamSttMode,
  SarvamTranscript,
  SarvamTranslateOptions,
  SarvamTtsOptions,
};
export { SARVAM_DEFAULT_CHAT_MODEL };
