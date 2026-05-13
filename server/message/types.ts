export interface StoredMessage {
  messageId: string;
  conversationId: string;
  senderId: number;
  senderName: string;
  senderRole: string;
  recipientId: number;
  content: string;
  timestamp: Date;
  readBy: number[];
  isRead: boolean;
  messageType: string;
  fileUrl?: string;
}

export interface ConversationInfo {
  id: string;
  participants: { id: number; name: string; role: string }[];
  lastMessage?: StoredMessage;
  unreadCount: number;
  isArchived?: boolean;
}

export interface IMessageStore {
  saveMessage(
    data: Omit<StoredMessage, "messageId" | "readBy" | "isRead" | "timestamp">
  ): Promise<StoredMessage>;
  markMessageAsRead(conversationId: string, messageId: string, userId: number): Promise<void>;
  getConversationHistory(
    conversationId: string,
    userId: number,
    limit?: number
  ): Promise<StoredMessage[]>;
  getUserConversations(userId: number): Promise<ConversationInfo[]>;
  getMessageById(conversationId: string, messageId: string): Promise<StoredMessage | null>;
  deleteUserConversation(userId: number, conversationId: string): Promise<boolean>;
}
