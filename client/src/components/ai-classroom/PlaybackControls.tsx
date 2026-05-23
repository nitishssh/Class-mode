import React from "react";
import { Play, Pause, Square, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { EngineMode } from "@/lib/playback-engine";

interface PlaybackControlsProps {
  mode: EngineMode;
  progress: { index: number; total: number };
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkip?: () => void;
  className?: string;
}

export function PlaybackControls({
  mode,
  progress,
  onPlay,
  onPause,
  onStop,
  onSkip,
  className,
}: PlaybackControlsProps) {
  const pct = progress.total > 0 ? Math.round((progress.index / progress.total) * 100) : 0;
  const isPlaying = mode === "playing";
  const isLive = mode === "live";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isPlaying ? (
        <Button size="sm" variant="outline" onClick={onPause} title="Pause">
          <Pause className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant={mode === "idle" ? "default" : "outline"}
          onClick={onPlay}
          disabled={isLive}
          title="Play"
        >
          <Play className="h-4 w-4" />
        </Button>
      )}

      <Button size="sm" variant="ghost" onClick={onStop} title="Stop" disabled={mode === "idle"}>
        <Square className="h-4 w-4" />
      </Button>

      {onSkip && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onSkip}
          title="Skip action"
          disabled={mode === "idle"}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Progress value={pct} className="h-1.5 flex-1" />
        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
          {progress.index}/{progress.total}
        </span>
      </div>

      {mode !== "idle" && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
          {mode}
        </span>
      )}
    </div>
  );
}
