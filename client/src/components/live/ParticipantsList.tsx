import {
  useParticipantIds,
  useParticipantProperty,
  useLocalSessionId,
} from "@daily-co/daily-react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";

interface ParticipantRowProps {
  id: string;
  isLocal?: boolean;
}

function ParticipantRow({ id, isLocal }: ParticipantRowProps) {
  const name = useParticipantProperty(id, "user_name") || "Guest";
  const isVideoOff = useParticipantProperty(id, "tracks.video.state") !== "playable";
  const isAudioOff = useParticipantProperty(id, "tracks.audio.state") !== "playable";

  return (
    <div className="group flex items-center justify-between rounded-lg px-4 py-2 transition-colors hover:bg-zinc-800/50">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
          {name.charAt(0).toUpperCase()}
        </div>
        <span className="max-w-[120px] truncate text-sm font-medium text-zinc-200">
          {name} {isLocal && <span className="ml-1 text-zinc-500">(You)</span>}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-zinc-500">
        {isAudioOff ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4" />}
        {isVideoOff ? <VideoOff className="h-4 w-4 text-red-400" /> : <Video className="h-4 w-4" />}
      </div>
    </div>
  );
}

export function ParticipantsList() {
  const localSessionId = useLocalSessionId();
  const remoteParticipantIds = useParticipantIds({ filter: "remote" });

  return (
    <div className="flex h-full w-80 shrink-0 flex-col bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 p-4 font-semibold text-white">
        <span>Participants</span>
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
          {remoteParticipantIds.length + (localSessionId ? 1 : 0)}
        </span>
      </div>

      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto bg-zinc-950 p-2">
        {localSessionId && <ParticipantRow id={localSessionId} isLocal={true} />}
        {remoteParticipantIds.map((id) => (
          <ParticipantRow key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
