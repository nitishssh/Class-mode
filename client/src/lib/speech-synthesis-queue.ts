/**
 * SpeechSynthesisQueue — sentence-chunked browser TTS.
 *
 * Chrome silently cuts off utterances longer than ~15 seconds.
 * We split text at sentence boundaries and queue individual utterances.
 * Pause/resume uses cancel+re-speak to remain Firefox-compatible.
 */

const SENTENCE_RE = /[^.!?。！？\n]+[.!?。！？\n]*/g;

function splitSentences(text: string): string[] {
  const raw = text.match(SENTENCE_RE) || [text];
  const chunks: string[] = [];
  let current = "";
  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (current.length + trimmed.length > 400) {
      if (current) chunks.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, 400)];
}

export interface SpeechOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  lang?: string;
}

type SpeechEntry = { chunks: string[]; options: SpeechOptions; resolve: () => void };

export class SpeechSynthesisQueue {
  private queue: SpeechEntry[] = [];
  private playing = false;
  private paused = false;
  private currentEntry: SpeechEntry | null = null;
  private currentChunkIndex = 0;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  speak(text: string, options: SpeechOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      const chunks = splitSentences(text);
      this.queue.push({ chunks, options, resolve });
      if (!this.playing && !this.paused) this.playNext();
    });
  }

  private playNext() {
    if (this.paused || this.queue.length === 0) {
      this.playing = false;
      return;
    }

    this.playing = true;
    this.currentEntry = this.queue[0];
    this.currentChunkIndex = 0;
    this.playChunk();
  }

  private playChunk() {
    const entry = this.currentEntry;
    if (!entry || this.paused) return;

    if (this.currentChunkIndex >= entry.chunks.length) {
      entry.resolve();
      this.queue.shift();
      this.currentEntry = null;
      this.playNext();
      return;
    }

    const chunk = entry.chunks[this.currentChunkIndex];
    const utt = new SpeechSynthesisUtterance(chunk);

    if (entry.options.rate != null) utt.rate = entry.options.rate;
    if (entry.options.pitch != null) utt.pitch = entry.options.pitch;
    if (entry.options.lang) utt.lang = entry.options.lang;

    if (entry.options.voice) {
      const voices = speechSynthesis.getVoices();
      const match = voices.find(
        (v) =>
          v.name === entry.options.voice ||
          v.name.toLowerCase().includes((entry.options.voice ?? "").toLowerCase())
      );
      if (match) utt.voice = match;
    }

    utt.onend = () => {
      this.currentChunkIndex++;
      this.playChunk();
    };
    utt.onerror = () => {
      this.currentChunkIndex++;
      this.playChunk();
    };

    this.currentUtterance = utt;
    speechSynthesis.speak(utt);
  }

  pause() {
    if (!this.paused && this.playing) {
      this.paused = true;
      speechSynthesis.cancel();
    }
  }

  resume() {
    if (this.paused) {
      this.paused = false;
      if (this.currentEntry) {
        this.playChunk();
      } else {
        this.playNext();
      }
    }
  }

  cancel() {
    speechSynthesis.cancel();
    this.playing = false;
    this.paused = false;
    for (const entry of this.queue) entry.resolve();
    this.queue = [];
    this.currentEntry = null;
    this.currentChunkIndex = 0;
    this.currentUtterance = null;
  }

  get isPlaying() {
    return this.playing && !this.paused;
  }
}
