export type UserRole = "student" | "teacher" | "parent";

// ─── Server-side shapes (from the REST API) ───────────────────────────────────
// These mirror the shapes returned by the backend. They are separate from the
// UI-facing types above so we don't conflate numeric server IDs with the mock
// string IDs used in the existing components.

export interface ServerChannel {
  id: number;
  name: string;
  type: "text" | "dm" | "announcement";
  workspaceId: number | null;
  subject?: string;
  class?: string;
  pinnedMessages?: number[];
}

export interface ServerMessage {
  id: number;
  channelId: number;
  authorId: number;
  authorUsername?: string;
  content: string;
  type: "text" | "file" | "image";
  fileUrl?: string | null;
  readBy: number[];
  isHomework?: boolean;
  createdAt: string;
}
export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type MessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "doc"
  | "announcement"
  | "assignment"
  | "doubt"
  | "system";
export type ConversationCategory = "announcement" | "class" | "teacher" | "friend" | "parent";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: UserRole;
  type: MessageType;
  content: string;
  mediaId?: string;
  mediaUrl?: string;
  status: MessageStatus;
  timestamp: Date;
  deliveredTo: string[];
  readBy: string[];
  isPinned?: boolean;
  isDoubtAnswered?: boolean;
  assignmentData?: {
    title: string;
    dueDate: Date;
    fileUrl?: string;
    subject: string;
  };
  replyTo?: string;
  mentions?: string[];
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isOnline: boolean;
  lastSeen?: Date;
  subject?: string; // for teachers
}

export interface Conversation {
  id: string;
  name?: string;
  category: ConversationCategory;
  isGroup: boolean;
  isReadOnly?: boolean; // announcements
  participants: User[];
  lastMessage?: Message;
  unreadCount: number;
  typing?: string[];
  pinnedMessages?: string[];
  subject?: string;
  icon?: string;
}
