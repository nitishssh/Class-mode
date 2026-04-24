import * as React from "react";
import { SmartCard } from "@/components/ui/smart-card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

interface XPProgressBarProps {
  currentXP: number;
  nextLevelXP: number;
  level: number;
  className?: string;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({
  currentXP,
  nextLevelXP,
  level,
  className,
}) => {
  const progressPercentage = (currentXP / nextLevelXP) * 100;

  return (
    <SmartCard type="xp" className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current rank
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black leading-none text-foreground">
                Level {level}
              </span>
              <span className="text-sm font-semibold italic text-muted-foreground">Master</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold leading-none text-foreground">{currentXP} XP</div>
            <div className="text-xs font-medium text-muted-foreground">earned today</div>
          </div>
        </div>

        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute left-0 top-0 h-full rounded-full bg-energy"
            style={{
              boxShadow: "0 0 12px rgba(240, 165, 0, 0.4)",
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>Level {level}</span>
          <span className="text-accent">
            {Math.max(0, nextLevelXP - currentXP)} XP till Level {level + 1}
          </span>
          <span>Level {level + 1}</span>
        </div>
      </div>
    </SmartCard>
  );
};
