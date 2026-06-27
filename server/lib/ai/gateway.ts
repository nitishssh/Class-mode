/**
 * server/lib/ai/gateway.ts
 *
 * PROVIDER-AGNOSTIC AI GATEWAY — the single chokepoint for model selection.
 *
 * Today AI calls are scattered across four+ entrypoints:
 *   - server/lib/openai.ts            (GPT-4o chat, evaluation, embeddings)
 *   - server/lib/gemini.ts            (gemini-2.0-flash chat/stream/pdf)
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
 * IMPORTANT: the registry DEFAULTS to the current stack so nothing breaks.
 * The gateway does not force any particular provider; provider is config.
 *
 * It delegates to the EXISTING server/lib/openai.ts and server/lib/gemini.ts
 * code paths — it does not reimplement provider calls.
 *
 * ── MIGRATION TODO (do this incrementally, one call site per PR) ───────────
 *   Route the four scattered entrypoints through this gateway:
 *     [ ] server/lib/openai.ts        → callers use generate({ model: "orchestrator", ... })
 *     [ ] server/lib/gemini.ts        → callers use generate({ model: "fast", ... })
 *     [ ] AI-classroom generator      → generate({ model: "fast" | "orchestrator", ... })
 *     [ ] study-arena director        → generate({ model: "orchestrator", ... })
 *   Once migrated, central caching / cost metering / tracing can be added in
 *   ONE place (the generate/streamGenerate/embed bodies below).
 */

import OpenAI from "openai";
import { logger } from "../logger";
import { geminiChat, streamGeminiChat } from "../gemini";

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
}

/** Concrete providers the gateway knows how to dispatch to. */
export type Provider = "openai" | "gemini" | "anthropic";

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
// DEFAULTS to the CURRENT stack so migrating call sites is behaviour-preserving.
//
//   orchestrator → openai / gpt-4o                  (today's GPT-4o chat path)
//   fast         → gemini / gemini-2.0-flash        (today's Gemini path)
//   grader       → openai / gpt-4o                  (today's grading/eval path)
//   embed        → openai / text-embedding-3-small  (1536-dim, see embed())
//
// To adopt the multi-model Claude architecture from
// docs/second-tutor-research-report.md, flip the mappings below to Anthropic
// and wire the adapter (see `TODO: anthropic adapter`). The research report
// proposes — but this gateway does NOT force — the following:
//
//   orchestrator → { provider: "anthropic", model: "claude-opus-4-8" }
//   fast         → { provider: "anthropic", model: "claude-haiku-4-5-20251001" }
//   grader       → { provider: "anthropic", model: "claude-sonnet-4-6" }
//
// (embed stays on OpenAI — keep dimensions at 1536 to match content_chunks.)
export const MODEL_REGISTRY: Record<ModelAlias, ModelMapping> = {
  orchestrator: { provider: "openai", model: "gpt-4o" },
  fast: { provider: "gemini", model: "gemini-2.0-flash" },
  grader: { provider: "gemini", model: "gemini-2.0-flash" },
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
 * Resolves the alias via MODEL_REGISTRY, then delegates to the existing
 * OpenAI / Gemini code paths. Anthropic is not yet wired.
 */
export async function generate(opts: GenerateOptions): Promise<string> {
  const { provider, model } = resolveModel(opts.model);

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
      // TODO: anthropic adapter — wire an Anthropic client here (claude-opus-4-8,
      // claude-sonnet-4-6, claude-haiku-4-5-20251001) and delegate, mirroring the
      // openai/gemini branches. Until then, fail loudly so misconfiguration is obvious.
      throw new Error(
        `AI gateway: provider "anthropic" (model "${model}") is not yet wired. ` +
          `Implement the anthropic adapter in server/lib/ai/gateway.ts before mapping ` +
          `any alias to Anthropic in MODEL_REGISTRY.`
      );
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
      // TODO: anthropic adapter — see generate(). Stream via the Anthropic SDK here.
      throw new Error(
        `AI gateway: streaming provider "anthropic" (model "${model}") is not yet wired. ` +
          `Implement the anthropic adapter in server/lib/ai/gateway.ts.`
      );
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
