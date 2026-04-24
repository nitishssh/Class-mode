import { Router } from "express";
import { CassandraMessageStore } from "./cassandra-message-store";

const router = Router();
const messageStore = new CassandraMessageStore();

// Get user's conversations
router.get("/conversations/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const conversations = await messageStore.getUserConversations(userId);
    res.json(conversations);
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get conversation history
router.get("/conversations/:conversationId/history", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId, limit = 50 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const messages = await messageStore.getConversationHistory(
      conversationId,
      parseInt(userId as string),
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
      senderId,
      senderName,
      senderRole,
      recipientId,
      content,
      messageType = "text",
      fileUrl,
    } = req.body;

    // Validate required fields
    if (!conversationId || !senderId || !senderName || !recipientId || !content) {
      return res.status(400).json({
        error:
          "Missing required fields: conversationId, senderId, senderName, recipientId, content",
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

// Mark message as read
router.patch("/messages/:messageId/read", async (req, res) => {
  try {
    const { messageId } = req.params;
    const { conversationId, userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({ error: "Conversation ID and User ID are required" });
    }

    await messageStore.markMessageAsRead(conversationId, messageId, parseInt(userId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

// Delete conversation for user
router.delete("/conversations/:conversationId/users/:userId", async (req, res) => {
  try {
    const { conversationId, userId } = req.params;

    const success = await messageStore.deleteUserConversation(parseInt(userId), conversationId);

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

// Get user's unread message count
router.get("/users/:userId/unread-count", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const conversations = await messageStore.getUserConversations(userId);
    const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

    res.json({ unreadCount: totalUnread });
  } catch (error) {
    console.error("Error fetching unread count:", error);
    res.status(500).json({ error: "Failed to fetch unread count" });
  }
});

// Create or get conversation between two users
router.post("/conversations/between-users", async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;

    if (!userId1 || !userId2) {
      return res.status(400).json({ error: "Both user IDs are required" });
    }

    // Create conversation ID (sorted user IDs)
    const ids = [parseInt(userId1), parseInt(userId2)].sort((a, b) => a - b);
    const conversationId = `conv_${ids[0]}_${ids[1]}`;

    // Return conversation ID - actual conversation will be created when first message is sent
    res.json({ conversationId });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

export default router;
