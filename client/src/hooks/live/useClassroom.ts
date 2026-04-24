import { useCallback, useState } from "react";
import { useDaily, useDailyEvent, useLocalSessionId } from "@daily-co/daily-react";
import { useToast } from "@/hooks/use-toast";

export function useClassroom() {
  const daily = useDaily();
  const localSessionId = useLocalSessionId();
  const { toast } = useToast();
  const [roomState, setRoomState] = useState<"idle" | "joining" | "joined" | "error" | "left">(
    "idle"
  );

  useDailyEvent(
    "joined-meeting",
    useCallback(() => {
      setRoomState("joined");
    }, [])
  );

  useDailyEvent(
    "left-meeting",
    useCallback(() => {
      setRoomState("left");
    }, [])
  );

  useDailyEvent(
    "error",
    useCallback(
      (e) => {
        setRoomState("error");
        toast({
          title: "Classroom Error",
          description: e.errorMsg || "An unexpected error occurred.",
          variant: "destructive",
        });
      },
      [toast]
    )
  );

  useDailyEvent(
    "network-connection",
    useCallback(
      (e) => {
        if (e.event === "offline") {
          toast({
            title: "Network Connection Lost",
            description: "You are currently offline. Please wait as we try to reconnect you.",
            variant: "destructive",
          });
        }
      },
      [toast]
    )
  );

  const joinRoom = useCallback(
    async (url: string, token?: string) => {
      if (!daily || roomState === "joining" || roomState === "joined") return;

      setRoomState("joining");
      try {
        await daily.join({ url, token });
      } catch (e: any) {
        setRoomState("error");
        console.error("Failed to join Daily room:", e);
      }
    },
    [daily, roomState]
  );

  const leaveRoom = useCallback(async () => {
    if (!daily) return;
    await daily.leave();
  }, [daily]);

  return {
    daily,
    localSessionId,
    roomState,
    joinRoom,
    leaveRoom,
  };
}
