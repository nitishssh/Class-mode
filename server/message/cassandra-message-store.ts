import { getCassandraClient } from "../lib/cassandra";
import { randomUUID } from "crypto";

export interface StoredMessage {
  conversationId: string;
  messageId: string;
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
  participantIds: number[];
  participantNames: Record<number, string>;
  participantRoles: Record<number, string>;
  lastMessage?: StoredMessage;
  unreadCount: number;
  isArchived: boolean;
}

export class CassandraMessageStore {
  private client = getCassandraClient();

  private ensureClient() {
    if (!this.client) {
      throw new Error("Cassandra client not initialized");
    }
    return this.client;
  }

  async saveMessage(
    messageData: Omit<StoredMessage, "messageId" | "readBy" | "isRead" | "timestamp">
  ): Promise<StoredMessage> {
    const messageId = randomUUID();
    const timestamp = new Date();

    // Save to messages table
    const query = `
            INSERT INTO messages (
                conversation_id, message_id, sender_id, sender_name, sender_role,
                recipient_id, content, timestamp, read_by, is_read, message_type, file_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    await this.ensureClient().execute(
      query,
      [
        messageData.conversationId,
        messageId,
        messageData.senderId,
        messageData.senderName,
        messageData.senderRole,
        messageData.recipientId,
        messageData.content,
        timestamp,
        [], // read_by
        false, // is_read
        messageData.messageType || "text",
        messageData.fileUrl || null,
      ],
      { prepare: true }
    );

    // Update conversation metadata
    await this.updateConversationMetadata(
      messageData.conversationId,
      messageData.senderId,
      messageData.recipientId,
      messageData.senderName,
      messageData.senderRole,
      messageId,
      messageData.content,
      timestamp
    );

    // Update user conversations for both participants
    await this.updateUserConversation(
      messageData.senderId,
      messageData.conversationId,
      messageData.recipientId,
      messageData.senderName,
      0 // sender has 0 unread
    );

    await this.updateUserConversation(
      messageData.recipientId,
      messageData.conversationId,
      messageData.senderId,
      messageData.senderName,
      1 // recipient has 1 unread
    );

    return {
      ...messageData,
      messageId,
      timestamp,
      readBy: [],
      isRead: false,
    };
  }

  async markMessageAsRead(
    conversationId: string,
    messageId: string,
    userId: number
  ): Promise<void> {
    // Add user to read_by set
    const updateQuery = `
            UPDATE messages 
            SET read_by = read_by + ?
            WHERE conversation_id = ? AND message_id = ?
        `;

    await this.ensureClient().execute(updateQuery, [[userId], conversationId, messageId], {
      prepare: true,
    });

    // Update user's unread count
    const decrementQuery = `
            UPDATE user_conversations 
            SET unread_count = unread_count - 1 
            WHERE user_id = ? AND conversation_id = ?
            IF unread_count > 0
        `;

    await this.ensureClient().execute(decrementQuery, [userId, conversationId], { prepare: true });
  }

  async getConversationHistory(
    conversationId: string,
    userId: number,
    limit: number = 50
  ): Promise<StoredMessage[]> {
    const query = `
            SELECT conversation_id, message_id, sender_id, sender_name, sender_role,
                   recipient_id, content, timestamp, read_by, is_read, message_type, file_url
            FROM messages 
            WHERE conversation_id = ?
            ORDER BY message_id DESC
            LIMIT ?
        `;

    const result = await this.ensureClient().execute(query, [conversationId, limit], {
      prepare: true,
    });

    return result.rows.map((row: any) => ({
      conversationId: row.conversation_id,
      messageId: row.message_id.toString(),
      senderId: row.sender_id,
      senderName: row.sender_name,
      senderRole: row.sender_role,
      recipientId: row.recipient_id,
      content: row.content,
      timestamp: row.timestamp,
      readBy: Array.from(row.read_by || []),
      isRead: row.is_read,
      messageType: row.message_type,
      fileUrl: row.file_url,
    }));
  }

  async getUserConversations(userId: number): Promise<ConversationInfo[]> {
    const query = `
            SELECT conversation_id, participant_ids, participant_names, participant_roles,
                   last_message_content, last_message_timestamp, unread_count, is_archived
            FROM user_conversations 
            WHERE user_id = ?
            ORDER BY conversation_id ASC
        `;

    const result = await this.ensureClient().execute(query, [userId], { prepare: true });

    return result.rows.map((row: any) => ({
      id: row.conversation_id,
      participantIds: Array.from(row.participant_ids),
      participantNames: Object.fromEntries(row.participant_names),
      participantRoles: Object.fromEntries(row.participant_roles),
      lastMessage: row.last_message_content
        ? {
            conversationId: row.conversation_id,
            messageId: "", // Would need separate query to get actual message ID
            senderId: 0, // Would need separate query
            senderName: "", // Would need separate query
            senderRole: "", // Would need separate query
            recipientId: userId,
            content: row.last_message_content,
            timestamp: row.last_message_timestamp,
            readBy: [],
            isRead: false,
            messageType: "text",
          }
        : undefined,
      unreadCount: row.unread_count,
      isArchived: row.is_archived || false,
    }));
  }

  async getMessageById(conversationId: string, messageId: string): Promise<StoredMessage | null> {
    const query = `
            SELECT conversation_id, message_id, sender_id, sender_name, sender_role,
                   recipient_id, content, timestamp, read_by, is_read, message_type, file_url
            FROM messages 
            WHERE conversation_id = ? AND message_id = ?
        `;

    const result = await this.ensureClient().execute(query, [conversationId, messageId], {
      prepare: true,
    });

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
      timestamp: row.timestamp,
      readBy: Array.from(row.read_by || []),
      isRead: row.is_read,
      messageType: row.message_type,
      fileUrl: row.file_url,
    };
  }

  async deleteUserConversation(userId: number, conversationId: string): Promise<boolean> {
    const query = `
            DELETE FROM user_conversations 
            WHERE user_id = ? AND conversation_id = ?
        `;

    try {
      await this.ensureClient().execute(query, [userId, conversationId], { prepare: true });
      return true;
    } catch (error) {
      console.error("Error deleting user conversation:", error);
      return false;
    }
  }

  // Private helper methods
  private async updateConversationMetadata(
    conversationId: string,
    senderId: number,
    recipientId: number,
    senderName: string,
    senderRole: string,
    messageId: string,
    content: string,
    timestamp: Date
  ): Promise<void> {
    // Get existing conversation or create new one
    const convQuery = `SELECT participant_ids FROM conversations WHERE conversation_id = ?`;
    const convResult = await this.ensureClient().execute(convQuery, [conversationId], {
      prepare: true,
    });

    let participantIds: Set<number>;
    if (convResult.rows.length > 0) {
      participantIds = convResult.rows[0].participant_ids;
    } else {
      participantIds = new Set([senderId, recipientId]);

      // Create new conversation record
      const createConvQuery = `
                INSERT INTO conversations (
                    conversation_id, participant_ids, created_at, updated_at, is_group
                ) VALUES (?, ?, ?, ?, ?)
            `;

      await this.ensureClient().execute(
        createConvQuery,
        [conversationId, participantIds, timestamp, timestamp, false],
        { prepare: true }
      );
    }

    // Update conversation timestamp
    const updateConvQuery = `
            UPDATE conversations 
            SET updated_at = ?
            WHERE conversation_id = ?
        `;

    await this.ensureClient().execute(updateConvQuery, [timestamp, conversationId], {
      prepare: true,
    });
  }

  private async updateUserConversation(
    userId: number,
    conversationId: string,
    otherUserId: number,
    otherUserName: string,
    unreadIncrement: number
  ): Promise<void> {
    const query = `
            UPDATE user_conversations 
            SET unread_count = unread_count + ?,
                last_message_timestamp = ?
            WHERE user_id = ? AND conversation_id = ?
        `;

    await this.ensureClient().execute(
      query,
      [unreadIncrement, new Date(), userId, conversationId],
      { prepare: true }
    );
  }
}
