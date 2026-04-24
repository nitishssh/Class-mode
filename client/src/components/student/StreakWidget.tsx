import * as React from "react";
import { SmartCard } from "@/components/ui/smart-card";
import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

interface StreakWidgetProps {
  streak: number;
  activity: boolean[]; // 7 days activity status
  className?: string;
}

export const StreakWidget: React.FC<StreakWidgetProps> = ({
  streak,
  activity = [true, true, true, true, false, false, false],
  className,
}) => {
  const days = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <SmartCard type="streak" className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-full bg-energy-soft/30 p-2", streak > 0 && "animate-pulse")}>
            <Flame
              className={cn(
                "h-8 w-8",
                streak > 0 ? "fill-energy text-energy" : "text-muted-foreground/50"
              )}
            />
          </div>
          <div>
            <div className="streak-number leading-none">{streak}</div>
            <div className="text-sm font-medium text-muted-foreground">Day streak</div>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                activity[i] ? "bg-energy text-white shadow-sm" : "bg-muted text-muted-foreground"
              )}
            >
              {activity[i] && (
                <div className="absolute h-1.5 w-1.5 animate-ping rounded-full bg-white" />
              )}
              <span className="relative">{day}</span>
            </div>
          </div>
        ))}
      </div>

      {streak === 0 ? (
        <p className="mt-2 text-xs font-medium italic text-muted-foreground">
          Start your streak today! 🚀
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {streak >= 7 ? "You're on fire! 🔥 Keep it up." : "Day 7 is just a few tests away!"}
        </p>
      )}
    </SmartCard>
  );
};
