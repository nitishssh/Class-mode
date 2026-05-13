// In-memory fallback store used when Cassandra (ASTRA_DB) is not configured.
// Data does NOT persist across restarts. Configure ASTRA_DB_* env vars and
// Cassandra will be used automatically via createMessageStore().
import { randomUUID } from "crypto";
import type { IMessageStore, StoredMessage, ConversationInfo } from "./types";

export class MessageStore implements IMessageStore {
  private messages: Map<string, StoredMessage> = new Map();
  private conversations: Map<string, Set<string>> = new Map();

  async saveMessage(
    data: Omit<StoredMessage, "messageId" | "readBy" | "isRead" | "timestamp">
  ): Promise<StoredMessage> {
    const message: StoredMessage = {
      ...data,
      messageId: randomUUID(),
      timestamp: new Date(),
      readBy: [],
      isRead: false,
      messageType: data.messageType ?? "text",
    };

    this.messages.set(message.messageId, message);

    if (!this.conversations.has(message.conversationId)) {
      this.conversations.set(message.conversationId, new Set());
    }
    this.conversations.get(message.conversationId)!.add(message.messageId);

    return message;
  }

  async markMessageAsRead(
    _conversationId: string,
    messageId: string,
    userId: number
  ): Promise<void> {
    const message = this.messages.get(messageId);
    if (message && !message.readBy.includes(userId)) {
      message.readBy.push(userId);
      message.isRead = true;
    }
  }

  async getConversationHistory(
    conversationId: string,
    _userId: number,
    limit: number = 50
  ): Promise<StoredMessage[]> {
    const ids = this.conversations.get(conversationId) ?? new Set<string>();
    const messages: StoredMessage[] = [];

    for (const id of ids) {
      const msg = this.messages.get(id);
      if (msg) messages.push(msg);
    }

    return messages
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(-limit);
  }

  async getUserConversations(userId: number): Promise<ConversationInfo[]> {
    const result = new Map<string, ConversationInfo>();

    for (const [conversationId, ids] of this.conversations.entries()) {
      const messages = [...ids]
        .map((id) => this.messages.get(id))
        .filter((m): m is StoredMessage => m !== undefined);

      const relevant = messages.filter(
        (m) => m.senderId === userId || m.recipientId === userId
      );
      if (relevant.length === 0) continue;

      const participantsMap = new Map<number, { id: number; name: string; role: string }>();
      for (const m of messages) {
        if (!participantsMap.has(m.senderId)) {
          participantsMap.set(m.senderId, {
            id: m.senderId,
            name: m.senderName,
            role: m.senderRole,
          });
        }
      }

      const sorted = [...messages].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      );

      result.set(conversationId, {
        id: conversationId,
        participants: [...participantsMap.values()],
        lastMessage: sorted[0],
        unreadCount: messages.filter((m) => m.recipientId === userId && !m.isRead).length,
      });
    }

    return [...result.values()].sort((a, b) => {
      const ta = a.lastMessage?.timestamp.getTime() ?? 0;
      const tb = b.lastMessage?.timestamp.getTime() ?? 0;
      return tb - ta;
    });
  }

  async getMessageById(
    _conversationId: string,
    messageId: string
  ): Promise<StoredMessage | null> {
    return this.messages.get(messageId) ?? null;
  }

  async deleteUserConversation(userId: number, conversationId: string): Promise<boolean> {
    const ids = this.conversations.get(conversationId);
    if (!ids) return false;

    const belongs = [...ids].some((id) => {
      const m = this.messages.get(id);
      return m && (m.senderId === userId || m.recipientId === userId);
    });
    if (!belongs) return false;

    for (const id of ids) this.messages.delete(id);
    this.conversations.delete(conversationId);
    return true;
  }
}
