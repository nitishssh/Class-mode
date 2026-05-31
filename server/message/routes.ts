import { Router } from "express";
import { authenticateToken } from "../middleware";
import { createMessageStore } from "./factory";

const router = Router();
const messageStore = createMessageStore();

// All message routes require authentication
router.use(authenticateToken);

// Get user's conversations — scoped to the authenticated user
router.get("/conversations/:userId", async (req, res) => {
  try {
    const sessionUserId = (req as any).user?.id ?? req.session?.userId;
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    if (userId !== sessionUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversations = await messageStore.getUserConversations(userId);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get conversation history — always scoped to the authenticated user
router.get("/conversations/:conversationId/history", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50 } = req.query;
    const userId = (req as any).user?.id ?? req.session?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const messages = await messageStore.getConversationHistory(
      conversationId,
      userId,
      parseInt(limit as string)
    );

    res.json(messages);
  } catch (error) {
    console.error("Error fetching conversation history:", error);
    res.status(500).json({ error: "Failed to fetch conversation history" });
  }
});

// Get specific message
router.get("/messages/:messageId", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }

    const message = await messageStore.getMessageById(conversationId as string, messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ error: "Failed to fetch message" });
  }
});

// Send new message (HTTP fallback)
router.post("/messages", async (req, res) => {
  try {
    const {
      conversationId,
      senderName,
      senderRole,
      recipientId,
      content,
      messageType = "text",
      fileUrl,
    } = req.body;

    // senderId always comes from the authenticated session, never the request body
    const senderId = (req as any).user?.id ?? req.session?.userId;
    if (!senderId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!conversationId || !senderName || !recipientId || !content) {
      return res.status(400).json({
        error: "Missing required fields: conversationId, senderName, recipientId, content",
      });
    }

    const message = await messageStore.saveMessage({
      conversationId,
      senderId,
      senderName,
      senderRole: senderRole || "user",
      recipientId,
      content,
      messageType,
      fileUrl,
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Mark message as read — userId always from session, never body
router.patch("/messages/:messageId/read", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.body;
    const userId = (req as any).user?.id ?? req.session?.userId;

    if (!conversationId) {
      return res.status(400).json({ error: "Conversation ID is required" });
    }
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    await messageStore.markMessageAsRead(conversationId, messageId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

// Delete conversation for user — only the authenticated user can delete their own conversations
router.delete("/conversations/:conversationId/users/:userId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const sessionUserId = (req as any).user?.id ?? req.session?.userId;
    const userId = parseInt(req.params.userId);

    if (isNaN(userId) || userId !== sessionUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const success = await messageStore.deleteUserConversation(userId, conversationId);

    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Conversation not found" });
    }
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

// Get user's unread message count — scoped to authenticated user
router.get("/users/:userId/unread-count", async (req, res) => {
  try {
    const sessionUserId = (req as any).user?.id ?? req.session?.userId;
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    if (userId !== sessionUserId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const conversations = await messageStore.getUserConversations(userId);
    const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// Create or get conversation between two users — caller must be one of the two participants
router.post("/conversations/between-users", async (req, res) => {
  try {
    const sessionUserId = (req as any).user?.id ?? req.session?.userId;
    const { userId2 } = req.body;

    if (!userId2) {
      return res.status(400).json({ error: "userId2 is required" });
    }

    const otherId = parseInt(userId2);
    if (isNaN(otherId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Create conversation ID (sorted user IDs)
    const ids = [sessionUserId, otherId].sort((a, b) => a - b);
    const conversationId = `conv_${ids[0]}_${ids[1]}`;

    // Return conversation ID - actual conversation will be created when first message is sent
    res.json({ conversationId });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

export default router;
