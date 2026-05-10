import { useState, useCallback, useRef } from "react";
import { StatelessChatRequest, StatelessEvent } from "@shared/study-arena";

export function useOrchestrator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [events, setEvents] = useState<StatelessEvent[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (request: StatelessChatRequest, onEvent: (event: StatelessEvent) => void) => {
      setIsGenerating(true);
      setEvents([]);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/ai-classroom/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error("Chat request failed");

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const json = line.slice(6);
              try {
                const event = JSON.parse(json) as StatelessEvent;
                setEvents((prev) => [...prev, event]);
                onEvent(event);
              } catch (e) {
                console.error("Failed to parse event:", e);
              }
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Orchestrator error:", error);
        }
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  return { sendMessage, stop, isGenerating, events };
}
