import { Conversation, ConversationCategory } from "@/types/chat";
import { useRole } from "@/contexts/chat-role-context";
import { getCurrentUserId } from "@/data/mockData";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  MessageSquarePlus,
  Megaphone,
  BookOpen,
  GraduationCap,
  Users,
  User,
} from "lucide-react";
import { useState } from "react";
import MessageStatusIcon from "./MessageStatusIcon";

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (conv: Conversation) => void;
}

const categoryConfig: Record<ConversationCategory, { label: string; icon: typeof Megaphone }> = {
  announcement: { label: "Announcements", icon: Megaphone },
  class: { label: "Classes", icon: BookOpen },
  teacher: { label: "Teachers", icon: GraduationCap },
  friend: { label: "Friends", icon: Users },
  parent: { label: "Parents", icon: User },
};

const ConversationList = ({ conversations, activeId, onSelect }: ConversationListProps) => {
  const [search, setSearch] = useState("");
  const { currentRole } = useRole();
  const myId = getCurrentUserId(currentRole);

  const filtered = conversations.filter((c) => {
    const name = c.name || c.participants.map((p) => p.name).join(", ");
    return name.toLowerCase().includes(search.toLowerCase());
  });

  // Group by category
  const grouped: Partial<Record<ConversationCategory, Conversation[]>> = {};
  filtered.forEach((c) => {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category]!.push(c);
  });

  // Category order
  const categoryOrder: ConversationCategory[] = [
    "announcement",
    "class",
    "teacher",
    "friend",
    "parent",
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="px-4 pb-2 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Messages</h1>
          <button className="hover:bg-sidebar-accent rounded-lg p-2 text-muted-foreground transition-colors hover:text-foreground">
            <MessageSquarePlus className="h-5 w-5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-sidebar-accent w-full rounded-lg py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Grouped list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {categoryOrder.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          const cfg = categoryConfig[cat];
          const Icon = cfg.icon;

          return (
            <div key={cat}>
              <div className="mt-1 flex items-center gap-2 px-4 py-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cfg.label}
                </span>
              </div>
              {items.map((conv) => {
                const name = conv.name || conv.participants.map((p) => p.name).join(", ");
                const isActive = conv.id === activeId;
                const lastMsg = conv.lastMessage;
                const isOwnLastMsg = lastMsg?.senderId === myId;

                const initials = name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                const avatarColor =
                  cat === "announcement"
                    ? "bg-announcement-bg text-announcement"
                    : cat === "class"
                      ? "bg-role-teacher/15 text-role-teacher"
                      : "bg-secondary text-secondary-foreground";

                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelect(conv)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div
                        className={`h-10 w-10 rounded-full ${avatarColor} flex items-center justify-center text-xs font-semibold`}
                      >
                        {initials}
                      </div>
                      {!conv.isGroup && conv.participants[0]?.isOnline && (
                        <span className="bg-online border-sidebar absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-medium text-foreground">{name}</span>
                        {lastMsg && (
                          <span className="ml-2 flex-shrink-0 text-[10px] text-muted-foreground">
                            {formatDistanceToNow(lastMsg.timestamp, { addSuffix: false })}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-1">
                          {isOwnLastMsg && lastMsg && <MessageStatusIcon status={lastMsg.status} />}
                          <span className="truncate text-xs text-muted-foreground">
                            {conv.typing && conv.typing.length > 0
                              ? "typing…"
                              : lastMsg?.type === "image"
                                ? "📷 Photo"
                                : lastMsg?.type === "announcement"
                                  ? "📢 " + (lastMsg?.content?.slice(0, 40) || "")
                                  : lastMsg?.type === "assignment"
                                    ? "📝 " + (lastMsg?.assignmentData?.title || "Assignment")
                                    : lastMsg?.type === "doubt"
                                      ? "❓ " + (lastMsg?.content?.slice(0, 40) || "")
                                      : lastMsg?.content?.slice(0, 50) || ""}
                          </span>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationList;
