import { randomUUID } from "crypto";
import { getCassandraClient } from "../lib/cassandra";
import type { IMessageStore, StoredMessage, ConversationInfo } from "./types";

export class CassandraMessageStore implements IMessageStore {
  private get client() {
    return getCassandraClient();
  }

  private ensureClient() {
    const c = this.client;
    if (!c) throw new Error("Cassandra client not initialized — check ASTRA_DB_* env vars");
    return c;
  }

  async saveMessage(
    data: Omit<StoredMessage, "messageId" | "readBy" | "isRead" | "timestamp">
  ): Promise<StoredMessage> {
    const messageId = randomUUID();
    const timestamp = new Date();

    await this.ensureClient().execute(
      `INSERT INTO messages (
        conversation_id, message_id, sender_id, sender_name, sender_role,
        recipient_id, content, timestamp, read_by, is_read, message_type, file_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.conversationId, messageId, data.senderId, data.senderName, data.senderRole,
        data.recipientId, data.content, timestamp, [], false,
        data.messageType ?? "text", data.fileUrl ?? null,
      ],
      { prepare: true }
    );

    await this.updateConversationMetadata(
      data.conversationId, data.senderId, data.recipientId,
      data.senderName, data.senderRole, messageId, data.content, timestamp
    );
    await this.updateUserConversation(data.senderId, data.conversationId, data.recipientId, 0);
    await this.updateUserConversation(data.recipientId, data.conversationId, data.senderId, 1);

    return { ...data, messageId, timestamp, readBy: [], isRead: false, messageType: data.messageType ?? "text" };
  }

  async markMessageAsRead(conversationId: string, messageId: string, userId: number): Promise<void> {
    await this.ensureClient().execute(
      `UPDATE messages SET read_by = read_by + ? WHERE conversation_id = ? AND message_id = ?`,
      [[userId], conversationId, messageId],
      { prepare: true }
    );
    await this.ensureClient().execute(
      `UPDATE user_conversations SET unread_count = unread_count - 1
       WHERE user_id = ? AND conversation_id = ? IF unread_count > 0`,
      [userId, conversationId],
      { prepare: true }
    );
  }

  async getConversationHistory(
    conversationId: string,
    _userId: number,
    limit: number = 50
  ): Promise<StoredMessage[]> {
    const result = await this.ensureClient().execute(
      `SELECT conversation_id, message_id, sender_id, sender_name, sender_role,
              recipient_id, content, timestamp, read_by, is_read, message_type, file_url
       FROM messages WHERE conversation_id = ? ORDER BY message_id DESC LIMIT ?`,
      [conversationId, limit],
      { prepare: true }
    );

    return result.rows.map((row: any) => ({
      conversationId: row.conversation_id,
      messageId: row.message_id.toString(),
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderRole: row.sender_role,
      recipientId: row.recipient_id,
      content: row.content,
      timestamp: new Date(row.timestamp),
      readBy: Array.from(row.read_by ?? []),
      isRead: row.is_read,
      messageType: row.message_type,
      fileUrl: row.file_url ?? undefined,
    }));
  }

  async getUserConversations(userId: number): Promise<ConversationInfo[]> {
    const result = await this.ensureClient().execute(
      `SELECT conversation_id, participant_ids, participant_names, participant_roles,
              last_message_content, last_message_timestamp, unread_count, is_archived
       FROM user_conversations WHERE user_id = ?`,
      [userId],
      { prepare: true }
    );

    return result.rows.map((row: any) => {
      const ids: number[] = Array.from(row.participant_ids ?? []);
      const names: Record<number, string> = Object.fromEntries(row.participant_names ?? []);
      const roles: Record<number, string> = Object.fromEntries(row.participant_roles ?? []);

      const participants = ids.map((id) => ({
        id,
        name: names[id] ?? "",
        role: roles[id] ?? "",
      }));

      const lastMessage: StoredMessage | undefined = row.last_message_content
        ? {
            conversationId: row.conversation_id,
            messageId: "",
            senderId: 0,
            senderName: "",
            senderRole: "",
            recipientId: userId,
            content: row.last_message_content,
            timestamp: new Date(row.last_message_timestamp),
            readBy: [],
            isRead: false,
            messageType: "text",
          }
        : undefined;

      return {
        id: row.conversation_id,
        participants,
        lastMessage,
        unreadCount: row.unread_count ?? 0,
        isArchived: row.is_archived ?? false,
      };
    });
  }

  async getMessageById(conversationId: string, messageId: string): Promise<StoredMessage | null> {
    const result = await this.ensureClient().execute(
      `SELECT conversation_id, message_id, sender_id, sender_name, sender_role,
              recipient_id, content, timestamp, read_by, is_read, message_type, file_url
       FROM messages WHERE conversation_id = ? AND message_id = ?`,
      [conversationId, messageId],
      { prepare: true }
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      conversationId: row.conversation_id,
      messageId: row.message_id.toString(),
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderRole: row.sender_role,
      recipientId: row.recipient_id,
      content: row.content,
      timestamp: new Date(row.timestamp),
      readBy: Array.from(row.read_by ?? []),
      isRead: row.is_read,
      messageType: row.message_type,
      fileUrl: row.file_url ?? undefined,
    };
  }

  async deleteUserConversation(userId: number, conversationId: string): Promise<boolean> {
    try {
      await this.ensureClient().execute(
        `DELETE FROM user_conversations WHERE user_id = ? AND conversation_id = ?`,
        [userId, conversationId],
        { prepare: true }
      );
      return true;
    } catch {
      return false;
    }
  }

  private async updateConversationMetadata(
    conversationId: string, senderId: number, recipientId: number,
    senderName: string, senderRole: string, messageId: string,
    content: string, timestamp: Date
  ): Promise<void> {
    const c = this.ensureClient();
    const existing = await c.execute(
      `SELECT participant_ids FROM conversations WHERE conversation_id = ?`,
      [conversationId], { prepare: true }
    );

    if (existing.rows.length === 0) {
      await c.execute(
        `INSERT INTO conversations (conversation_id, participant_ids, created_at, updated_at, is_group)
         VALUES (?, ?, ?, ?, ?)`,
        [conversationId, new Set([senderId, recipientId]), timestamp, timestamp, false],
        { prepare: true }
      );
    } else {
      await c.execute(
        `UPDATE conversations SET updated_at = ? WHERE conversation_id = ?`,
        [timestamp, conversationId], { prepare: true }
      );
    }
  }

  private async updateUserConversation(
    userId: number, conversationId: string,
    _otherUserId: number, unreadIncrement: number
  ): Promise<void> {
    await this.ensureClient().execute(
      `UPDATE user_conversations SET unread_count = unread_count + ?, last_message_timestamp = ?
       WHERE user_id = ? AND conversation_id = ?`,
      [unreadIncrement, new Date(), userId, conversationId],
      { prepare: true }
    );
  }
}
