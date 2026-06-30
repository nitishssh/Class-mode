import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  webSearch,
  activeSearchProvider,
  formatSearchForContext,
} from "../services/web-search";

describe("web-search", () => {
  const origFetch = global.fetch;

  beforeEach(() => {
    delete process.env.TAVILY_API_KEY;
    delete process.env.SERPER_API_KEY;
  });

  afterEach(() => {
    global.fetch = origFetch;
    vi.restoreAllMocks();
  });

  describe("activeSearchProvider", () => {
    it("defaults to duckduckgo with no keys", () => {
      expect(activeSearchProvider()).toBe("duckduckgo");
    });
    it("prefers tavily, then serper", () => {
      process.env.SERPER_API_KEY = "s";
      expect(activeSearchProvider()).toBe("serper");
      process.env.TAVILY_API_KEY = "t";
      expect(activeSearchProvider()).toBe("tavily");
    });
  });

  it("parses DuckDuckGo RelatedTopics into normalized results + answer", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        AbstractText: "The Pythagorean theorem relates the sides of a right triangle.",
        RelatedTopics: [
          { FirstURL: "https://example.com/a", Text: "Topic A" },
          { Topics: [{ FirstURL: "https://example.com/b", Text: "Topic B" }] },
        ],
      }),
    }) as unknown as typeof fetch;

    const res = await webSearch("pythagorean theorem", 5);
    expect(res.provider).toBe("duckduckgo");
    expect(res.answer).toContain("right triangle");
    expect(res.results).toEqual([
      { title: "Topic A", url: "https://example.com/a", snippet: "Topic A" },
      { title: "Topic B", url: "https://example.com/b", snippet: "Topic B" },
    ]);
  });

  it("degrades to empty results (never throws) on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    const res = await webSearch("anything");
    expect(res).toEqual({
      query: "anything",
      provider: "duckduckgo",
      answer: null,
      results: [],
    });
  });

  it("formats answer + numbered citations for LLM context", () => {
    const out = formatSearchForContext({
      query: "q",
      provider: "duckduckgo",
      answer: "Short answer.",
      results: [{ title: "T1", url: "https://x.com", snippet: "S1" }],
    });
    expect(out).toContain("Answer: Short answer.");
    expect(out).toContain("[1] T1");
    expect(out).toContain("https://x.com");
  });
});
