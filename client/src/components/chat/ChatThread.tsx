import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Conversation, Message, ServerMessage } from "@/types/chat";
import { mockMessages, users as allUsers } from "@/data/mockData";
import { useRole } from "@/contexts/chat-role-context";
import { useChatWs, ChatWsEvent } from "@/hooks/use-chat-ws";
import { fetchMessages } from "@/lib/chat-api";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import ChatHeader from "./ChatHeader";
import { format, isToday, isYesterday } from "date-fns";

interface ChatThreadProps {
  conversation: Conversation;
  onBack?: () => void;
}

function getDayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

// The WS new_message payload uses `messageType` while the API uses `type`.
// This function handles both shapes.
function toUIMessage(
  srv: ServerMessage | (Omit<ServerMessage, "type"> & { messageType?: string }),
  conversationId: string
): Message {
  const msgType =
    "type" in srv ? (srv as ServerMessage).type : (srv as { messageType?: string }).messageType;
  return {
    id: String(srv.id),
    conversationId,
    senderId: String(srv.authorId),
    senderRole: "student",
    type: msgType === "image" ? "image" : "text",
    content: srv.content,
    status: "read",
    timestamp: new Date(srv.createdAt),
    deliveredTo: [],
    readBy: srv.readBy.map(String),
    mediaUrl: srv.fileUrl ?? undefined,
  };
}

const ChatThread = ({ conversation, onBack }: ChatThreadProps) => {
  const { currentUser } = useRole();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Numeric channel id (for server calls) ──────────────────────────────────
  const numericId = Number(conversation.id);
  const isServerChannel = !isNaN(numericId) && numericId > 0;

  // ── Typing users ───────────────────────────────────────────────────────────
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});

  // ── Optimistic messages appended via WS before server confirms ────────────
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);

  // ── Oldest ID for infinite-scroll pagination ───────────────────────────────
  const [oldestId, setOldestId] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  const { sendMessage, sendTyping, markRead } = useChatWs({
    activeChannelId: isServerChannel ? numericId : undefined,

    onEvent: useCallback(
      (event: ChatWsEvent) => {
        switch (event.type) {
          case "new_message": {
            if (!event.message) break;
            const uiMsg = toUIMessage(event.message, conversation.id);
            // Deduplicate: if we already have it as opt. message, replace it
            setOptimisticMessages((prev) =>
              prev.map((m) =>
                m.content === uiMsg.content && m.senderId === uiMsg.senderId ? uiMsg : m
              )
            );
            // Also invalidate the React Query cache so a refetch has fresh data
            qc.invalidateQueries({ queryKey: ["messages", numericId] });
            break;
          }
          case "user_typing": {
            if (!event.userId || !event.displayName) break;
            const uId = event.userId;
            setTypingUsers((prev) => ({ ...prev, [uId]: event.displayName! }));
            // Clear typing for this user after 3 s of silence
            setTimeout(() => {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[uId];
                return next;
              });
            }, 3000);
            break;
          }
          case "message_read": {
            if (!event.messageId || !event.userId) break;
            qc.setQueryData<Message[]>(["messages", numericId], (old) =>
              old?.map((m) =>
                m.id === String(event.messageId)
                  ? { ...m, readBy: [...(m.readBy ?? []), String(event.userId)] }
                  : m
              )
            );
            break;
          }
        }
      },
      [conversation.id, numericId, qc]
    ),
  } as any);

  // ── React Query: initial 50 messages ──────────────────────────────────────
  const { data: serverMessages, isLoading } = useQuery<Message[]>({
    queryKey: ["messages", numericId],
    queryFn: async () => {
      const raw = await fetchMessages(numericId, 50);
      return raw.map((m: any) => toUIMessage(m, conversation.id));
    },
    enabled: isServerChannel,
    staleTime: 0,
  });

  // Effect to update oldestId based on new serverMessages fetch
  useEffect(() => {
    if (serverMessages && serverMessages.length > 0) {
      setOldestId(Number(serverMessages[0].id));
      setHasMore(serverMessages.length === 50);
    }
  }, [serverMessages]);

  // ── Fall back to mock if not a real server channel (empty list = dev mode) ──
  const [messages, setMessages] = useState<Message[]>(() =>
    isServerChannel ? [] : mockMessages[conversation.id] || []
  );

  // Sync server messages + optimistic appends into single list
  useEffect(() => {
    if (!isServerChannel) return;
    const base = serverMessages ?? [];
    const optIds = new Set(base.map((m) => m.id));
    const newOpts = optimisticMessages.filter((m) => !optIds.has(m.id));
    setMessages([...base, ...newOpts]);
  }, [serverMessages, optimisticMessages, isServerChannel]);

  // Update mock messages when conversation changes (mock mode only)
  useEffect(() => {
    if (!isServerChannel) {
      setMessages(mockMessages[conversation.id] || []);
    }
    // Reset pagination state
    setOldestId(undefined);
    setHasMore(true);
    setOptimisticMessages([]);
  }, [conversation.id, isServerChannel]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Infinite scroll: load older messages ─────────────────────────────────
  useEffect(() => {
    if (!isServerChannel || !hasMore) return;
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting || oldestId == null) return;
        const older: any[] = await fetchMessages(numericId, 50, oldestId);
        if (older.length === 0) {
          setHasMore(false);
          return;
        }
        setHasMore(older.length === 50);
        const oldestFetched = older[0].id;
        if (oldestFetched != null) setOldestId(Number(oldestFetched));

        const uiOlder = older.map((m: any) => toUIMessage(m, conversation.id));
        qc.setQueryData<Message[]>(["messages", numericId], (prev) => [
          ...uiOlder,
          ...(prev ?? []),
        ]);
      },
      { root: scrollRef.current, threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isServerChannel, hasMore, oldestId, numericId, conversation.id, qc]);

  // ── Read receipt observer ─────────────────────────────────────────────────
  const observedReadRefs = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!isServerChannel) return;
    const allUnread = messages.filter(
      (m) => !m.readBy?.includes(currentUser.id) && m.senderId !== currentUser.id
    );
    if (allUnread.length === 0) return;

    const observers: IntersectionObserver[] = [];

    allUnread.forEach((msg) => {
      if (observedReadRefs.current.has(msg.id)) return;
      const el = document.getElementById(`msg-${msg.id}`);
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            const mid = Number(msg.id);
            if (!isNaN(mid)) markRead(numericId, mid);
            observedReadRefs.current.add(msg.id);
            obs.disconnect();
          }
        },
        { root: scrollRef.current, threshold: 0.5 }
      );
      obs.observe(el);
      observers.push(obs);
      observedReadRefs.current.add(msg.id);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [messages, currentUser.id, isServerChannel, numericId, markRead]);

  // Clear read-receipt set when conversation changes
  useEffect(() => {
    observedReadRefs.current.clear();
  }, [conversation.id]);

  // ── Send handler ───────────────────────────────────────────────────────────
  const handleSend = useCallback(
    (content: string, type?: "text" | "doubt", fileUrl?: string) => {
      if (isServerChannel) {
        // Optimistic UI
        const optimistic: Message = {
          id: `opt-${crypto.randomUUID()}`,
          conversationId: conversation.id,
          senderId: currentUser.id,
          senderRole: currentUser.role,
          type: type || "text",
          content,
          status: "sending",
          timestamp: new Date(),
          deliveredTo: [],
          readBy: [],
        };
        setOptimisticMessages((prev) => [...prev, optimistic]);

        const sent = sendMessage(numericId, content, {
          messageType: fileUrl ? "file" : type || "text",
          fileUrl,
        });
        if (!sent) {
          // WS not ready — fall back to mock status progression
          setTimeout(() => {
            setOptimisticMessages((prev) =>
              prev.map((m) => (m.id === optimistic.id ? { ...m, status: "sent" as const } : m))
            );
          }, 400);
        }
      } else {
        // Mock mode: simulate status progression
        const newMsg: Message = {
          id: crypto.randomUUID(),
          conversationId: conversation.id,
          senderId: currentUser.id,
          senderRole: currentUser.role,
          type: type || "text",
          content,
          status: "sending",
          timestamp: new Date(),
          deliveredTo: [],
          readBy: [],
          isDoubtAnswered: type === "doubt" ? false : undefined,
        };
        setMessages((prev) => [...prev, newMsg]);
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === newMsg.id ? { ...m, status: "sent" as const } : m))
          );
        }, 400);
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === newMsg.id ? { ...m, status: "delivered" as const } : m))
          );
        }, 1200);
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) => (m.id === newMsg.id ? { ...m, status: "read" as const } : m))
          );
        }, 3000);
      }
    },
    [isServerChannel, conversation.id, currentUser, numericId, sendMessage]
  );

  // ── Typing event from MessageInput ────────────────────────────────────────
  const handleTyping = useCallback(() => {
    if (!isServerChannel) return;
    sendTyping(numericId);
    // Stop typing after 2 s of inactivity (timer resets on every keystroke)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      /* typing auto-expires server-side */
    }, 2000);
  }, [isServerChannel, numericId, sendTyping]);

  // ── Name map for sender lookup ────────────────────────────────────────────
  const nameMap: Record<string, string> = {};
  conversation.participants.forEach((p) => {
    nameMap[p.id] = p.name;
  });
  nameMap[currentUser.id] = currentUser.name;
  Object.values(allUsers).forEach((u) => {
    nameMap[u.id] = u.name;
  });

  // Group messages by day
  let lastDay = "";
  const msgById: Record<string, Message> = {};
  messages.forEach((m) => {
    msgById[m.id] = m;
  });

  // Typing display
  const typingNames = Object.values(typingUsers);
  const typingUserName = typingNames[0];

  // Also show mock typing from conv data (for mock mode)
  const mockTypingUserId = conversation.typing?.[0];
  const mockTypingName = mockTypingUserId
    ? allUsers[mockTypingUserId]?.name || typingUserName
    : typingUserName;

  const isReadOnly = conversation.isReadOnly && currentUser.role !== "teacher";

  if (isLoading && isServerChannel) {
    return (
      <div className="flex h-full flex-col">
        <ChatHeader conversation={conversation} onBack={onBack} />
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <span className="animate-pulse text-sm">Loading messages…</span>
        </div>
        <MessageInput onSend={handleSend} onTyping={handleTyping} isReadOnly={isReadOnly} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatHeader conversation={conversation} onBack={onBack} />

      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto py-3">
        <div className="flex flex-col gap-0.5">
          {/* Top sentinel for infinite scroll */}
          {isServerChannel && hasMore && (
            <div ref={topSentinelRef} className="h-1 w-full" aria-hidden />
          )}

          {messages.map((msg, i) => {
            const isOwn = msg.senderId === currentUser.id;
            const showSender =
              conversation.isGroup &&
              !isOwn &&
              msg.type !== "announcement" &&
              msg.type !== "assignment" &&
              (i === 0 || messages[i - 1].senderId !== msg.senderId);

            const dayLabel = getDayLabel(msg.timestamp);
            let showDaySep = false;
            if (dayLabel !== lastDay) {
              lastDay = dayLabel;
              showDaySep = true;
            }

            const replyContent = msg.replyTo
              ? msgById[msg.replyTo]?.content?.slice(0, 60)
              : undefined;

            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {showDaySep && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                      {dayLabel}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  showSender={showSender}
                  senderName={nameMap[msg.senderId] || msg.senderId}
                  replyContent={replyContent}
                />
              </div>
            );
          })}

          {(typingUserName ||
            (!isServerChannel && conversation.typing && conversation.typing.length > 0)) && (
            <TypingIndicator name={typingUserName || mockTypingName} />
          )}
        </div>
      </div>

      <MessageInput onSend={handleSend} onTyping={handleTyping} isReadOnly={isReadOnly} />
    </div>
  );
};

export default ChatThread;
