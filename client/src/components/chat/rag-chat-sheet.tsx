import React, { useState, useRef, useEffect } from "react";
import { X, Send, Book, FileText, ChevronDown, Sparkles, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "@/lib/i18n";

interface SourceSnippet {
  id: string;
  title: string;
  type?: "quiz" | "notes" | "chat_history";
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system-error";
  content: string;
  sources?: SourceSnippet[];
  retryPayload?: { messageText: string; level: number };
}

interface RagChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  initialPrompt?: string;
  conceptName?: string;
}

export function RagChatSheet({ isOpen, onClose, subjectName, initialPrompt, conceptName }: RagChatSheetProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // Graduated hint level for the *current* problem. Starts at 0 (no help yet);
  // the student must deliberately unlock each level. Resets when they make a
  // fresh attempt, so help is always earned by trying first.
  const [hintLevel, setHintLevel] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const MAX_HINT_LEVEL = 4;
  const HINT_LABELS = ["Nudge", "Strategy", "First step", "Worked example"];

  // Set initial prompt or welcome message
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt) {
        setInput(initialPrompt);
      }

      if (messages.length === 0) {
        setMessages([
          {
            id: "welcome",
            role: "assistant",
            content: t(
              "chat.welcomeMessage",
              "Hi! I'm your **{subjectName}** tutor. I won't just hand you answers — I'll help you work them out so it actually sticks. Tell me what you're working on and what you've tried so far. Stuck? Use **Unlock a hint** for graduated help."
            ).replace("{subjectName}", subjectName),
          },
        ]);
      }
    }
  }, [isOpen, initialPrompt, subjectName, messages.length, t]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Core sender. `level` is the hint level to send to the tutor for this turn.
  const sendMessage = async (messageText: string, level: number) => {
    if (!messageText || isTyping) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: messageText };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          subject: subjectName,
          concept: conceptName,
          hintLevel: level,
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
      const errorMsg: Message = {
        id: (Date.now() + 2).toString() + "-error",
        role: "system-error",
        content: "Failed to connect to AI Tutor. Check your internet connection and try again.",
        retryPayload: { messageText, level },
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleRetry = (msgId: string, retryPayload?: { messageText: string; level: number }) => {
    if (!retryPayload || isTyping) return;
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    void sendMessage(retryPayload.messageText, retryPayload.level);
  };

  // A typed message is a fresh attempt → reset the hint ladder so help must be
  // re-earned by trying first.
  const handleSend = () => {
    const messageText = input.trim();
    if (!messageText || isTyping) return;
    setInput("");
    setHintLevel(0);
    void sendMessage(messageText, 0);
  };

  // Deliberately unlock the next graduated hint level.
  const handleUnlockHint = () => {
    if (isTyping || hintLevel >= MAX_HINT_LEVEL) return;
    const nextLevel = hintLevel + 1;
    setHintLevel(nextLevel);
    void sendMessage(
      `I'm stuck — can you give me a level ${nextLevel} hint (${HINT_LABELS[nextLevel - 1]}) without giving the full answer?`,
      nextLevel
    );
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
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-10 opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/30 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/10 bg-accent-soft shadow-soft">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h3 className="font-display text-sm text-foreground">
                {conceptName ? `${conceptName} • ` : t("chat.tutorTitle", "Class Mode Tutor • ")}
                {subjectName}
              </h3>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </span>
                <span className="px-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                  {t("chat.activeLearning", "Active Learning Mode")}
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
              {msg.role === "system-error" ? (
                <div className="mx-auto flex max-w-[85%] flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 shadow-soft">
                  <p className="font-body text-xs text-red-700 leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.retryPayload && (
                    <Button
                      onClick={() => handleRetry(msg.id, msg.retryPayload)}
                      disabled={isTyping}
                      variant="outline"
                      size="sm"
                      className="w-fit h-8 rounded-lg border-red-300 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 hover:text-red-800 disabled:opacity-40"
                    >
                      Retry Attempt
                    </Button>
                  )}
                </div>
              ) : msg.role === "user" ? (
                msg.content.startsWith("I'm stuck — can you give me a level") ? (
                  <div className="mx-auto my-2 rounded-full bg-amber-50 px-4 py-1.5 text-center font-body text-[11px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200/50 shadow-soft">
                    {msg.content.includes("level 1") && "Unlocked: Level 1 Hint (Nudge)"}
                    {msg.content.includes("level 2") && "Unlocked: Level 2 Hint (Strategy)"}
                    {msg.content.includes("level 3") && "Unlocked: Level 3 Hint (First step)"}
                    {msg.content.includes("level 4") && "Unlocked: Level 4 Hint (Worked example)"}
                  </div>
                ) : (
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-tr-sm border border-accent/10 bg-accent-soft px-5 py-3.5 font-body text-sm leading-relaxed text-foreground shadow-soft">
                    {msg.content}
                  </div>
                )
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
          {/* Graduated hint control — help is unlocked one level at a time, only
              when the student deliberately asks. Attempt-first by design. */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_HINT_LEVEL }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-5 rounded-full transition-colors",
                    i < hintLevel ? "bg-amber-500" : "bg-muted-foreground/20"
                  )}
                  title={HINT_LABELS[i]}
                />
              ))}
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {hintLevel === 0
                  ? t("chat.tryFirst", "Try first")
                  : t("chat.hintLevel", "Hint {n} • {label}")
                      .replace("{n}", String(hintLevel))
                      .replace("{label}", HINT_LABELS[hintLevel - 1] ?? "")}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnlockHint}
              disabled={isTyping || hintLevel >= MAX_HINT_LEVEL}
              className="h-11 md:h-8 gap-1.5 rounded-lg border-amber-500/30 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-40 px-4 md:px-3"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              {hintLevel >= MAX_HINT_LEVEL
                ? t("chat.maxHint", "Max hint reached")
                : t("chat.unlockHint", "Unlock a hint")}
            </Button>
          </div>
          <div className="relative flex items-end rounded-2xl border border-border bg-muted shadow-inner transition-all focus-within:border-accent/40 focus-within:ring-2 focus-within:ring-accent/5">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder", "Ask me anything about your subjects...")}
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
              {t("chat.guidedLearning", "Guided learning — answers you earn, not answers you're given")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
