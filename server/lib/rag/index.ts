/**
 * Retrieval-Augmented Generation over the curriculum (`content_chunks`,
 * pgvector). Grounding the tutor in instructor/syllabus content is the report's
 * #1 hallucination defence — an ungrounded tutor invents facts. This module is
 * the ingest + retrieval half; the orchestrator injects retrieved chunks into
 * the turn context.
 *
 * The embedder is injectable: it defaults to the provider-agnostic gateway
 * (`embed`, OpenAI text-embedding-3-small, 1536-dim) but any
 * `(texts) => Promise<number[][]>` works, which keeps the pipeline unit-testable
 * without an embeddings provider.
 */
import { getPgPool, isPgReady } from "../../db-pg";
import { logger } from "../logger";
import { embed as gatewayEmbed, EMBEDDING_DIMENSIONS } from "../ai/gateway";
import { chunkText, type ChunkOptions } from "./chunk";

export type Embedder = (texts: string[]) => Promise<number[][]>;

export interface IngestItem {
  source: string;
  subject?: string | null;
  topic?: string | null;
  text: string;
}

export interface RetrievedChunk {
  id: number;
  source: string | null;
  subject: string | null;
  topic: string | null;
  chunk: string;
  /** Cosine distance (0 = identical); lower is more relevant. */
  distance: number;
}

export interface RetrieveOptions {
  subject?: string;
  topic?: string;
  /** Max chunks to return. */
  k?: number;
}

/** pgvector wants a bracketed, comma-separated literal: `[0.1,0.2,...]`. */
function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/**
 * Chunk each item, embed the chunks, and insert them into `content_chunks`.
 * Returns the number of chunks stored. No-op (returns 0) if Postgres is down.
 */
export async function ingestContent(
  items: IngestItem[],
  opts: { embedder?: Embedder; chunk?: ChunkOptions } = {}
): Promise<number> {
  if (!isPgReady()) return 0;
  const embedder = opts.embedder ?? gatewayEmbed;

  const rows: { item: IngestItem; chunk: string }[] = [];
  for (const item of items) {
    for (const c of chunkText(item.text, opts.chunk)) rows.push({ item, chunk: c });
  }
  if (rows.length === 0) return 0;

  let stored = 0;
  try {
    const vectors = await embedder(rows.map((r) => r.chunk));
    if (vectors.length !== rows.length) {
      throw new Error(`embedder returned ${vectors.length} vectors for ${rows.length} chunks`);
    }
    const pool = getPgPool();
    for (let i = 0; i < rows.length; i++) {
      const vec = vectors[i];
      if (vec.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`embedding dim ${vec.length} != expected ${EMBEDDING_DIMENSIONS}`);
      }
      await pool.query(
        `INSERT INTO content_chunks (source, subject, topic, chunk, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          rows[i].item.source,
          rows[i].item.subject ?? null,
          rows[i].item.topic ?? null,
          rows[i].chunk,
          toVectorLiteral(vec),
        ]
      );
      stored++;
    }
    return stored;
  } catch (err) {
    logger.error("[rag] ingestContent failed", { err: String(err), stored });
    return stored;
  }
}

/**
 * Retrieve the chunks most relevant to `query`, ranked by pgvector cosine
 * distance, optionally constrained to a subject/topic. Returns [] if Postgres
 * is down or embedding fails.
 */
export async function retrieve(
  query: string,
  opts: RetrieveOptions = {},
  embedderOverride?: Embedder
): Promise<RetrievedChunk[]> {
  if (!isPgReady() || !query.trim()) return [];
  const embedder = embedderOverride ?? gatewayEmbed;
  const k = Math.max(1, Math.min(opts.k ?? 5, 20));

  try {
    const [vec] = await embedder([query]);
    if (!vec || vec.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`query embedding dim ${vec?.length} != expected ${EMBEDDING_DIMENSIONS}`);
    }

    const conditions: string[] = [];
    const params: unknown[] = [toVectorLiteral(vec)];
    let i = 2;
    if (opts.subject) {
      conditions.push(`lower(subject) = $${i++}`);
      params.push(opts.subject.toLowerCase());
    }
    if (opts.topic) {
      conditions.push(`lower(topic) = $${i++}`);
      params.push(opts.topic.toLowerCase());
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(k);

    const { rows } = await getPgPool().query(
      `SELECT id, source, subject, topic, chunk, (embedding <=> $1::vector) AS distance
       FROM content_chunks
       ${where}
       ORDER BY embedding <=> $1::vector
       LIMIT $${i}`,
      params
    );
    return rows.map((r: any) => ({
      id: r.id,
      source: r.source ?? null,
      subject: r.subject ?? null,
      topic: r.topic ?? null,
      chunk: r.chunk,
      distance: typeof r.distance === "number" ? r.distance : parseFloat(r.distance),
    }));
  } catch (err) {
    logger.error("[rag] retrieve failed", { err: String(err) });
    return [];
  }
}

/** Render retrieved chunks as a context block for injection into a tutor turn. */
export function formatRetrievedContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const body = chunks
    .map((c, idx) => `[${idx + 1}${c.source ? ` · ${c.source}` : ""}] ${c.chunk}`)
    .join("\n\n");
  return `[CURRICULUM CONTEXT — ground your answer in this; if it is insufficient, say so]\n${body}`;
}
