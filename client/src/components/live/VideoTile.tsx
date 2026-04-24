import { useVideoTrack, useAudioTrack, useParticipantProperty } from "@daily-co/daily-react";
import { useEffect, useRef } from "react";
import { MicOff, User } from "lucide-react";
import { Card } from "@/components/ui/card";

interface VideoTileProps {
  id: string;
  isLocal?: boolean;
}

export function VideoTile({ id, isLocal }: VideoTileProps) {
  const videoState = useVideoTrack(id);
  const audioState = useAudioTrack(id);

  const isMicMuted = useParticipantProperty(id, "tracks.audio.state") !== "playable";
  const username = useParticipantProperty(id, "user_name") || "Guest";

  const videoElement = useRef<HTMLVideoElement>(null);
  const audioElement = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (videoElement.current && videoState.persistentTrack) {
      videoElement.current.srcObject = new MediaStream([videoState.persistentTrack]);
    }
  }, [videoState.persistentTrack]);

  useEffect(() => {
    if (audioElement.current && audioState.persistentTrack && !isLocal) {
      audioElement.current.srcObject = new MediaStream([audioState.persistentTrack]);
    }
  }, [audioState.persistentTrack, isLocal]);

  const isVideoOff = videoState.state !== "playable";

  return (
    <Card className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border-zinc-800 bg-zinc-900 shadow-xl">
      {isVideoOff ? (
        <div className="flex flex-col items-center justify-center text-zinc-500">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800">
            <User className="h-10 w-10" />
          </div>
          <span className="font-medium">{username}</span>
        </div>
      ) : (
        <video
          autoPlay
          muted={isLocal}
          playsInline
          ref={videoElement}
          className={`h-full w-full object-cover ${isLocal ? "scale-x-[-1]" : ""}`}
        />
      )}

      {!isLocal && <audio autoPlay playsInline ref={audioElement} />}

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">
          {username}
        </div>
        {isMicMuted && (
          <div className="rounded-lg bg-red-500/80 p-1.5 text-white backdrop-blur-md">
            <MicOff className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );
}
