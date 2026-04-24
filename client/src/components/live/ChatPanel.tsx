import { useState, useCallback, useRef, useEffect } from "react";
import { useAppMessage, useLocalSessionId, useLocalParticipant } from "@daily-co/daily-react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  isLocal: boolean;
}

export function ChatPanel() {
  const localSessionId = useLocalSessionId();
  const localParticipant = useLocalParticipant();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const localName = localParticipant?.user_name || "Me";

  const sendAppMessage = useAppMessage({
    onAppMessage: useCallback((ev: any) => {
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          senderId: ev.fromId,
          senderName: ev.data.name || "User",
          text: ev.data.text,
          timestamp: new Date(),
          isLocal: false,
        },
      ]);
    }, []),
  });

  const handleSend = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!newMessage.trim() || !localSessionId) return;

      // Send to other participants
      sendAppMessage({ text: newMessage.trim(), name: localName });

      // Add locally immediately
      setMessages((msgs) => [
        ...msgs,
        {
          id: crypto.randomUUID(),
          senderId: localSessionId,
          senderName: localName,
          text: newMessage.trim(),
          timestamp: new Date(),
          isLocal: true,
        },
      ]);
      setNewMessage("");
    },
    [newMessage, sendAppMessage, localSessionId, localName]
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-full w-80 shrink-0 flex-col bg-zinc-950">
      <div className="border-b border-zinc-800 p-4 font-semibold text-white">In-Call Chat</div>

      <div
        ref={scrollRef}
        className="custom-scrollbar flex flex-1 flex-col space-y-4 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="mt-10 text-center text-sm text-zinc-500">No messages yet. Say hi!</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex max-w-[85%] flex-col ${msg.isLocal ? "items-end self-end" : "items-start self-start"}`}
            >
              <span className="mb-1 text-xs text-zinc-500">
                {msg.isLocal ? "You" : msg.senderName}
              </span>
              <div
                className={`rounded-xl px-3 py-2 text-sm ${msg.isLocal ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-zinc-800 text-zinc-100"}`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950 p-4">
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="h-10 flex-1 border-zinc-700 bg-zinc-900 text-zinc-100 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim()}
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
