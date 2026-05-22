import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SkipForward, Play } from "lucide-react";

interface VideoPlayerProps {
  src?: string;
  elementId?: string;
  onEnd: () => void;
  onSkip: () => void;
}

export function VideoPlayer({ src, onEnd, onSkip }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {});
  }, []);

  return (
    <motion.div
      key="video-player"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl bg-black">
        {src ? (
          <video
            ref={videoRef}
            src={src}
            controls
            className="w-full aspect-video"
            onEnded={onEnd}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-slate-400 text-sm gap-2">
            <Play className="h-8 w-8 opacity-40" />
            <span>Video unavailable</span>
          </div>
        )}
        <div className="flex justify-end gap-2 p-3 bg-slate-900">
          <Button size="sm" variant="outline" onClick={onSkip} className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-700">
            <SkipForward className="h-4 w-4" />
            Skip
          </Button>
          <Button size="sm" onClick={onEnd} className="bg-indigo-600 hover:bg-indigo-700">
            Continue
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
