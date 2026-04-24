import * as React from "react";
import { cn } from "@/lib/utils";

const CARD_STYLES = {
  flat: "bg-muted border border-border shadow-soft",
  elevated: "bg-muted border border-border shadow-card",
  streak: "bg-gradient-streak border border-yellow-200/40 shadow-streak",
  xp: "bg-gradient-xp border border-accent/20 shadow-xp",
  challenge: "bg-gradient-challenge border border-green-200/40 shadow-challenge",
  math: "bg-gradient-math border border-indigo-200/40",
  physics: "bg-gradient-physics border border-blue-200/40",
  chemistry: "bg-gradient-chemistry border border-teal-200/40",
  biology: "bg-gradient-biology border border-green-200/40",
  english: "bg-gradient-english border border-amber-200/40",
  history: "bg-gradient-history border border-orange-200/40",
};

export interface SmartCardProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: keyof typeof CARD_STYLES;
  hover?: boolean;
}

const SmartCard = React.forwardRef<HTMLDivElement, SmartCardProps>(
  ({ type = "flat", hover = true, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl p-5 transition-all duration-200 ease-in-out",
          CARD_STYLES[type],
          hover && "cursor-pointer hover:scale-[1.01] hover:shadow-card",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

SmartCard.displayName = "SmartCard";

export { SmartCard };
