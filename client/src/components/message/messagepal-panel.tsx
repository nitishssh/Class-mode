import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageCircle,
  Send,
  Users,
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  Loader2,
} from "lucide-react";
import { useMessagePalWebSocket } from "./use-messagepal-ws";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";

interface User {
  id: number;
  name: string;
  role: string;
  avatar?: string;
}

interface ConversationPreview {
  id: string;
  participants: User[];
  lastMessage?: {
    content: string;
    timestamp: string;
    senderName: string;
  };
  unreadCount: number;
}

interface Conversation {
  id: string;
  participants: User[];
  lastMessage?: {
    id: string;
    content: string;
    timestamp: string;
    senderName: string;
    senderId: number;
  };
  unreadCount: number;
}

export function MessageSidebar() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const { currentUser } = useFirebaseAuth();
  const userId = (currentUser?.profile as any)?.id as number | undefined;
  const {
    conversations,
    activeConversation,
    setActiveConversation,
    subscribeToConversation,
    unsubscribeFromConversation,
  } = useMessagePalWebSocket(userId);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchTerm) return true;
    return conv.participants.some((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  const handleConversationClick = (conversationId: string) => {
    if (activeConversation === conversationId) {
      unsubscribeFromConversation(conversationId);
      setSelectedConversation(null);
    } else {
      if (activeConversation) {
        unsubscribeFromConversation(activeConversation);
      }
      subscribeToConversation(conversationId);
      setSelectedConversation(conversationId);
    }
  };

  return (
    <div className="flex h-full flex-col border-r bg-background">
      {/* Header */}
      <div className="border-b p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageCircle className="h-5 w-5" />
            Messages
          </h2>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {!userId ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <MessageCircle className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm">Start a conversation with someone</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const otherParticipant = conversation.participants.find((p) => p.id !== userId);
              const isActive = activeConversation === conversation.id;

              return (
                <button
                  key={conversation.id}
                  onClick={() => handleConversationClick(conversation.id)}
                  className={`w-full rounded-lg p-3 text-left transition-colors ${
                    isActive
                      ? "border border-primary/20 bg-primary/10"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={otherParticipant?.avatar} />
                      <AvatarFallback>
                        {otherParticipant?.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="truncate font-medium">{otherParticipant?.name}</h3>
                        {conversation.unreadCount > 0 && (
                          <Badge variant="default" className="h-5 px-2">
                            {conversation.unreadCount}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {conversation.lastMessage
                          ? `${conversation.lastMessage.senderName}: ${conversation.lastMessage.content}`
                          : "No messages yet"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function MessageChatWindow() {
  const [message, setMessage] = useState("");
  const { currentUser } = useFirebaseAuth();
  const userId = (currentUser?.profile as any)?.id as number | undefined;
  const {
    messages,
    activeConversation,
    conversations,
    sendMessage,
    sendTyping,
    markMessageAsRead,
  } = useMessagePalWebSocket(userId);

  // Resolve recipient from active conversation participants
  const activeConv = conversations.find((c) => c.id === activeConversation);
  const recipientId = activeConv?.participants.find((p) => p.id !== userId)?.id ?? 0;

  const handleSend = () => {
    if (!message.trim() || !activeConversation) return;

    if (sendMessage(recipientId, message.trim())) {
      setMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mark messages as read when chat window is active
  useEffect(() => {
    if (activeConversation) {
      messages.forEach((msg) => {
        if (!msg.isRead && msg.recipientId === userId) {
          markMessageAsRead(msg.id);
        }
      });
    }
  }, [activeConversation, messages, markMessageAsRead, userId]);

  if (!activeConversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-background">
        <MessageCircle className="mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-xl font-semibold">No conversation selected</h3>
        <p className="text-muted-foreground">
          Select a conversation from the sidebar to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-background">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">John Doe</h3>
            <p className="text-sm text-muted-foreground">Online</p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.senderId === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  msg.senderId === userId ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {msg.senderId !== userId && (
                  <p className="mb-1 text-xs font-medium">{msg.senderName}</p>
                )}
                <p className="text-sm">{msg.content}</p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span className="text-xs opacity-70">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {msg.senderId === userId &&
                    (msg.isRead ? (
                      <CheckCheck className="h-3 w-3" />
                    ) : (
                      <Check className="h-3 w-3" />
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t p-4">
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Smile className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <Input
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="w-full"
            />
          </div>
          <Button onClick={handleSend} disabled={!message.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MessagePanel() {
  const { currentUser } = useFirebaseAuth();
  const userId = (currentUser?.profile as any)?.id as number | undefined;

  if (!userId) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-background">
      <div className="w-80 flex-shrink-0">
        <MessageSidebar />
      </div>
      <Separator orientation="vertical" />
      <MessageChatWindow />
    </div>
  );
}
