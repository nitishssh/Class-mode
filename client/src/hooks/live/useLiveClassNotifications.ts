/**
 * client/src/hooks/live/useLiveClassNotifications.ts
 *
 * Uses the shared WebSocket connection to listen for `live_class_event`
 * messages broadcast by the server and shows toast notifications.
 *
 * Usage: Call this hook once inside AppLayout so all authenticated pages
 * receive live class notifications.
 */

import { useCallback, useRef } from "react";
import { useChatWs, ChatWsEvent } from "@/hooks/use-chat-ws";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useLiveClassNotifications() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // Track classes already toasted to avoid duplicate notifications on WS reconnect
  const toastedClasses = useRef<Set<number>>(new Set());

  const onEvent = useCallback(
    (event: ChatWsEvent) => {
      if (event.type !== "live_class_event") return;

      const { action, classId, triggeredBy } = event;

      if (action === "started" && classId) {
        if (toastedClasses.current.has(classId)) return;
        toastedClasses.current.add(classId);

        const teacherName = triggeredBy?.displayName ?? "Your teacher";
        toast({
          title: "🔴 Live Class Started!",
          description: `${teacherName} started a live class. Click "Join Now" to enter.`,
          duration: 10000,
          // We use the description with a call to action text since
          // toast action requires a ToastAction component (shadcn).
          // Users can navigate to /live-classes to join.
        });

        // Auto-navigate students to the classroom after a brief delay so
        // they see the toast first.
        setTimeout(() => {
          navigate(`/live/${classId}`);
        }, 1500);
      }

      if (action === "ended" && classId) {
        toastedClasses.current.delete(classId);
        toast({
          title: "Class Ended",
          description: "The live class has been ended by the teacher.",
          duration: 4000,
        });
      }
    },
    [toast, navigate]
  );

  // Passive WebSocket listener — no channel needed
  useChatWs({ onEvent });
}
