import { WS_URL } from '../constants/config';

export interface Message {
  id: string;
  senderId: number;
  recipientId: number;
  content: string;
  timestamp: Date;
  read: boolean;
}

export interface WSMessage {
  type: 'message' | 'typing' | 'read' | 'history' | 'error';
  data?: any;
  error?: string;
}

type MessageHandler = (message: Message) => void;
type TypingHandler = (userId: number, isTyping: boolean) => void;
type ErrorHandler = (error: string) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Set<MessageHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private isConnecting = false;

  connect(token?: string) {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    const wsUrl = WS_URL.replace('ws://', 'ws://').replace('wss://', 'wss://');
    
    try {
      this.ws = new WebSocket(`${wsUrl}/messagepal`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.errorHandlers.forEach((handler) => handler('Connection error'));
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  private handleMessage(data: WSMessage) {
    switch (data.type) {
      case 'message':
        if (data.data) {
          this.messageHandlers.forEach((handler) => handler(data.data));
        }
        break;
      case 'typing':
        if (data.data) {
          this.typingHandlers.forEach((handler) =>
            handler(data.data.userId, data.data.isTyping)
          );
        }
        break;
      case 'error':
        this.errorHandlers.forEach((handler) => handler(data.error || 'Unknown error'));
        break;
    }
  }

  sendMessage(recipientId: number, content: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'send_message',
          recipientId,
          content,
        })
      );
    }
  }

  sendTyping(recipientId: number, isTyping: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'typing',
          recipientId,
          isTyping,
        })
      );
    }
  }

  markAsRead(messageId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'mark_read',
          messageId,
        })
      );
    }
  }

  subscribe(conversationId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'subscribe',
          conversationId,
        })
      );
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler) {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.typingHandlers.clear();
    this.errorHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
