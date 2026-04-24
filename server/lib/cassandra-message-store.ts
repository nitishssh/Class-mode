/**
 * Cassandra (Astra DB) message data-access layer.
 *
 * All functions mirror the IStorage message methods so they can be used
 * as a drop-in inside MongoStorage when Cassandra is configured.
 *
 * Partition key  : channel_id  (all messages for a channel live together)
 * Clustering key : message_id  (Snowflake — globally unique, time-sorted DESC)
 */

import { getCassandraClient } from "./cassandra";
import { snowflake } from "./snowflake";
import type { Message, InsertMessage, Channel } from "@shared/schema";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Map a raw Cassandra row to the shared Message type. */
function rowToMessage(row: Record<string, any>): Message {
  return {
    id: Number(BigInt(row["message_id"])), // numeric id used by the rest of the app
    channelId: Number(row["channel_id"]),
    authorId: Number(row["author_id"]),
    content: row["content"] ?? "",
    type: (row["type"] as "text" | "file" | "image") ?? "text",
    fileUrl: row["file_url"] ?? null,
    isPinned: row["is_pinned"] ?? false,
    isHomework: row["is_homework"] ?? false,
    gradingStatus: row["grading_status"] ?? null,
    readBy: (row["read_by"] ?? []).map(Number),
    createdAt: new Date(row["created_at"]),
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function cassandraCreateMessage(message: InsertMessage): Promise<Message> {
  const client = getCassandraClient()!;
  const messageId = snowflake.nextId();

  await client.execute(
    `INSERT INTO messages
       (channel_id, message_id, author_id, content, type, file_url,
        is_pinned, is_homework, grading_status, read_by, attachments, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(message.channelId),
      messageId,
      BigInt(message.authorId),
      message.content,
      message.type ?? "text",
      message.fileUrl ?? null,
      false, // isPinned
      message.isHomework ?? false,
      message.gradingStatus ?? null,
      [], // readBy — starts empty
      [], // attachments — media upload handled separately
      new Date(),
    ],
    { prepare: true }
  );

  return {
    id: Number(BigInt(messageId)),
    channelId: message.channelId,
    authorId: message.authorId,
    content: message.content,
    type: message.type ?? "text",
    fileUrl: message.fileUrl ?? null,
    isPinned: false,
    isHomework: message.isHomework ?? false,
    gradingStatus: message.gradingStatus ?? null,
    readBy: [],
    createdAt: new Date(),
  };
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function cassandraGetMessagesByChannel(
  channelId: number,
  limit = 50,
  before?: number
): Promise<Message[]> {
  const client = getCassandraClient()!;

  let query: string;
  let params: any[];

  if (before !== undefined) {
    // Convert numeric id back to Snowflake string for comparison
    const beforeId = BigInt(before).toString();
    query = `SELECT * FROM messages WHERE channel_id = ? AND message_id < ? LIMIT ? ALLOW FILTERING`;
    params = [String(channelId), beforeId, limit];
  } else {
    query = `SELECT * FROM messages WHERE channel_id = ? LIMIT ?`;
    params = [String(channelId), limit];
  }

  const result = await client.execute(query, params, { prepare: true });
  // Cassandra returns DESC order (newest first) — reverse so client gets oldest→newest
  return result.rows.reverse().map(rowToMessage);
}

export async function cassandraGetPinnedMessages(channelId: number): Promise<Message[]> {
  const client = getCassandraClient()!;
  const result = await client.execute(
    `SELECT * FROM messages WHERE channel_id = ? AND is_pinned = true ALLOW FILTERING`,
    [String(channelId)],
    { prepare: true }
  );
  return result.rows.map(rowToMessage);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function cassandraDeleteMessage(
  channelId: number,
  messageId: number
): Promise<boolean> {
  const client = getCassandraClient()!;
  await client.execute(
    `DELETE FROM messages WHERE channel_id = ? AND message_id = ?`,
    [String(channelId), BigInt(messageId).toString()],
    { prepare: true }
  );
  return true;
}

// ─── Updates ─────────────────────────────────────────────────────────────────

export async function cassandraPinMessage(
  channelId: number,
  messageId: number,
  pin: boolean
): Promise<void> {
  const client = getCassandraClient()!;
  await client.execute(
    `UPDATE messages SET is_pinned = ? WHERE channel_id = ? AND message_id = ?`,
    [pin, String(channelId), BigInt(messageId).toString()],
    { prepare: true }
  );
}

export async function cassandraGradeMessage(
  channelId: number,
  messageId: number,
  status: "pending" | "graded"
): Promise<void> {
  const client = getCassandraClient()!;
  await client.execute(
    `UPDATE messages SET grading_status = ? WHERE channel_id = ? AND message_id = ?`,
    [status, String(channelId), BigInt(messageId).toString()],
    { prepare: true }
  );
}

export async function cassandraMarkMessageAsRead(
  channelId: number,
  messageId: number,
  userId: number
): Promise<void> {
  const client = getCassandraClient()!;
  await client.execute(
    `UPDATE messages SET read_by = read_by + ? WHERE channel_id = ? AND message_id = ?`,
    [[BigInt(userId)], String(channelId), BigInt(messageId).toString()],
    { prepare: true }
  );
}
