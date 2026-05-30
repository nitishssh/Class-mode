import React, { useState, useEffect, useRef } from "react";
import { Sparkles, MessageSquare, Send, X, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SocraticAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeText, setNudgeText] = useState("Have you considered the basic principles we covered in the last lesson?");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading && query) {
      // Fetch a nudge while waiting
      fetch(`/api/lifecycle/doubts/nudge?topic=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => {
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
      setShowNudge(false);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isLoading, query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setMessages(prev => [...prev, { role: 'user', content: query }]);
    const currentQuery = query;
    setIsLoading(true);

    // AI logic placeholder (will link to real backend later)
    // For T6 validation, we simulate a delay
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Regarding "${currentQuery}": That's a great question. Before I explain, what do you already know about this topic? Thinking about the basics can often lead to the answer.` 
      }]);
      setIsLoading(false);
      setQuery("");
    }, 8000); 
  };

  return (
    <>
      {/* Floating Button for Mobile */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 h-14 w-14 rounded-full bg-accent shadow-modal lg:hidden z-50"
      >
        <Sparkles className="h-6 w-6 text-white" />
      </Button>

      {/* Sidebar/Drawer */}
      {isOpen && <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setIsOpen(false)} />}
      
      <Card className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-96 z-[70] transition-transform duration-300 transform shadow-modal border-l border-border",
        isOpen ? "translate-x-0" : "translate-x-full",
        "lg:relative lg:translate-x-0 lg:w-full lg:shadow-none lg:border lg:bg-card/50"
      )}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Socratic Assistant
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 lg:hidden">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col h-[calc(100vh-10rem)] lg:h-[400px] p-4">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <HelpCircle className="h-10 w-10 text-muted-foreground/20 mb-3" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I'm here to help you think, not just give answers. What's confusing you right now?
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn(
                "p-3 rounded-2xl text-xs leading-relaxed shadow-sm",
                m.role === 'user' ? "bg-accent text-white ml-6" : "bg-background border border-border text-foreground mr-6"
              )}>
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div className="bg-muted/50 border border-border p-3 rounded-2xl mr-6 text-[10px] text-muted-foreground">
                <div className="flex gap-1 mb-1">
                  <span className="h-1 w-1 bg-accent rounded-full animate-bounce" />
                  <span className="h-1 w-1 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="h-1 w-1 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
                Assistant is thinking...
                {showNudge && (
                  <div className="mt-2 text-accent font-bold animate-fade-in">
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
              className="rounded-full bg-background border-border text-xs h-9"
            />
            <Button type="submit" size="icon" className="rounded-full h-9 w-9 flex-shrink-0 bg-accent hover:bg-accent-hover shadow-soft">
              <Send className="h-4 w-4 text-white" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
