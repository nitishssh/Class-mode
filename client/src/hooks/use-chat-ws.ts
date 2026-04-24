/**
 * client/src/hooks/use-chat-ws.ts  — Phase 5.2
 *
 * React hook that manages a WebSocket connection to /ws/chat.
 *
 * Features:
 *  - Authenticates with Firebase ID token via ?token= query param
 *  - Joins/leaves channels as the active conversation changes
 *  - Dispatches real-time events: new_message, user_typing, user_presence,
 *    message_read, message_delivered, doubt_answered, message_pinned,
 *    unread_updated
 *  - Exposes sendMessage, sendTyping, stopTyping, markRead, markDelivered
 *  - Reconnects automatically with exponential backoff (max 30s)
 */

import { useEffect, useRef, useCallback, useReducer } from "react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { Message } from "@/types/chat";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WsStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

export interface ChatWsEvent {
  type: string;
  channelId?: number;
  message?: any;
  messageId?: number;
  userId?: number;
  firebaseUid?: string;
  displayName?: string;
  status?: string;
  delta?: number;
  answeredBy?: { userId: number; firebaseUid: string; displayName: string };
  pinnedBy?: { userId: number; firebaseUid: string; displayName: string };
  // Live class events
  classId?: number;
  action?: "started" | "ended";
  triggeredBy?: { userId: number; displayName: string };
}

interface WsState {
  status: WsStatus;
  connectedUserId: number | null;
}

type WsAction =
  | { type: "connecting" }
  | { type: "connected"; userId: number }
  | { type: "reconnecting" }
  | { type: "error" }
  | { type: "disconnected" };

function wsReducer(state: WsState, action: WsAction): WsState {
  switch (action.type) {
    case "connecting":
      return { ...state, status: "connecting" };
    case "connected":
      return { status: "connected", connectedUserId: action.userId };
    case "reconnecting":
      return { ...state, status: "reconnecting" };
    case "error":
      return { ...state, status: "error" };
    case "disconnected":
      return { status: "idle", connectedUserId: null };
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseChatWsOptions {
  /** Called whenever a server event arrives (new_message, typing, etc.) */
  onEvent: (event: ChatWsEvent) => void;
  /** Channel to join immediately after connecting */
  activeChannelId?: number;
}

export function useChatWs({ onEvent, activeChannelId }: UseChatWsOptions) {
  const { currentUser } = useFirebaseAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const pendingQueue = useRef<object[]>([]);
  const onEventRef = useRef(onEvent);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelay = useRef(1000);
  const isMounted = useRef(true);
  const activeChannelRef = useRef<number | undefined>(activeChannelId);

  const [state, dispatch] = useReducer(wsReducer, {
    status: "idle",
    connectedUserId: null,
  });

  // Keep onEvent callback ref fresh
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    activeChannelRef.current = activeChannelId;
  }, [activeChannelId]);

  // ── Send helper ─────────────────────────────────────────────────────────────
  const sendRaw = useCallback(
    (data: object) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        return true;
      }
      // Buffer if not connected
      if (state.status !== "idle") {
        pendingQueue.current.push(data);
      }
      return false;
    },
    [state.status]
  );

  // ── Connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    if (!isMounted.current) return;

    const fbUser = currentUser.user;
    const isConnected = wsRef.current?.readyState === WebSocket.OPEN;
    if (!fbUser || isConnected) return;

    dispatch({ type: "connecting" });

    let token = "";
    try {
      token = await fbUser.getIdToken();
    } catch {
      console.warn(
        "[use-chat-ws] Could not get Firebase ID token — connecting without token (session fallback)"
      );
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // Construct host properly handling cases where port isn't explicitly defined in window.location.host
    const host = window.location.port
      ? `${window.location.hostname}:${window.location.port}`
      : window.location.hostname;
    const url = `${protocol}//${host}/ws/chat${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMounted.current) return ws.close();
      console.log("[use-chat-ws] Connected");
      reconnectDelay.current = 1000; // reset backoff
    };

    ws.onmessage = (ev) => {
      try {
        const event: ChatWsEvent = JSON.parse(ev.data);

        if (event.type === "connected") {
          dispatch({ type: "connected", userId: event.userId ?? 0 });
          // Join channel if one is already active
          if (activeChannelRef.current) {
            sendRaw({ type: "join_channel", channelId: activeChannelRef.current });
          }
          // Flush pending messages
          while (pendingQueue.current.length > 0) {
            const msg = pendingQueue.current.shift();
            if (msg) sendRaw(msg);
          }
        }

        onEventRef.current(event);
      } catch {
        console.error("[use-chat-ws] Failed to parse event");
      }
    };

    ws.onerror = () => {
      dispatch({ type: "error" });
    };

    ws.onclose = () => {
      if (!isMounted.current) return;
      dispatch({ type: "disconnected" });
      scheduleReconnect();
    };
  }, [currentUser.user, sendRaw]);

  // ── Reconnect with exponential backoff ──────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (!isMounted.current) return;
    dispatch({ type: "reconnecting" });

    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    const delay = Math.min(reconnectDelay.current, 30000);
    reconnectDelay.current = delay * 2;

    console.log(`[use-chat-ws] Reconnecting in ${delay}ms`);
    reconnectTimeout.current = setTimeout(() => {
      if (isMounted.current) connect();
    }, delay);
  }, [connect]);

  // ── Connect on mount / Firebase user change ─────────────────────────────────
  useEffect(() => {
    if (currentUser.user) connect();
  }, [currentUser.user, connect]);

  // ── Switch channels on activeChannelId change ───────────────────────────────
  useEffect(() => {
    if (state.status !== "connected") return;

    const join = () => {
      if (activeChannelId) sendRaw({ type: "join_channel", channelId: activeChannelId });
    };
    join();

    return () => {
      // Leave channel on cleanup (conversation switch)
      if (activeChannelId) {
        sendRaw({ type: "leave_channel", channelId: activeChannelId });
        sendRaw({ type: "stop_typing", channelId: activeChannelId });
      }
    };
  }, [activeChannelId, state.status, sendRaw]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, []);

  // ─── Public API ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    (
      channelId: number,
      content: string,
      options?: {
        messageType?: string;
        fileUrl?: string;
        senderRole?: string;
        replyTo?: number;
        mentions?: string[];
      }
    ) => {
      return sendRaw({
        type: "send_message",
        channelId,
        content,
        messageType: options?.messageType || "text",
        ...(options?.fileUrl && { fileUrl: options.fileUrl }),
        ...(options?.senderRole && { senderRole: options.senderRole }),
        ...(options?.replyTo && { replyTo: options.replyTo }),
        ...(options?.mentions?.length && { mentions: options.mentions }),
      });
    },
    [sendRaw]
  );

  const sendTyping = useCallback(
    (channelId: number) => {
      return sendRaw({ type: "typing", channelId });
    },
    [sendRaw]
  );

  const stopTyping = useCallback(
    (channelId: number) => {
      return sendRaw({ type: "stop_typing", channelId });
    },
    [sendRaw]
  );

  const markRead = useCallback(
    (channelId: number, messageId: number) => {
      return sendRaw({ type: "mark_read", channelId, messageId });
    },
    [sendRaw]
  );

  const markDelivered = useCallback(
    (channelId: number, messageId: number) => {
      return sendRaw({ type: "mark_delivered", channelId, messageId });
    },
    [sendRaw]
  );

  const answerDoubt = useCallback(
    (channelId: number, messageId: number) => {
      return sendRaw({ type: "answer_doubt", channelId, messageId });
    },
    [sendRaw]
  );

  const pinMessage = useCallback(
    (channelId: number, messageId: number) => {
      return sendRaw({ type: "pin_message", channelId, messageId });
    },
    [sendRaw]
  );

  return {
    status: state.status,
    connectedUserId: state.connectedUserId,
    isConnected: state.status === "connected",
    sendMessage,
    sendTyping,
    stopTyping,
    markRead,
    markDelivered,
    answerDoubt,
    pinMessage,
  };
}
