import React, { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { apiRequest } from "@/lib/queryClient";
import { DailyProvider } from "@daily-co/daily-react";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { Loader2 } from "lucide-react";

import { useClassroom } from "@/hooks/live/useClassroom";
import { VideoGrid } from "@/components/live/VideoGrid";
import { ControlBar } from "@/components/live/ControlBar";
import { ChatPanel } from "@/components/live/ChatPanel";
import { ParticipantsList } from "@/components/live/ParticipantsList";
import { useToast } from "@/hooks/use-toast";

// Inner component that actually uses the DailyProvider context
function ClassroomContent({
  classId,
  onLeaveClass,
}: {
  classId: number;
  onLeaveClass: () => void;
}) {
  const {
    currentUser: { profile },
  } = useFirebaseAuth();
  const { joinRoom, leaveRoom, roomState } = useClassroom();
  const { toast } = useToast();

  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [hasRequestedJoin, setHasRequestedJoin] = useState(false);

  const isTeacher = profile?.role === "teacher" || profile?.role === "admin";

  useEffect(() => {
    async function joinClass() {
      if (hasRequestedJoin || roomState !== "idle") return;
      setHasRequestedJoin(true);

      try {
        const endpoint = isTeacher
          ? `/api/live/join/teacher/${classId}`
          : `/api/live/join/student/${classId}`;
        const res = await apiRequest("POST", endpoint);
        const data = await res.json();

        if (data.roomUrl && data.token) {
          // Keep attendance ID if student
          if (!isTeacher && data.attendanceId) {
            sessionStorage.setItem(`attendance_${classId}`, data.attendanceId);
          }
          await joinRoom(data.roomUrl, data.token);
        } else {
          throw new Error("Missing room credentials");
        }
      } catch (err: any) {
        toast({
          title: "Failed to join class",
          description: err.message || "An error occurred while joining.",
          variant: "destructive",
        });
        onLeaveClass(); // go back
      }
    }

    joinClass();
  }, [classId, isTeacher, joinRoom, hasRequestedJoin, roomState, toast, onLeaveClass]);

  const handleLeave = async () => {
    await leaveRoom();

    if (isTeacher) {
      // Prompt if they want to end the class or just leave
      if (confirm("Do you want to end this class for everyone?")) {
        try {
          await apiRequest("POST", `/api/live/end/${classId}`);
          toast({
            title: "Class Ended",
            description: "The class has been ended and recordings will be processed.",
          });
        } catch (e) {
          console.error("End class error", e);
        }
      }
    } else {
      // Mark student left
      const attendanceId = sessionStorage.getItem(`attendance_${classId}`);
      if (attendanceId) {
        try {
          await apiRequest("POST", `/api/live/leave/student/${attendanceId}`);
          sessionStorage.removeItem(`attendance_${classId}`);
        } catch (e) {}
      }
    }

    onLeaveClass();
  };

  if (roomState === "idle" || roomState === "joining") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
        <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
        <h2 className="text-xl font-semibold">Joining Classroom...</h2>
        <p className="mt-2 text-zinc-500">Connecting to Daily.co</p>
      </div>
    );
  }

  if (roomState === "error" || roomState === "left") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
        <h2 className="mb-4 text-xl font-semibold">You have left the class.</h2>
        <button
          onClick={onLeaveClass}
          className="rounded-lg bg-primary px-6 py-2 font-semibold text-black hover:bg-primary/90"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-black">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Main Video Area */}
        <VideoGrid />

        {/* Bottom Control Bar */}
        <ControlBar
          onLeave={handleLeave}
          onToggleChat={() => {
            setShowChat(!showChat);
            if (!showChat) setShowParticipants(false);
          }}
          onToggleParticipants={() => {
            setShowParticipants(!showParticipants);
            if (!showParticipants) setShowChat(false);
          }}
          isChatOpen={showChat}
          isParticipantsOpen={showParticipants}
          isHost={isTeacher}
        />
      </div>

      {/* Side Panels */}
      {showChat && <ChatPanel />}
      {showParticipants && <ParticipantsList />}
    </div>
  );
}

// Wrapper to initialize Daily provider
export default function LiveClassroomPage() {
  const [, params] = useRoute("/live/:id");
  const [, setLocation] = useLocation();
  const [callObject, setCallObject] = useState<DailyCall | null>(null);

  useEffect(() => {
    const co = DailyIframe.createCallObject();
    setCallObject(co);

    return () => {
      co.destroy();
    };
  }, []);

  if (!params?.id) {
    setLocation("/live-classes");
    return null;
  }

  if (!callObject) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DailyProvider callObject={callObject}>
      <ClassroomContent
        classId={parseInt(params.id)}
        onLeaveClass={() => setLocation("/live-classes")}
      />
    </DailyProvider>
  );
}
