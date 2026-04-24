import { useMediaControls } from "@/hooks/live/useMediaControls";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Users, MessageSquare } from "lucide-react";

interface ControlBarProps {
  onLeave: () => void;
  onToggleChat?: () => void;
  onToggleParticipants?: () => void;
  isChatOpen?: boolean;
  isParticipantsOpen?: boolean;
  isHost?: boolean;
}

export function ControlBar({
  onLeave,
  onToggleChat,
  onToggleParticipants,
  isChatOpen,
  isParticipantsOpen,
  isHost,
}: ControlBarProps) {
  const { isVideoEnabled, isAudioEnabled, toggleVideo, toggleAudio } = useMediaControls();

  return (
    <div className="z-10 flex h-20 w-full shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-950 px-6">
      <div className="flex flex-1 items-center gap-4">
        <span className="hidden text-sm font-medium text-zinc-400 md:inline-block">EduAI Live</span>
      </div>

      <div className="flex flex-1 items-center justify-center gap-4">
        <Button
          variant={isAudioEnabled ? "outline" : "destructive"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleAudio}
        >
          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={isVideoEnabled ? "outline" : "destructive"}
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={toggleVideo}
        >
          {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          className="h-12 rounded-full px-6 font-medium"
          onClick={onLeave}
        >
          <PhoneOff className="mr-2 h-5 w-5" />
          {isHost ? "End Class" : "Leave"}
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <Button
          variant={isParticipantsOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-10 w-10 rounded-full text-zinc-300"
          onClick={onToggleParticipants}
        >
          <Users className="h-5 w-5" />
        </Button>
        <Button
          variant={isChatOpen ? "secondary" : "ghost"}
          size="icon"
          className="h-10 w-10 rounded-full text-zinc-300"
          onClick={onToggleChat}
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
