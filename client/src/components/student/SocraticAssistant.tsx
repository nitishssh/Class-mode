import React, { useState, useEffect, useRef } from "react";
import { Sparkles, Send, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SocraticAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeText, setNudgeText] = useState(
    "Have you considered the basic principles we covered in the last lesson?"
  );
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading && query) {
      // Fetch a nudge while waiting
      fetch(`/api/lifecycle/doubts/nudge?topic=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.nudge) {
            setNudgeText(data.nudge);
          }
        })
        .catch(console.error);

      timerRef.current = setTimeout(() => {
        setShowNudge(true);
      }, 5000);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimeout(() => setShowNudge(false), 0);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: query }]);
    const currentQuery = query;
    setIsLoading(true);

    // AI logic placeholder (will link to real backend later)
    // For T6 validation, we simulate a delay
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Regarding "${currentQuery}": That's a great question. Before I explain, what do you already know about this topic? Thinking about the basics can often lead to the answer.`,
        },
      ]);
      setIsLoading(false);
      setQuery("");
    }, 8000);
  };

  return (
    <>
      {/* Floating Button for Mobile */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-50 h-14 w-14 rounded-full bg-accent shadow-modal lg:hidden"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>

      {/* Sidebar/Drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <Card
        className={cn(
          "fixed inset-y-0 right-0 z-[70] w-full transform border-l border-border shadow-modal transition-transform duration-300 sm:w-96",
          isOpen ? "translate-x-0" : "translate-x-full",
          "lg:relative lg:w-full lg:translate-x-0 lg:border lg:bg-card/50 lg:shadow-none"
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Socratic Assistant
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8 lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex h-[calc(100vh-10rem)] flex-col p-4 lg:h-[400px]">
          <div className="custom-scrollbar mb-4 flex-1 space-y-4 overflow-y-auto pr-2">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                <HelpCircle className="mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  I'm here to help you think, not just give answers. What's confusing you right now?
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl p-3 text-xs leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "ml-6 bg-accent text-white"
                    : "mr-6 border border-border bg-background text-foreground"
                )}
              >
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div className="mr-6 rounded-2xl border border-border bg-muted/50 p-3 text-[10px] text-muted-foreground">
                <div className="mb-1 flex gap-1">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-accent" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:0.2s]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-accent [animation-delay:0.4s]" />
                </div>
                Assistant is thinking...
                {showNudge && (
                  <div className="animate-fade-in mt-2 font-bold text-accent">
                    💡 Nudge: {nudgeText}
                  </div>
                )}
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Ask a doubt..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 rounded-full border-border bg-background text-xs"
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 flex-shrink-0 rounded-full bg-accent shadow-soft hover:bg-accent-hover"
            >
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
