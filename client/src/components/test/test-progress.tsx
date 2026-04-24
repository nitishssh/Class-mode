import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestProgressProps {
  currentQuestionIndex: number;
  totalQuestions: number;
  timeLimitMinutes: number;
  onTimeUp: () => void;
}

export function TestProgress({
  currentQuestionIndex,
  totalQuestions,
  timeLimitMinutes,
  onTimeUp,
}: TestProgressProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onTimeUp]);

  const progressPercentage = totalQuestions > 0 ? (currentQuestionIndex / totalQuestions) * 100 : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-border bg-muted/50 px-6 py-4 backdrop-blur-md">
      <div className="flex w-1/3 flex-col gap-2">
        <div className="flex justify-between text-[11px] font-bold uppercase leading-none tracking-widest text-muted-foreground">
          <span>Progress</span>
          <span>
            {currentQuestionIndex} / {totalQuestions}
          </span>
        </div>
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute left-0 top-0 h-full bg-accent transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-2 transition-all duration-500",
            timeLeft < 60
              ? "animate-pulse border border-red-100 bg-red-50 text-red-600 shadow-sm shadow-red-100"
              : "border border-border bg-card text-foreground shadow-soft"
          )}
        >
          <Clock
            className={cn("h-4 w-4", timeLeft < 60 ? "text-red-500" : "text-accent")}
            strokeWidth={2.5}
          />
          <span className="font-mono text-lg font-bold tracking-tight">{formatTime(timeLeft)}</span>
        </div>
      </div>
    </div>
  );
}
