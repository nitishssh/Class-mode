import { WebSocketServer, WebSocket, type RawData } from "ws";
import type { Server } from "http";
import type { Store } from "express-session";
import { MessageStore } from "./message-store";

// ─── Constants ───────────────────────────────────────────────────────────────

const MESSAGEPAL_PORT = parseInt(process.env.MESSAGEPAL_PORT || "5002", 10);

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClientMeta {
  userId: number;
  username: string;
  role: string;
  connectedAt: Date;
}

interface IncomingEvent {
  type: "send_message" | "typing" | "mark_read" | "fetch_history" | "subscribe" | "unsubscribe";
  conversationId?: string;
  recipientId?: number;
  content?: string;
  messageId?: string;
  timestamp?: string;
}

interface OutgoingEvent {
  type: string;
  payload: any;
  timestamp: string;
}

// ─── State ───────────────────────────────────────────────────────────────────

/** userId → Set of subscribed WebSocket clients */
const userConnections = new Map<number, Set<WebSocket>>();

/** ws → metadata about the connected user */
const clientMeta = new Map<WebSocket, ClientMeta>();

/** Active conversations mapping */
const activeConversations = new Map<string, Set<number>>();

// ─── Message Store ───────────────────────────────────────────────────────────

const messageStore = new MessageStore();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastToUser(userId: number, data: object) {
  const connections = userConnections.get(userId);
  if (!connections) return;

  for (const client of Array.from(connections)) {
    send(client, data);
  }
}

function createConversationId(user1Id: number, user2Id: number): string {
  const ids = [user1Id, user2Id].sort((a, b) => a - b);
  return `conv_${ids[0]}_${ids[1]}`;
}

function validateSession(ws: WebSocket, sessionStore: Store): Promise<ClientMeta | null> {
  return new Promise((resolve) => {
    const sessionId = getSessionIdFromCookie(ws);
    if (!sessionId) {
      resolve(null);
      return;
    }

    sessionStore.get(sessionId, (err, session) => {
      if (err || !session || !session.userId) {
        resolve(null);
        return;
      }

      resolve({
        userId: session.userId,
        username: session.username,
        role: session.role,
        connectedAt: new Date(),
      });
    });
  });
}

function getSessionIdFromCookie(ws: WebSocket): string | null {
  const cookies = (ws as any).upgradeReq?.headers?.cookie;
  if (!cookies) return null;

  const match = cookies.match(/connect.sid=([^;]+)/);
  return match ? match[1] : null;
}

// ─── Event Handlers ──────────────────────────────────────────────────────────

async function handleSendMessage(ws: WebSocket, event: IncomingEvent, senderMeta: ClientMeta) {
  if (!event.recipientId || !event.content) {
    send(ws, {
      type: "error",
      message: "Recipient ID and content are required",
    });
    return;
  }

  try {
    const conversationId = createConversationId(senderMeta.userId, event.recipientId);

    // Store message
    const message = await messageStore.saveMessage({
      conversationId,
      senderId: senderMeta.userId,
      senderName: senderMeta.username,
      senderRole: senderMeta.role,
      recipientId: event.recipientId,
      content: event.content,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to both participants
    const outgoingMessage = {
      type: "message_received",
      payload: message,
      timestamp: new Date().toISOString(),
    };

    broadcastToUser(senderMeta.userId, outgoingMessage);
    broadcastToUser(event.recipientId, outgoingMessage);

    // Update conversation participant list
    if (!activeConversations.has(conversationId)) {
      activeConversations.set(conversationId, new Set());
    }
    activeConversations.get(conversationId)?.add(senderMeta.userId);
    activeConversations.get(conversationId)?.add(event.recipientId);
  } catch (error) {
    console.error("Error sending message:", error);
    send(ws, {
      type: "error",
      message: "Failed to send message",
    });
  }
}

async function handleTyping(ws: WebSocket, event: IncomingEvent, senderMeta: ClientMeta) {
  if (!event.recipientId) return;

  const typingEvent = {
    type: "user_typing",
    payload: {
      userId: senderMeta.userId,
      username: senderMeta.username,
      recipientId: event.recipientId,
    },
    timestamp: new Date().toISOString(),
  };

  broadcastToUser(event.recipientId, typingEvent);
}

async function handleMarkRead(ws: WebSocket, event: IncomingEvent, senderMeta: ClientMeta) {
  if (!event.messageId) return;

  try {
    await messageStore.markMessageAsRead(event.messageId, senderMeta.userId);

    // Notify sender that message was read
    const ack = {
      type: "message_read",
      payload: {
        messageId: event.messageId,
        readBy: senderMeta.userId,
        readAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    send(ws, ack);
  } catch (error) {
    console.error("Error marking message as read:", error);
  }
}

async function handleFetchHistory(ws: WebSocket, event: IncomingEvent, senderMeta: ClientMeta) {
  if (!event.conversationId) {
    send(ws, {
      type: "error",
      message: "Conversation ID is required",
    });
    return;
  }

  try {
    const messages = await messageStore.getConversationHistory(
      event.conversationId,
      senderMeta.userId,
      50 // limit
    );

    send(ws, {
      type: "history_response",
      payload: {
        conversationId: event.conversationId,
        messages,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    send(ws, {
      type: "error",
      message: "Failed to fetch message history",
    });
  }
}

function handleSubscribe(ws: WebSocket, event: IncomingEvent, senderMeta: ClientMeta) {
  if (!event.conversationId) return;

  // Add user to conversation subscribers
  if (!activeConversations.has(event.conversationId)) {
    activeConversations.set(event.conversationId, new Set());
  }
  activeConversations.get(event.conversationId)?.add(senderMeta.userId);

  send(ws, {
    type: "subscribed",
    payload: { conversationId: event.conversationId },
    timestamp: new Date().toISOString(),
  });
}

function handleUnsubscribe(ws: WebSocket, event: IncomingEvent, senderMeta: ClientMeta) {
  if (!event.conversationId) return;

  const subscribers = activeConversations.get(event.conversationId);
  if (subscribers) {
    subscribers.delete(senderMeta.userId);
    if (subscribers.size === 0) {
      activeConversations.delete(event.conversationId);
    }
  }

  send(ws, {
    type: "unsubscribed",
    payload: { conversationId: event.conversationId },
    timestamp: new Date().toISOString(),
  });
}

// ─── Main WebSocket Server ───────────────────────────────────────────────────

export async function setupMessagePalWebSocket(httpServer: Server, sessionStore: Store) {
  const wss = new WebSocketServer({
    noServer: true,
    path: "/messagepal",
  });

  httpServer.on("upgrade", (request, socket, head) => {
    if (request.url === "/messagepal") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (ws: WebSocket) => {
    console.log("New MessagePal WebSocket connection");

    // Validate session
    const userMeta = await validateSession(ws, sessionStore);
    if (!userMeta) {
      ws.close(4001, "Authentication required");
      return;
    }

    // Register client
    clientMeta.set(ws, userMeta);

    if (!userConnections.has(userMeta.userId)) {
      userConnections.set(userMeta.userId, new Set());
    }
    userConnections.get(userMeta.userId)?.add(ws);

    console.log(`User ${userMeta.username} (${userMeta.userId}) connected to MessagePal`);

    // Send welcome message
    send(ws, {
      type: "connected",
      payload: {
        userId: userMeta.userId,
        username: userMeta.username,
        role: userMeta.role,
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages
    ws.on("message", async (data: RawData) => {
      try {
        const event: IncomingEvent = JSON.parse(data.toString());
        const senderMeta = clientMeta.get(ws)!;

        switch (event.type) {
          case "send_message":
            await handleSendMessage(ws, event, senderMeta);
            break;
          case "typing":
            await handleTyping(ws, event, senderMeta);
            break;
          case "mark_read":
            await handleMarkRead(ws, event, senderMeta);
            break;
          case "fetch_history":
            await handleFetchHistory(ws, event, senderMeta);
            break;
          case "subscribe":
            handleSubscribe(ws, event, senderMeta);
            break;
          case "unsubscribe":
            handleUnsubscribe(ws, event, senderMeta);
            break;
          default:
            send(ws, {
              type: "error",
              message: `Unknown event type: ${event.type}`,
            });
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
        send(ws, {
          type: "error",
          message: "Invalid message format",
        });
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      const meta = clientMeta.get(ws);
      if (meta) {
        console.log(`User ${meta.username} disconnected from MessagePal`);

        // Remove from connections
        const userConns = userConnections.get(meta.userId);
        if (userConns) {
          userConns.delete(ws);
          if (userConns.size === 0) {
            userConnections.delete(meta.userId);
          }
        }

        // Clean up client metadata
        clientMeta.delete(ws);
      }
    });

    ws.on("error", (error) => {
      console.error("MessagePal WebSocket error:", error);
    });
  });

  console.log(`MessagePal WebSocket server listening on port ${MESSAGEPAL_PORT}`);
  return wss;
}

// ─── HTTP Server for MessagePal ──────────────────────────────────────────────

export async function startMessagePalServer() {
  const express = (await import("express")).default;
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "MessagePal",
      timestamp: new Date().toISOString(),
    });
  });

  // API endpoints will be added here
  app.get("/api/conversations/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const conversations = await messageStore.getUserConversations(userId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  const server = app.listen(MESSAGEPAL_PORT, () => {
    console.log(`MessagePal HTTP server running on port ${MESSAGEPAL_PORT}`);
  });

  return server;
}
