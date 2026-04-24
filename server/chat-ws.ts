/**
 * server/chat-ws.ts — Phase 4 Update
 *
 * WebSocket server for real-time chat. Authentication is now via Firebase ID token
 * passed as a query parameter: ws://host/ws/chat?token=<firebase_id_token>
 *
 * Falls back to Express session cookie auth for backward compatibility
 * (e.g. when firebase-admin is not fully configured).
 *
 * New events supported:
 *   Client → Server:  mark_delivered, answer_doubt, stop_typing, pin_message
 *   Server → Client:  message_delivered, doubt_answered, message_pinned
 */

import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { Server } from "http";
import type { Store } from "express-session";
import { storage } from "./storage";
import { aiChat } from "./lib/openai";
import { verifyFirebaseToken } from "./lib/firebase-admin";
import { MongoUser, MongoChannel } from "@shared/mongo-schema";

const AI_TUTOR_ID = 999;
const AI_TUTOR_NAME = "AI Tutor";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientMeta {
  userId: number; // MongoDB integer user ID
  firebaseUid: string; // Firebase UID (for unread counts map key)
  username: string;
  displayName: string;
  role: string;
  channels: Set<number>;
}

type IncomingEventType =
  | "join_channel"
  | "leave_channel"
  | "send_message"
  | "typing"
  | "stop_typing"
  | "mark_read"
  | "mark_delivered"
  | "answer_doubt"
  | "pin_message"
  | "live_class_event";

interface IncomingEvent {
  type: IncomingEventType;
  channelId?: number;
  messageId?: number;
  content?: string;
  messageType?: "text" | "file" | "image" | "doubt" | "assignment" | "announcement";
  fileUrl?: string;
  senderRole?: string;
  replyTo?: number;
  mentions?: string[];
  // Live class fields
  classId?: number;
  action?: "started" | "ended";
}

// ─── State ────────────────────────────────────────────────────────────────────

/** channelId → Set of subscribed WebSocket clients */
const channelSubscribers = new Map<number, Set<WebSocket>>();

/** ws → metadata about the connected user */
const clientMeta = new Map<WebSocket, ClientMeta>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToChannel(channelId: number, data: object, exclude?: WebSocket) {
  const subs = channelSubscribers.get(channelId);
  if (!subs) return;
  for (const client of Array.from(subs)) {
    if (client !== exclude) send(client, data);
  }
}

function subscribeToChannel(ws: WebSocket, channelId: number) {
  if (!channelSubscribers.has(channelId)) {
    channelSubscribers.set(channelId, new Set());
  }
  channelSubscribers.get(channelId)!.add(ws);
  const meta = clientMeta.get(ws);
  if (meta) meta.channels.add(channelId);
}

function unsubscribeFromChannel(ws: WebSocket, channelId: number) {
  channelSubscribers.get(channelId)?.delete(ws);
  const meta = clientMeta.get(ws);
  if (meta) meta.channels.delete(channelId);
}

function cleanupClient(ws: WebSocket) {
  const meta = clientMeta.get(ws);
  if (!meta) return;

  for (const channelId of Array.from(meta.channels)) {
    channelSubscribers.get(channelId)?.delete(ws);
    broadcastToChannel(channelId, {
      type: "user_presence",
      userId: meta.userId,
      firebaseUid: meta.firebaseUid,
      username: meta.username,
      status: "offline",
      channelId,
    });
  }

  clientMeta.delete(ws);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

/**
 * Resolves the authenticated userId either from:
 *   1. ?token=<firebase_id_token> query param  (preferred, Phase 4)
 *   2. Express session cookie                  (legacy/fallback)
 */
async function resolveUserId(
  sessionStore: Store,
  req: any
): Promise<{ userId: number; firebaseUid: string; displayName: string; role: string } | null> {
  const url = req.url as string;
  const params = new URLSearchParams(url.includes("?") ? url.split("?")[1] : "");
  const token = params.get("token");

  if (token) {
    // ── Firebase token path ────────────────────────────────────────────────
    const decoded = await verifyFirebaseToken(token);
    if (!decoded) return null;

    const { uid, name, email } = decoded;

    // Find the MongoDB user linked to this Firebase UID
    let mongoUser: any = await (MongoUser as any).findOne({ firebaseUid: uid });
    if (!mongoUser && email) {
      mongoUser = await (MongoUser as any).findOne({ email });
    }

    if (!mongoUser) return null;

    return {
      userId: mongoUser.id,
      firebaseUid: uid,
      displayName: mongoUser.displayName || mongoUser.name || name || email || "User",
      role: mongoUser.role ?? "student",
    };
  }

  // ── Session fallback ─────────────────────────────────────────────────────
  return new Promise((resolve) => {
    const cookieHeader = req.headers?.cookie || "";
    const match = cookieHeader.match(/connect\.sid=([^;]+)/);
    if (!match) return resolve(null);

    let sid = decodeURIComponent(match[1]);
    if (sid.startsWith("s:")) sid = sid.slice(2).split(".")[0];

    sessionStore.get(sid, async (err: any, session: any) => {
      if (err || !session?.userId) return resolve(null);

      const user = await storage.getUser(session.userId);
      if (!user) return resolve(null);

      resolve({
        userId: user.id,
        firebaseUid: (user as any).firebaseUid ?? String(user.id),
        displayName: (user as any).displayName || user.name || user.username,
        role: user.role ?? "student",
      });
    });
  });
}

// ─── Global Broadcasting Helper ─────────────────────────────────────────────────
export function broadcastGlobal(data: object) {
  for (const client of Array.from(clientMeta.keys())) {
    send(client, data);
  }
}

// ─── Main setup function ───────────────────────────────────────────────────────

export function setupChatWebSocket(httpServer: Server, sessionStore: Store) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/chat" });

  wss.on("connection", async (ws: WebSocket, req: any) => {
    // Auth
    const authResult = await resolveUserId(sessionStore, req);

    if (!authResult) {
      send(ws, {
        type: "error",
        message: "Unauthorized. Please log in and provide a valid token.",
      });
      ws.close(4001, "Unauthorized");
      return;
    }

    const { userId, firebaseUid, displayName, role } = authResult;

    const user = await storage.getUser(userId);
    if (!user) {
      send(ws, { type: "error", message: "User not found." });
      ws.close(4001, "User not found");
      return;
    }

    // Register client
    clientMeta.set(ws, {
      userId,
      firebaseUid,
      username: user.username,
      displayName,
      role,
      channels: new Set(),
    });

    // Rate limiting state per connection
    let messageTokens = 5;
    let lastRefill = Date.now();

    send(ws, {
      type: "connected",
      userId,
      firebaseUid,
      displayName,
      role,
    });

    // ─── Heartbeat ─────────────────────────────────────────────────────────
    let isAlive = true;
    ws.on("pong", () => {
      isAlive = true;
    });

    const heartbeatInterval = setInterval(() => {
      if (!isAlive) {
        // inactive client terminated (silent)
        return ws.terminate();
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    // ─── Message handler ───────────────────────────────────────────────────

    ws.on("message", async (raw: RawData) => {
      let event: IncomingEvent;

      try {
        event = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: "error", message: "Invalid JSON payload." });
        return;
      }

      const meta = clientMeta.get(ws);
      if (!meta) return;

      switch (event.type) {
        // ── join_channel ──────────────────────────────────────────────────
        case "join_channel": {
          const channelId = event.channelId;
          if (!channelId) {
            send(ws, { type: "error", message: "channelId is required for join_channel." });
            return;
          }

          const channel = await storage.getChannel(channelId);
          if (!channel) {
            send(ws, { type: "error", message: "Channel not found." });
            return;
          }

          // Access check
          if (channel.type === "dm") {
            if (!channel.name.includes(userId.toString())) {
              send(ws, { type: "error", message: "Access denied to this DM." });
              return;
            }
          } else if (channel.workspaceId) {
            const workspace = await storage.getWorkspace(channel.workspaceId);
            if (!workspace || !workspace.members.includes(userId)) {
              send(ws, { type: "error", message: "You are not a member of this workspace." });
              return;
            }
          }

          subscribeToChannel(ws, channelId);
          send(ws, { type: "joined_channel", channelId });

          broadcastToChannel(
            channelId,
            {
              type: "user_presence",
              userId,
              firebaseUid,
              displayName,
              status: "online",
              channelId,
            },
            ws
          );
          break;
        }

        // ── leave_channel ─────────────────────────────────────────────────
        case "leave_channel": {
          const channelId = event.channelId;
          if (!channelId) return;

          unsubscribeFromChannel(ws, channelId);
          send(ws, { type: "left_channel", channelId });

          broadcastToChannel(channelId, {
            type: "user_presence",
            userId,
            firebaseUid,
            displayName,
            status: "offline",
            channelId,
          });
          break;
        }

        // ── send_message ──────────────────────────────────────────────────
        case "send_message": {
          const {
            channelId,
            content,
            messageType = "text",
            fileUrl,
            senderRole,
            replyTo,
            mentions,
          } = event;

          if (!channelId || !content?.trim()) {
            send(ws, { type: "error", message: "channelId and content are required." });
            return;
          }

          if (!meta.channels.has(channelId)) {
            send(ws, { type: "error", message: "Join the channel before sending messages." });
            return;
          }

          // Rate limiting: 5 messages per 5 seconds
          const now = Date.now();
          const secondsPassed = (now - lastRefill) / 1000;
          if (secondsPassed > 5) {
            messageTokens = 5;
            lastRefill = now;
          }
          if (messageTokens <= 0) {
            send(ws, { type: "error", message: "You are sending messages too fast. Please wait." });
            return;
          }
          messageTokens--;

          try {
            const message = await storage.createMessage({
              channelId,
              authorId: userId,
              content: content.trim(),
              type: messageType as any,
              fileUrl: fileUrl ?? null,
              isHomework: messageType === "assignment",
              readBy: [],
              // Phase 3 extended fields
              ...(senderRole && { senderRole }),
              ...(replyTo && { replyTo }),
              ...(mentions && { mentions }),
            });

            const payload = {
              type: "new_message",
              message: {
                ...message,
                authorDisplayName: meta.displayName,
                senderRole: senderRole || meta.role,
              },
              channelId,
            };

            // Echo to sender + broadcast to subscribers
            send(ws, payload);
            broadcastToChannel(channelId, payload, ws);

            // Update unread counts for all OTHER subscribers in the channel
            const subs = channelSubscribers.get(channelId);
            if (subs) {
              for (const [subWs, subMeta] of Array.from(clientMeta.entries())) {
                if (subMeta.channels.has(channelId) && subMeta.firebaseUid !== firebaseUid) {
                  // Increment in DB
                  await (MongoChannel as any).findOneAndUpdate(
                    { id: channelId },
                    { $inc: { [`unreadCounts.${subMeta.firebaseUid}`]: 1 } }
                  );
                  // Real-time push to that client
                  if (subs.has(subWs)) {
                    send(subWs, {
                      type: "unread_updated",
                      channelId,
                      delta: 1,
                    });
                  }
                }
              }
            }

            // ── @AI Tutor ─────────────────────────────────────────────────
            if (content.trim().includes("@AI")) {
              (async () => {
                try {
                  broadcastToChannel(channelId, {
                    type: "user_typing",
                    userId: AI_TUTOR_ID,
                    displayName: AI_TUTOR_NAME,
                    channelId,
                  });

                  const aiResponse = await aiChat([
                    { role: "user", content: content.replace(/@AI/gi, "").trim() },
                  ]);

                  const aiMessage = await storage.createMessage({
                    channelId,
                    authorId: AI_TUTOR_ID,
                    content: aiResponse.content,
                    type: "text",
                    isHomework: false,
                    readBy: [userId],
                  });

                  broadcastToChannel(channelId, {
                    type: "new_message",
                    message: {
                      ...aiMessage,
                      authorDisplayName: AI_TUTOR_NAME,
                      senderRole: "teacher",
                      isAI: true,
                    },
                    channelId,
                  });
                } catch (error) {
                  console.error("[chat-ws] AI Tutor error:", error);
                }
              })();
            }
          } catch (err) {
            console.error("[chat-ws] send_message error:", err);
            send(ws, { type: "error", message: "Failed to save message." });
          }
          break;
        }

        // ── typing ────────────────────────────────────────────────────────
        case "typing": {
          const channelId = event.channelId;
          if (!channelId || !meta.channels.has(channelId)) return;

          broadcastToChannel(
            channelId,
            {
              type: "user_typing",
              userId,
              firebaseUid,
              displayName: meta.displayName,
              channelId,
            },
            ws
          );

          // Auto-update typingUsers in DB
          await (MongoChannel as any)
            .findOneAndUpdate({ id: channelId }, { $addToSet: { typingUsers: firebaseUid } })
            .catch(() => null);
          break;
        }

        // ── stop_typing ───────────────────────────────────────────────────
        case "stop_typing": {
          const channelId = event.channelId;
          if (!channelId) return;

          broadcastToChannel(
            channelId,
            {
              type: "user_stop_typing",
              userId,
              firebaseUid,
              displayName: meta.displayName,
              channelId,
            },
            ws
          );

          await (MongoChannel as any)
            .findOneAndUpdate({ id: channelId }, { $pull: { typingUsers: firebaseUid } })
            .catch(() => null);
          break;
        }

        // ── mark_read ─────────────────────────────────────────────────────
        case "mark_read": {
          const { messageId, channelId } = event;
          if (!messageId || !channelId) return;

          await storage.markMessageAsRead(messageId, userId);

          // Reset unread count in channel for this user
          await (MongoChannel as any)
            .findOneAndUpdate({ id: channelId }, { $set: { [`unreadCounts.${firebaseUid}`]: 0 } })
            .catch(() => null);

          broadcastToChannel(
            channelId,
            {
              type: "message_read",
              messageId,
              userId,
              firebaseUid,
              channelId,
            },
            ws
          );
          break;
        }

        // ── mark_delivered ────────────────────────────────────────────────
        case "mark_delivered": {
          const { messageId, channelId } = event;
          if (!messageId || !channelId) return;

          broadcastToChannel(
            channelId,
            {
              type: "message_delivered",
              messageId,
              userId,
              firebaseUid,
              channelId,
            },
            ws
          );
          break;
        }

        // ── answer_doubt ──────────────────────────────────────────────────
        case "answer_doubt": {
          const { messageId, channelId } = event;
          if (!messageId || !channelId) return;

          if (meta.role !== "teacher" && meta.role !== "principal" && meta.role !== "admin") {
            send(ws, { type: "error", message: "Only teachers can mark doubts as answered." });
            return;
          }

          (await (MongoChannel as any).findOneAndUpdate)
            ? null // fallback: could update message directly
            : null;

          // Broadcast doubt_answered event
          broadcastToChannel(channelId, {
            type: "doubt_answered",
            messageId,
            answeredBy: { userId, firebaseUid, displayName: meta.displayName },
            channelId,
          });
          break;
        }

        // ── pin_message ───────────────────────────────────────────────────
        case "pin_message": {
          const { messageId, channelId } = event;
          if (!messageId || !channelId) return;

          if (meta.role !== "teacher" && meta.role !== "principal" && meta.role !== "admin") {
            send(ws, { type: "error", message: "Only teachers can pin messages." });
            return;
          }

          await storage.pinMessage(channelId, messageId).catch(() => null);

          broadcastToChannel(channelId, {
            type: "message_pinned",
            messageId,
            pinnedBy: { userId, firebaseUid, displayName: meta.displayName },
            channelId,
          });
          break;
        }

        // ── live_class_event ──────────────────────────────────────────────
        case "live_class_event": {
          const { classId, action } = event;
          if (!classId || !action) return;

          if (meta.role !== "teacher" && meta.role !== "principal" && meta.role !== "admin") {
            send(ws, { type: "error", message: "Only teachers can trigger live class events." });
            return;
          }

          // For now, broadcast this event globally so any student who is online knows
          broadcastGlobal({
            type: "live_class_event",
            classId,
            action,
            triggeredBy: { userId, firebaseUid, displayName: meta.displayName },
          });
          break;
        }

        default:
          send(ws, { type: "error", message: `Unknown event type: ${(event as any).type}` });
      }
    });

    // ─── Cleanup on disconnect ─────────────────────────────────────────────
    ws.on("close", () => {
      clearInterval(heartbeatInterval);
      cleanupClient(ws);
    });
    ws.on("error", () => {
      clearInterval(heartbeatInterval);
      cleanupClient(ws);
    });
  });

  console.log("[chat-ws] WebSocket server attached at /ws/chat (Firebase token + session auth)");
  return wss;
}
