/**
 * Unit tests for the RAG pure cores: text chunking and retrieved-context
 * formatting. Ingest/retrieve themselves hit pgvector + an embeddings provider
 * and are covered by integration, not here.
 */
import { describe, it, expect } from "vitest";
import { chunkText } from "../lib/rag/chunk";
import { formatRetrievedContext, type RetrievedChunk } from "../lib/rag";

describe("chunkText", () => {
  it("returns one chunk for short text", () => {
    const out = chunkText("Photosynthesis converts light into chemical energy.");
    expect(out).toHaveLength(1);
  });

  it("splits long text into multiple overlapping chunks", () => {
    const sentence = "This is a sentence with several words in it. ";
    const text = sentence.repeat(60); // ~540 words
    const out = chunkText(text, { maxWords: 60, overlapWords: 10 });
    expect(out.length).toBeGreaterThan(1);
    // Every chunk stays within a reasonable bound of the target size.
    for (const c of out) expect(c.split(/\s+/).length).toBeLessThanOrEqual(75);
  });

  it("carries overlap between consecutive chunks", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} here.`).join(" ");
    const out = chunkText(text, { maxWords: 40, overlapWords: 8 });
    expect(out.length).toBeGreaterThan(1);
    // The tail of chunk N should reappear at the head of chunk N+1.
    const tail = out[0].split(/\s+/).slice(-4).join(" ");
    expect(out[1]).toContain(tail.split(/\s+/)[0]);
  });

  it("returns [] for empty input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("keeps an oversized single sentence as its own chunk", () => {
    const big = "word ".repeat(300).trim() + ".";
    const out = chunkText(big, { maxWords: 50 });
    expect(out).toHaveLength(1);
  });
});

describe("formatRetrievedContext", () => {
  const chunk = (over: Partial<RetrievedChunk>): RetrievedChunk => ({
    id: 1,
    source: null,
    subject: null,
    topic: null,
    chunk: "content",
    distance: 0.1,
    ...over,
  });

  it("returns empty string when there are no chunks", () => {
    expect(formatRetrievedContext([])).toBe("");
  });

  it("renders a grounding instruction and numbered chunks with sources", () => {
    const out = formatRetrievedContext([
      chunk({ id: 1, source: "Physics Ch.5", chunk: "Faraday's law states..." }),
      chunk({ id: 2, source: "Notes", chunk: "Flux is..." }),
    ]);
    expect(out).toMatch(/CURRICULUM CONTEXT/);
    expect(out).toMatch(/ground your answer/);
    expect(out).toContain("Physics Ch.5");
    expect(out).toContain("Faraday's law states...");
    expect(out).toMatch(/\[2/);
  });
});
