import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `fetch` is stubbed at the global boundary so these tests exercise the Sarvam
// adapter's own logic — endpoint choice, auth header, body shaping, base64
// decoding, chunking, SSE framing — with no network call and no API key.
import {
  generate,
  streamGenerate,
  translateText,
  textToSpeech,
  speechToText,
  detectLanguage,
  MODEL_REGISTRY,
} from "../lib/ai/gateway";
import { chunkForTranslation, SARVAM_TTS_MAX_CHARS } from "../lib/ai/sarvam";

const originalOrchestrator = { ...MODEL_REGISTRY.orchestrator };
const fetchMock = vi.fn();

function useSarvamModel(model = "sarvam-105b") {
  MODEL_REGISTRY.orchestrator = { provider: "sarvam", model };
}

function jsonOk(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body)) };
}

/** Build a Response-like object whose body streams the given SSE text chunks. */
function sseStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    body: (async function* () {
      for (const chunk of chunks) yield encoder.encode(chunk);
    })(),
  };
}

describe("AI gateway — Sarvam adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    MODEL_REGISTRY.orchestrator = { ...originalOrchestrator };
    vi.unstubAllGlobals();
  });

  it("posts chat to /v1/chat/completions with the api-subscription-key header", async () => {
    useSarvamModel();
    fetchMock.mockResolvedValue(jsonOk({ choices: [{ message: { content: "नमस्ते" } }] }));

    const out = await generate({
      model: "orchestrator",
      system: "You are a teacher.",
      messages: [{ role: "user", content: "Greet the class." }],
    });

    const { url, init, body } = lastCall();
    expect(out).toBe("नमस्ते");
    expect(url).toBe("https://api.sarvam.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>)["api-subscription-key"]).toBeTruthy();
    // Sarvam takes the system prompt as a message, unlike Anthropic.
    expect(body.messages[0]).toEqual({ role: "system", content: "You are a teacher." });
    expect(body.model).toBe("sarvam-105b");
  });

  it("keeps the Indic tools at the root path, not under /v1", async () => {
    fetchMock.mockResolvedValue(jsonOk({ translated_text: "नमस्ते" }));

    await translateText("Hello", { targetLanguageCode: "hi-IN" });

    expect(lastCall().url).toBe("https://api.sarvam.ai/translate");
  });

  it("defaults the translation source language to auto-detect", async () => {
    fetchMock.mockResolvedValue(jsonOk({ translated_text: "ನಮಸ್ಕಾರ" }));

    await translateText("Hello", { targetLanguageCode: "kn-IN" });

    const { body } = lastCall();
    expect(body.source_language_code).toBe("auto");
    expect(body.target_language_code).toBe("kn-IN");
    expect(body.model).toBe("sarvam-translate:v1");
  });

  it("chunks over-length translation input instead of truncating it", async () => {
    const long = "This is a sentence. ".repeat(200); // ~4000 chars, over the 2000 limit
    const chunks = chunkForTranslation(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(2000);
    // Nothing is dropped: every sentence survives the split.
    const rejoined = chunks.join(" ").replace(/\s+/g, " ").trim();
    expect(rejoined).toBe(long.replace(/\s+/g, " ").trim());

    fetchMock.mockResolvedValue(jsonOk({ translated_text: "x" }));
    await translateText(long, { targetLanguageCode: "hi-IN" });
    expect(fetchMock).toHaveBeenCalledTimes(chunks.length);
  });

  it("decodes base64 TTS audio into buffers", async () => {
    const wav = Buffer.from("fake-wav-bytes");
    fetchMock.mockResolvedValue(jsonOk({ audios: [wav.toString("base64")] }));

    const audio = await textToSpeech("नमस्ते", { languageCode: "hi-IN" });

    expect(audio).toHaveLength(1);
    expect(audio[0].equals(wav)).toBe(true);
    expect(lastCall().body.model).toBe("bulbul:v3");
  });

  it("refuses over-length TTS input rather than shipping half a message", async () => {
    const tooLong = "a".repeat(SARVAM_TTS_MAX_CHARS + 1);

    await expect(textToSpeech(tooLong, { languageCode: "hi-IN" })).rejects.toThrow(
      /over the 2500-character limit/
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends speech-to-text as multipart without a hand-set Content-Type", async () => {
    fetchMock.mockResolvedValue(jsonOk({ transcript: "hello", language_code: "hi-IN" }));

    const result = await speechToText(Buffer.from("audio"), { mode: "translate" });

    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("https://api.sarvam.ai/speech-to-text");
    expect(init.body).toBeInstanceOf(FormData);
    // Setting Content-Type by hand would omit the multipart boundary → 400.
    expect(init.headers).not.toHaveProperty("Content-Type");
    expect(result.transcript).toBe("hello");
    expect(result.languageCode).toBe("hi-IN");
  });

  it("surfaces a 403 with an actionable key hint", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: "Forbidden",
      text: async () => JSON.stringify({ error: { message: "invalid key" } }),
    });

    await expect(detectLanguage("नमस्ते")).rejects.toThrow(
      /403.*check SARVAM_API_KEY.*invalid key/s
    );
  });

  it("reassembles SSE deltas split across network chunks", async () => {
    useSarvamModel();
    // The second frame is deliberately cut mid-JSON to prove the buffer carries
    // the partial line rather than dropping it.
    fetchMock.mockResolvedValue(
      sseStream([
        'data: {"choices":[{"delta":{"content":"नम"}}]}\n',
        'data: {"choices":[{"delta":{"con',
        'tent":"स्ते"}}]}\ndata: [DONE]\n',
      ])
    );

    const out: string[] = [];
    for await (const delta of streamGenerate({
      model: "orchestrator",
      messages: [{ role: "user", content: "hi" }],
    })) {
      out.push(delta);
    }

    expect(out.join("")).toBe("नमस्ते");
  });
});
