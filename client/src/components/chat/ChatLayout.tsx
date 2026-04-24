import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Conversation, ConversationCategory } from "@/types/chat";
import { useRole, ChatRoleProvider } from "@/contexts/chat-role-context";
import { fetchWorkspaces, fetchChannels, fetchDMs, ApiChannel } from "@/lib/chat-api";
import { useChatWs } from "@/hooks/use-chat-ws";
import ConversationList from "./ConversationList";
import ChatThread from "./ChatThread";
import { MessageSquare } from "lucide-react";
import { WsReconnectBanner } from "./WsReconnectBanner";

// ─── Convert a server ApiChannel into the UI Conversation shape ───────────────

function channelToConversation(ch: ApiChannel): Conversation {
  // Derive category heuristically from channel type / name
  let category: ConversationCategory;
  if (ch.type === "announcement") {
    category = "announcement";
  } else if (ch.type === "dm") {
    category = "teacher"; // fallback; enriched below for DM partner roles
  } else if (ch.subject || ch.class) {
    category = "class";
  } else {
    category = "friend";
  }

  return {
    id: String(ch.id), // numeric → string for existing UI
    name: ch.name,
    category,
    isGroup: ch.type !== "dm",
    isReadOnly: ch.type === "announcement",
    participants: [],
    unreadCount: 0,
    subject: ch.subject,
  };
}

// ─── Inner component (wrapped by ChatRoleProvider) ────────────────────────────

const ChatLayoutInner = () => {
  const { currentRole } = useRole();
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [showList, setShowList] = useState(true);

  // ── Fetch workspaces the user belongs to ──────────────────────────────────
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
    staleTime: 60_000,
    retry: 1,
  });

  // ── Fetch channels for all workspaces ────────────────────────────────────
  const { data: channelsByWs } = useQuery({
    queryKey: ["channels", workspaces?.map((w) => w.id)],
    queryFn: async () => {
      if (!workspaces || workspaces.length === 0) return [] as ApiChannel[];
      const arrays = await Promise.all(workspaces.map((ws) => fetchChannels(ws.id)));
      return arrays.flat();
    },
    enabled: (workspaces?.length ?? 0) > 0,
    staleTime: 60_000,
    retry: 1,
  });

  // ── Fetch DMs ────────────────────────────────────────────────────────────
  const { data: dms } = useQuery({
    queryKey: ["dms"],
    queryFn: fetchDMs,
    staleTime: 60_000,
    retry: 1,
  });

  // ── Merge server data with mock data as fallback ──────────────────────────
  const conversations = useMemo<Conversation[]>(() => {
    const serverConvs: Conversation[] = [];

    // Group channels
    if (channelsByWs && channelsByWs.length > 0) {
      channelsByWs.forEach((ch) => {
        serverConvs.push(channelToConversation(ch));
      });
    }

    // Merge DMs
    if (dms && dms.length > 0) {
      dms.forEach((dm) => {
        const conv = channelToConversation(dm);
        // Set category based on partner role
        if (dm.partner?.role === "teacher") conv.category = "teacher";
        else if (dm.partner?.role === "parent") conv.category = "parent";
        else conv.category = "friend";
        // Use partner name if available
        if (dm.partner) {
          conv.name = dm.partner.username;
          conv.participants = [
            {
              id: String(dm.partner.id),
              name: dm.partner.username,
              role: (dm.partner.role as "student" | "teacher" | "parent") || "student",
              isOnline: false,
            },
          ];
        }
        serverConvs.push(conv);
      });
    }

    return serverConvs;
  }, [channelsByWs, dms, currentRole]);

  // ── Reset active conversation when conversations change ───────────────────
  useEffect(() => {
    if (conversations.length === 0) return;
    if (!activeConv || !conversations.find((c) => c.id === activeConv.id)) {
      setActiveConv(conversations[0] ?? null);
    }
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Shared WebSocket (connected for the duration of the layout) ───────────
  const activeChannelIdArg = activeConv ? Number(activeConv.id) : undefined;
  const { status: wsStatus } = useChatWs({
    activeChannelId: activeChannelIdArg && !isNaN(activeChannelIdArg) ? activeChannelIdArg : undefined,
    onEvent: () => {},
  });

  const handleSelect = useCallback((conv: Conversation) => {
    setActiveConv(conv);
    setShowList(false);
  }, []);

  const handleBack = useCallback(() => {
    setShowList(true);
  }, []);

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <WsReconnectBanner status={wsStatus} />
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation sidebar */}
        <div
          className={`${
            showList ? "flex" : "hidden"
          } bg-sidebar w-full flex-shrink-0 border-r border-border md:flex md:w-[320px] lg:w-[360px]`}
        >
          <div className="w-full">
            <ConversationList
              conversations={conversations}
              activeId={activeConv?.id}
              onSelect={handleSelect}
            />
          </div>
        </div>

        {/* Chat area */}
        <div className={`${!showList ? "flex" : "hidden"} min-w-0 flex-1 flex-col md:flex`}>
          {activeConv ? (
            <ChatThread conversation={activeConv} onBack={handleBack} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="mx-auto mb-4 h-16 w-16 opacity-20" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="mt-1 text-sm">
                  {currentRole === "student"
                    ? "Choose from your classes, teachers, or friends"
                    : currentRole === "teacher"
                      ? "Choose from your classes, students, or parents"
                      : "Choose from your teachers or announcements"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatLayout = () => (
  <ChatRoleProvider>
    <ChatLayoutInner />
  </ChatRoleProvider>
);

export default ChatLayout;
