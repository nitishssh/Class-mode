/**
 * Text chunking for RAG ingest. Splits source material into overlapping,
 * roughly-sentence-aligned windows so each embedded chunk is self-contained but
 * neighbouring chunks share context (overlap reduces boundary loss at retrieval).
 * Pure and dependency-free — the unit-testable core of the ingest pipeline.
 */

export interface ChunkOptions {
  /** Target chunk size in words. */
  maxWords?: number;
  /** Words of overlap carried between consecutive chunks. */
  overlapWords?: number;
}

const DEFAULT_MAX_WORDS = 180;
const DEFAULT_OVERLAP_WORDS = 30;

/** Split text into sentences (keeps terminal punctuation). */
function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const wordCount = (s: string): number => (s ? s.split(/\s+/).length : 0);

/**
 * Chunk `text` into overlapping windows of ~`maxWords` words, packing whole
 * sentences and carrying `overlapWords` of trailing context into the next
 * chunk. Returns trimmed, non-empty chunks in document order.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxWords = Math.max(20, opts.maxWords ?? DEFAULT_MAX_WORDS);
  const overlapWords = Math.max(0, Math.min(opts.overlapWords ?? DEFAULT_OVERLAP_WORDS, maxWords - 1));

  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const sentence of sentences) {
    const sw = wordCount(sentence);
    // A single oversized sentence becomes its own chunk.
    if (sw >= maxWords) {
      if (current.length) {
        chunks.push(current.join(" "));
        current = [];
        currentWords = 0;
      }
      chunks.push(sentence);
      continue;
    }
    if (currentWords + sw > maxWords && current.length) {
      chunks.push(current.join(" "));
      // Carry the trailing overlap into the next chunk.
      const overlap: string[] = [];
      let ow = 0;
      for (let i = current.length - 1; i >= 0 && ow < overlapWords; i--) {
        overlap.unshift(current[i]);
        ow += wordCount(current[i]);
      }
      current = [...overlap];
      currentWords = ow;
    }
    current.push(sentence);
    currentWords += sw;
  }
  if (current.length) chunks.push(current.join(" "));

  return chunks.map((c) => c.trim()).filter(Boolean);
}
