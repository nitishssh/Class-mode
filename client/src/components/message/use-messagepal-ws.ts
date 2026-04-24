import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
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
  messageType: string;
  fileUrl?: string;
}

interface Conversation {
  id: string;
  participants: { id: number; name: string; role: string; avatar?: string }[];
  lastMessage?: Message;
  unreadCount: number;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  message?: string;
  timestamp: string;
}

export function useMessagePalWebSocket(currentUserId?: number) {
  const [isConnected, setIsConnected] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.port
        ? `${window.location.hostname}:${window.location.port}`
        : window.location.hostname;
      const ws = new WebSocket(`${protocol}//${host}/message`);

      ws.onopen = () => {
        console.log("Message WebSocket connected");
        setIsConnected(true);
        reconnectTimeoutRef.current = null;
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          handleMessage(data);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        console.log("Message WebSocket disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (!reconnectTimeoutRef.current) {
          const reconnect = () => {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log("Attempting to reconnect to Message...");
              connect();
            }, 3000);
          };
          reconnect();
        }
      };

      ws.onerror = (error) => {
        console.error("Message WebSocket error:", error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to connect to Message WebSocket:", error);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((recipientId: number, content: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error("WebSocket not connected");
      return false;
    }

    const message = {
      type: "send_message",
      recipientId,
      content,
    };

    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  const sendTyping = useCallback((recipientId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "typing",
      recipientId,
    };

    wsRef.current.send(JSON.stringify(message));

    // Clear existing timeout and set new one
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      // Stop typing indicator after delay
    }, 1000);
  }, []);

  const markMessageAsRead = useCallback((messageId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "mark_read",
      messageId,
    };

    wsRef.current.send(JSON.stringify(message));
  }, []);

  const fetchConversationHistory = useCallback((conversationId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "fetch_history",
      conversationId,
    };

    wsRef.current.send(JSON.stringify(message));
  }, []);

  const subscribeToConversation = useCallback((conversationId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const message = {
      type: "subscribe",
      conversationId,
    };

    wsRef.current.send(JSON.stringify(message));
    setActiveConversation(conversationId);
  }, []);

  const unsubscribeFromConversation = useCallback(
    (conversationId: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const message = {
        type: "unsubscribe",
        conversationId,
      };

      wsRef.current.send(JSON.stringify(message));
      if (activeConversation === conversationId) {
        setActiveConversation(null);
      }
    },
    [activeConversation]
  );

  const handleMessage = useCallback((data: WebSocketMessage) => {
    switch (data.type) {
      case "connected":
        console.log("Connected to Message server:", data.payload);
        break;

      case "message_received":
        const newMessage: Message = data.payload;
        setMessages((prev) => [...prev, newMessage]);

        // Update conversations list
        setConversations((prev) => {
          const existing = prev.find((conv) => conv.id === newMessage.conversationId);
          if (existing) {
            return prev.map((conv) =>
              conv.id === newMessage.conversationId
                ? { ...conv, lastMessage: newMessage, unreadCount: conv.unreadCount + 1 }
                : conv
            );
          }
          return prev;
        });
        break;

      case "user_typing":
        const { userId } = data.payload;
        setTypingUsers((prev) => new Set(prev).add(userId));

        // Auto-remove typing indicator after delay
        setTimeout(() => {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }, 3000);
        break;

      case "message_read":
        const { messageId, readBy } = data.payload;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, readBy: [...msg.readBy, readBy], isRead: true } : msg
          )
        );
        break;

      case "history_response":
        setMessages(data.payload.messages);
        break;

      case "error":
        console.error("Message error:", data.message || data.payload);
        break;

      default:
        console.log("Unknown message type:", data.type);
    }
  }, []);

  // Load initial conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const response = await fetch("/api/messagepal/conversations");
        if (response.ok) {
          const data = await response.json();
          setConversations(data);
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    };

    if (isConnected) {
      loadConversations();
    }
  }, [isConnected]);

  // Connect on mount (once userId is resolved), disconnect on unmount
  useEffect(() => {
    if (!currentUserId) return; // wait until userId is resolved
    connect();

    return () => {
      disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [connect, disconnect, currentUserId]);

  return {
    isConnected,
    conversations,
    activeConversation,
    messages,
    typingUsers,
    sendMessage,
    sendTyping,
    markMessageAsRead,
    fetchConversationHistory,
    subscribeToConversation,
    unsubscribeFromConversation,
    setActiveConversation,
  };
}
