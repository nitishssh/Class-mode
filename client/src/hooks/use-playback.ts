import { useRef, useState, useCallback, useEffect } from "react";
import { PlaybackEngine, EngineMode, PlaybackAction } from "@/lib/playback-engine";

export interface DiscussionState {
  topic: string;
  prompt?: string;
  actionId: string;
}

export function usePlayback() {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const [mode, setMode] = useState<EngineMode>("idle");
  const [progress, setProgress] = useState({ index: 0, total: 0 });
  const [discussion, setDiscussion] = useState<DiscussionState | null>(null);
  const [lastAction, setLastAction] = useState<{ name: string; params: Record<string, any> } | null>(null);

  function getEngine(): PlaybackEngine {
    if (!engineRef.current) {
      engineRef.current = new PlaybackEngine();
    }
    return engineRef.current;
  }

  useEffect(() => {
    const engine = getEngine();
    const offs = [
      engine.on("modeChange", setMode),
      engine.on("progressChange", setProgress),
      engine.on("actionFire", (a) => setLastAction({ ...a })),
      engine.on("discussionPrompt", (d) => setDiscussion(d)),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  const start = useCallback((actions: PlaybackAction[]) => {
    getEngine().start(actions);
  }, []);

  const pause = useCallback(() => getEngine().pause(), []);
  const resume = useCallback(() => getEngine().resume(), []);
  const stop = useCallback(() => {
    getEngine().stop();
    setDiscussion(null);
  }, []);

  const confirmDiscussion = useCallback(() => {
    setDiscussion(null);
    getEngine().confirmDiscussion();
  }, []);

  const skipDiscussion = useCallback(() => {
    setDiscussion(null);
    getEngine().skipDiscussion();
  }, []);

  const skip = useCallback(() => getEngine().skip(), []);

  const handleUserInterrupt = useCallback(() => {
    getEngine().handleUserInterrupt();
  }, []);

  const handleEndDiscussion = useCallback(() => {
    getEngine().handleEndDiscussion();
  }, []);

  return {
    mode,
    progress,
    discussion,
    lastAction,
    start,
    pause,
    resume,
    stop,
    skip,
    confirmDiscussion,
    skipDiscussion,
    handleUserInterrupt,
    handleEndDiscussion,
  };
}
