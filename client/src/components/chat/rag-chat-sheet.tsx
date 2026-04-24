import { useState, useRef, useEffect } from "react";
import { X, Send, Book, FileText, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface SourceSnippet {
  id: string;
  title: string;
  type?: "quiz" | "notes" | "chat_history";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceSnippet[];
}

interface RagChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  initialPrompt?: string;
}

export function RagChatSheet({ isOpen, onClose, subjectName, initialPrompt }: RagChatSheetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Set initial prompt if provided when opening
  useEffect(() => {
    if (isOpen && initialPrompt) {
      setInput(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    const messageText = input.trim();
    if (!messageText || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: messageText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok) throw new Error("Failed to get AI response");

      const data = await response.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error("AI chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-ink-900/10 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          "animate-fade-in-up fixed inset-x-0 bottom-0 z-50 flex h-[85vh] w-full transform flex-col rounded-t-3xl border border-border bg-card shadow-card transition-all duration-500 ease-out md:inset-x-auto md:bottom-8 md:right-8 md:top-auto md:h-[680px] md:w-[480px] md:rounded-2xl",
          isOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-10 opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/10 bg-accent-soft shadow-soft">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-sm text-foreground">EduAI Tutor • {subjectName}</h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </span>
                <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  Active Learning Mode
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="h-5 w-5 md:hidden" />
            <X className="hidden h-5 w-5 md:block" />
          </Button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 space-y-8 overflow-y-auto scroll-smooth bg-muted/10 p-6"
        >
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex w-full flex-col gap-2")}>
              {msg.role === "user" ? (
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm border border-accent/10 bg-accent-soft px-5 py-3.5 font-body text-sm leading-relaxed text-foreground shadow-soft">
                  {msg.content}
                </div>
              ) : (
                <div className="mr-auto flex w-full max-w-[95%] flex-col gap-4">
                  <div className="prose prose-sm prose-stone max-w-none font-body leading-relaxed text-muted-foreground md:text-base">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>

                  {/* Citations Pill */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 border-t border-dashed border-border pt-2">
                      {msg.sources.map((src) => (
                        <div
                          key={src.id}
                          className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted px-2.5 py-1 transition-all hover:bg-muted/80 hover:shadow-soft"
                        >
                          {src.type === "notes" ? (
                            <FileText className="h-3 w-3 text-accent" />
                          ) : (
                            <Book className="h-3 w-3 text-amber-600" />
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-foreground">
                            {src.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center gap-1.5 px-2 py-2">
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-accent opacity-20"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-accent opacity-40"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full bg-accent opacity-60"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 border-t border-border bg-card p-5">
          <div className="relative flex items-end rounded-2xl border border-border bg-muted shadow-inner transition-all focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your subjects..."
              className="max-h-[160px] min-h-[56px] w-full resize-none border-0 bg-transparent py-4 pl-5 pr-14 font-body text-sm leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0 md:text-base"
              rows={1}
            />
            <div className="absolute bottom-3 right-3">
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                size="icon"
                className={cn(
                  "h-10 w-10 rounded-xl shadow-soft transition-all",
                  input.trim() && !isTyping
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 opacity-40">
            <Sparkles className="h-3 w-3 text-accent" />
            <span className="text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              AI generated insights for faster learning
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
