/**
 * PlaybackEngine — state machine for AI classroom lesson playback.
 *
 * States: idle → playing → paused → live
 *
 * Mirrors OpenMAIC's lib/playback/engine.ts, adapted for this stack.
 * - speech actions → SpeechSynthesisQueue (sentence-chunked, Chrome 15s fix)
 * - spotlight/laser → fire-and-forget via queueMicrotask
 * - discussion → engine pauses, emits onDiscussion, resumes via confirm/skip
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

export type EngineEvents = {
  modeChange: EngineMode;
  actionFire: { name: string; params: Record<string, any> };
  speechStart: { text: string };
  speechEnd: undefined;
  discussionPrompt: { topic: string; prompt?: string; actionId: string };
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
      this.tts.pause();
    }
  }

  resume() {
    if (this.mode === "paused") {
      this.setMode("playing");
      this.tts.resume();
      this.processNext();
    }
  }

  stop() {
    this.tts.cancel();
    this.resolveDiscussion?.();
    this.resolveDiscussion = null;
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

  skip() {
    if (this.mode === "idle") return;
    this.tts.cancel();
    if (this.resolveDiscussion) {
      this.resolveDiscussion();
      this.resolveDiscussion = null;
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
  }

  private setMode(mode: EngineMode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.emitter.emit("modeChange", mode);
    }
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
      const opts: SpeechOptions = {
        voice: action.params?.voice,
        rate: action.params?.speed ?? 1.0,
      };
      await this.tts.speak(text, opts);
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

    this.emitter.emit("actionFire", { name, params });
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    return this.processNext();
  }
}
