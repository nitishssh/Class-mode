// Mock implementation - will be replaced with Cassandra integration
export interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: number;
  senderName: string;
  senderRole: string;
  recipientId: number;
  content: string;
  timestamp: string;
  readBy: number[];
  isRead: boolean;
}

export interface ConversationInfo {
  id: string;
  participants: { id: number; name: string; role: string }[];
  lastMessage?: StoredMessage;
  unreadCount: number;
}

export class MessageStore {
  private messages: Map<string, StoredMessage> = new Map();
  private conversations: Map<string, Set<string>> = new Map(); // conversationId -> messageIds

  async saveMessage(
    messageData: Omit<StoredMessage, "id" | "readBy" | "isRead">
  ): Promise<StoredMessage> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const message: StoredMessage = {
      ...messageData,
      id: messageId,
      readBy: [],
      isRead: false,
    };

    this.messages.set(messageId, message);

    // Update conversation mapping
    if (!this.conversations.has(message.conversationId)) {
      this.conversations.set(message.conversationId, new Set());
    }
    this.conversations.get(message.conversationId)?.add(messageId);

    return message;
  }

  async markMessageAsRead(messageId: string, userId: number): Promise<void> {
    const message = this.messages.get(messageId);
    if (message && !message.readBy.includes(userId)) {
      message.readBy.push(userId);
      message.isRead = message.readBy.length > 0;
      this.messages.set(messageId, message);
    }
  }

  async getConversationHistory(
    conversationId: string,
    userId: number,
    limit: number = 50
  ): Promise<StoredMessage[]> {
    const messageIds = this.conversations.get(conversationId) || new Set();
    const messages: StoredMessage[] = [];

    Array.from(messageIds).forEach((messageId) => {
      const message = this.messages.get(messageId);
      if (message) {
        messages.push(message);
      }
    });

    // Sort by timestamp and limit
    return messages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-limit);
  }

  async getUserConversations(userId: number): Promise<ConversationInfo[]> {
    const userConversations = new Map<string, ConversationInfo>();

    // Find all conversations where user is participant
    Array.from(this.conversations.entries()).forEach(([conversationId, messageIds]) => {
      const messages = Array.from(messageIds)
        .map((id) => this.messages.get(id))
        .filter((msg): msg is StoredMessage => msg !== undefined);

      const userMessages = messages.filter(
        (msg) => msg.senderId === userId || msg.recipientId === userId
      );

      if (userMessages.length > 0) {
        // Get conversation participants
        const participants = new Map<number, { id: number; name: string; role: string }>();

        for (const msg of messages) {
          if (!participants.has(msg.senderId)) {
            participants.set(msg.senderId, {
              id: msg.senderId,
              name: msg.senderName,
              role: msg.senderRole,
            });
          }
        }

        const sortedMessages = messages.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const lastMessage = sortedMessages[0];
        const unreadCount = messages.filter(
          (msg) => msg.recipientId === userId && !msg.isRead
        ).length;

        userConversations.set(conversationId, {
          id: conversationId,
          participants: Array.from(participants.values()),
          lastMessage,
          unreadCount,
        });
      }
    });

    return Array.from(userConversations.values()).sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }

  async getMessageById(messageId: string): Promise<StoredMessage | null> {
    return this.messages.get(messageId) || null;
  }

  async deleteMessage(messageId: string): Promise<boolean> {
    const message = this.messages.get(messageId);
    if (!message) return false;

    // Remove from conversation mapping
    const conversationMessages = this.conversations.get(message.conversationId);
    if (conversationMessages) {
      conversationMessages.delete(messageId);
      if (conversationMessages.size === 0) {
        this.conversations.delete(message.conversationId);
      }
    }

    // Remove message
    this.messages.delete(messageId);
    return true;
  }
}
