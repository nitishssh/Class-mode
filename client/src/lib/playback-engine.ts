/**
 * PlaybackEngine — state machine for AI classroom lesson playback.
 *
 * States: idle → playing → paused → live
 *
 * Mirrors OpenMAIC's lib/playback/engine.ts, adapted for this stack.
 * - speech actions → SpeechSynthesisQueue (browser) or fetch+Audio (server TTS)
 * - spotlight/laser → fire-and-forget via queueMicrotask
 * - discussion → engine pauses, emits onDiscussion, resumes via confirm/skip
 * - play_video → engine pauses, emits videoPlay, resumes via confirmVideo
 * - wb_* / widget_* → synchronous via onAction callback
 */

import mitt, { Emitter } from "mitt";
import { SpeechSynthesisQueue, SpeechOptions } from "./speech-synthesis-queue";

export type EngineMode = "idle" | "playing" | "paused" | "live";

export interface PlaybackAction {
  type?: "action" | "text";
  name?: string;
  content?: string;
  params?: Record<string, any>;
  actionId?: string;
}

export interface EngineSnapshot {
  currentIndex: number;
  mode: EngineMode;
  consumedDiscussions: string[];
}

export type EngineEvents = {
  modeChange: EngineMode;
  actionFire: { name: string; params: Record<string, any> };
  speechStart: { text: string };
  speechEnd: undefined;
  discussionPrompt: { topic: string; prompt?: string; actionId: string };
  videoPlay: { elementId?: string; src?: string };
  progressChange: { index: number; total: number };
  sceneComplete: undefined;
  error: string;
  [key: string]: unknown;
};

export class PlaybackEngine {
  private mode: EngineMode = "idle";
  private actions: PlaybackAction[] = [];
  private currentIndex = 0;
  private tts: SpeechSynthesisQueue;
  private consumedDiscussions = new Set<string>();
  private emitter: Emitter<EngineEvents>;
  private resolveDiscussion: (() => void) | null = null;
  private resolveVideo: (() => void) | null = null;
  private audioMode: "browser" | "server" = "browser";
  private currentAudio: HTMLAudioElement | null = null;

  constructor() {
    this.tts = new SpeechSynthesisQueue();
    this.emitter = mitt<EngineEvents>();
  }

  on<K extends keyof EngineEvents>(event: K, handler: (data: EngineEvents[K]) => void) {
    this.emitter.on(event, handler as any);
    return () => this.emitter.off(event, handler as any);
  }

  getMode(): EngineMode {
    return this.mode;
  }

  getProgress() {
    return { index: this.currentIndex, total: this.actions.length };
  }

  getSnapshot(): EngineSnapshot {
    return {
      currentIndex: this.currentIndex,
      mode: this.mode,
      consumedDiscussions: [...this.consumedDiscussions],
    };
  }

  restoreFromSnapshot(snap: EngineSnapshot) {
    this.tts.cancel();
    this.currentIndex = snap.currentIndex;
    this.consumedDiscussions = new Set(snap.consumedDiscussions);
    this.setMode(snap.mode);
  }

  setTTSMode(mode: "browser" | "server") {
    this.audioMode = mode;
  }

  load(actions: PlaybackAction[]) {
    this.actions = actions;
    this.currentIndex = 0;
  }

  start(actions?: PlaybackAction[]) {
    if (actions) this.load(actions);
    this.currentIndex = 0;
    this.consumedDiscussions.clear();
    this.setMode("playing");
    this.processNext();
  }

  continuePlayback() {
    if (this.mode === "idle") {
      this.setMode("playing");
      this.processNext();
    }
  }

  pause() {
    if (this.mode === "playing" || this.mode === "live") {
      this.setMode("paused");
      if (this.audioMode === "server") {
        this.currentAudio?.pause();
      } else {
        this.tts.pause();
      }
    }
  }

  resume() {
    if (this.mode === "paused") {
      this.setMode("playing");
      if (this.audioMode === "server" && this.currentAudio) {
        this.currentAudio.play().catch(() => {});
      } else {
        this.tts.resume();
      }
      this.processNext();
    }
  }

  stop() {
    this.tts.cancel();
    this._stopAudio();
    this.resolveDiscussion?.();
    this.resolveDiscussion = null;
    this.resolveVideo?.();
    this.resolveVideo = null;
    this.setMode("idle");
    this.currentIndex = 0;
  }

  confirmDiscussion() {
    if (this.resolveDiscussion) {
      this.resolveDiscussion();
      this.resolveDiscussion = null;
    }
    this.setMode("live");
  }

  skipDiscussion() {
    if (this.resolveDiscussion) {
      this.resolveDiscussion();
      this.resolveDiscussion = null;
    }
    this.setMode("playing");
    this.processNext();
  }

  confirmVideo() {
    if (this.resolveVideo) {
      this.resolveVideo();
      this.resolveVideo = null;
    }
  }

  skip() {
    if (this.mode === "idle") return;
    this.tts.cancel();
    this._stopAudio();
    if (this.resolveDiscussion) {
      this.resolveDiscussion();
      this.resolveDiscussion = null;
      this.setMode("playing");
      this.processNext();
    } else if (this.resolveVideo) {
      this.resolveVideo();
      this.resolveVideo = null;
      this.setMode("playing");
      this.processNext();
    }
    // In "playing" mode, tts.cancel() resolves the pending speak() promise
    // so the async processNext() chain continues automatically.
  }

  handleEndDiscussion() {
    this.setMode("idle");
  }

  handleUserInterrupt() {
    this.setMode("live");
    this.tts.cancel();
    this._stopAudio();
  }

  private _stopAudio() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
      this.currentAudio = null;
    }
  }

  private setMode(mode: EngineMode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.emitter.emit("modeChange", mode);
    }
  }

  private async _speakServer(text: string, voice?: string, speed?: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const audio = new Audio();
      this.currentAudio = audio;

      fetch("/api/ai-classroom/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, speed }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("TTS fetch failed");
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          audio.src = url;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            this.currentAudio = null;
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            this.currentAudio = null;
            resolve();
          };
          audio.play().catch(() => resolve());
        })
        .catch(() => resolve()); // fall through on error
    });
  }

  private async processNext(): Promise<void> {
    if (this.mode !== "playing") return;
    if (this.currentIndex >= this.actions.length) {
      this.setMode("idle");
      this.emitter.emit("sceneComplete", undefined);
      return;
    }

    const action = this.actions[this.currentIndex];
    this.currentIndex++;
    this.emitter.emit("progressChange", { index: this.currentIndex, total: this.actions.length });

    if (action.type === "text" || action.name === "speech") {
      const text = action.content || action.params?.text || "";
      if (!text) return this.processNext();
      this.emitter.emit("speechStart", { text });

      if (this.audioMode === "server") {
        await this._speakServer(text, action.params?.voice, action.params?.speed);
      } else {
        const opts: SpeechOptions = {
          voice: action.params?.voice,
          rate: action.params?.speed ?? 1.0,
        };
        await this.tts.speak(text, opts);
      }
      (this.emitter.emit as any)("speechEnd", undefined);
      return this.processNext();
    }

    const name = action.name || "";
    const params = action.params || {};

    if (name === "spotlight" || name === "laser") {
      queueMicrotask(() => this.emitter.emit("actionFire", { name, params }));
      return this.processNext();
    }

    if (name === "discussion") {
      const actionId = action.actionId || `disc-${this.currentIndex}`;
      if (this.consumedDiscussions.has(actionId)) {
        return this.processNext();
      }
      this.consumedDiscussions.add(actionId);
      await new Promise<void>((resolve) => {
        this.resolveDiscussion = resolve;
        this.emitter.emit("discussionPrompt", {
          topic: params.topic || "Discussion",
          prompt: params.prompt,
          actionId,
        });
        this.setMode("paused");
      });
      return;
    }

    if (name === "play_video") {
      await new Promise<void>((resolve) => {
        this.resolveVideo = resolve;
        this.emitter.emit("videoPlay", { elementId: params.elementId, src: params.src });
      });
      return this.processNext();
    }

    this.emitter.emit("actionFire", { name, params });
    const delay = name.startsWith("widget_") ? 500 : 80;
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    return this.processNext();
  }
}
