/**
 * Web search service — gives AI agents (tutor, Study Arena director) the
 * ability to pull real-time information from the web.
 *
 * Provider is selected automatically by available credentials, so the feature
 * works out-of-the-box with no configuration and transparently upgrades when a
 * paid provider key is supplied:
 *
 *   1. TAVILY_API_KEY  → Tavily   (best quality, LLM-oriented)
 *   2. SERPER_API_KEY  → Serper   (Google SERP)
 *   3. (none)          → DuckDuckGo Instant Answer API (free, keyless, limited)
 *
 * All providers normalise to {@link WebSearchResponse}. Network/JSON failures
 * degrade to an empty result set rather than throwing, so a search miss never
 * breaks the calling agent turn.
 */
import { logger } from "../lib/logger";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  provider: "tavily" | "serper" | "duckduckgo";
  /** A direct answer when the provider supplies one (Tavily answer / DDG abstract). */
  answer: string | null;
  results: WebSearchResult[];
}

const DEFAULT_TIMEOUT_MS = 8000;

export function activeSearchProvider(): WebSearchResponse["provider"] {
  if (process.env.TAVILY_API_KEY) return "tavily";
  if (process.env.SERPER_API_KEY) return "serper";
  return "duckduckgo";
}

async function fetchJson(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<any> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchTavily(query: string, maxResults: number): Promise<WebSearchResponse> {
  const data = await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      include_answer: true,
    }),
  });
  const results: WebSearchResult[] = (data.results ?? [])
    .slice(0, maxResults)
    .map((r: any) => ({
      title: String(r.title ?? ""),
      url: String(r.url ?? ""),
      snippet: String(r.content ?? ""),
    }));
  return { query, provider: "tavily", answer: data.answer ?? null, results };
}

async function searchSerper(query: string, maxResults: number): Promise<WebSearchResponse> {
  const data = await fetchJson("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": process.env.SERPER_API_KEY as string,
    },
    body: JSON.stringify({ q: query, num: maxResults }),
  });
  const results: WebSearchResult[] = (data.organic ?? [])
    .slice(0, maxResults)
    .map((r: any) => ({
      title: String(r.title ?? ""),
      url: String(r.link ?? ""),
      snippet: String(r.snippet ?? ""),
    }));
  const answer = data.answerBox?.answer ?? data.answerBox?.snippet ?? null;
  return { query, provider: "serper", answer, results };
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<WebSearchResponse> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`;
  const data = await fetchJson(url);

  const results: WebSearchResult[] = [];
  const pushTopic = (t: any) => {
    if (results.length >= maxResults) return;
    if (t?.FirstURL && t?.Text) {
      results.push({ title: String(t.Text), url: String(t.FirstURL), snippet: String(t.Text) });
    } else if (Array.isArray(t?.Topics)) {
      t.Topics.forEach(pushTopic);
    }
  };
  (data.RelatedTopics ?? []).forEach(pushTopic);

  const answer = data.AbstractText ? String(data.AbstractText) : null;
  return { query, provider: "duckduckgo", answer, results };
}

/**
 * Run a web search using the best available provider. Never throws — on any
 * failure it logs and returns an empty result set for that provider.
 */
export async function webSearch(query: string, maxResults = 5): Promise<WebSearchResponse> {
  const provider = activeSearchProvider();
  const clamped = Math.min(Math.max(1, maxResults), 10);
  try {
    switch (provider) {
      case "tavily":
        return await searchTavily(query, clamped);
      case "serper":
        return await searchSerper(query, clamped);
      default:
        return await searchDuckDuckGo(query, clamped);
    }
  } catch (err) {
    logger.error("[web-search] search failed", { provider, query, err: String(err) });
    return { query, provider, answer: null, results: [] };
  }
}

/** Compact, citation-friendly rendering for injection into an LLM context. */
export function formatSearchForContext(res: WebSearchResponse): string {
  const lines: string[] = [];
  if (res.answer) lines.push(`Answer: ${res.answer}`);
  res.results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`);
  });
  return lines.join("\n\n") || "No results found.";
}
