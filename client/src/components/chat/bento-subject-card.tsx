import { ArrowRight, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BentoSubjectCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  tag?: string;
  progressPercentage?: number;
  weakness?: string;
  isLocked?: boolean;
  onAction?: (action: "revise" | "practice" | "chat") => void;
  className?: string;
}

export function BentoSubjectCard({
  title,
  description,
  icon,
  tag,
  progressPercentage = 0,
  weakness,
  isLocked = false,
  onAction,
  className,
}: BentoSubjectCardProps) {
  // SVG properties for the progress ring
  const strokeWidth = 3;
  const radius = 22 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <div
      className={cn(
        "duration-400 group relative flex h-[320px] w-full flex-col overflow-hidden rounded-2xl bg-card p-6 transition-all ease-out",
        "border border-border shadow-soft",
        !isLocked && "hover:-translate-y-1 hover:shadow-card",
        className
      )}
    >
      {/* Subtle Gradient Hint */}
      {!isLocked && (
        <div className="absolute right-0 top-0 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 opacity-0 blur-3xl transition-opacity duration-1000 group-hover:opacity-100" />
      )}

      {/* Top Section */}
      <div className="relative z-10 mb-4 flex flex-1 flex-col items-center justify-center">
        {tag && (
          <div className="absolute right-0 top-0">
            <span className="rounded-md bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
              {tag}
            </span>
          </div>
        )}

        {weakness && !isLocked && (
          <div className="absolute left-0 top-0">
            <div className="flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 shadow-sm">
              <AlertTriangle className="h-3 w-3 text-amber-600" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                {weakness}
              </span>
            </div>
          </div>
        )}

        <div className="relative flex h-32 w-32 items-center justify-center transition-transform duration-700 ease-out group-hover:scale-110">
          <div className="relative z-10 flex h-full w-full items-center justify-center opacity-80 transition-opacity group-hover:opacity-100">
            {icon}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="relative z-10 flex flex-col gap-2 transition-transform duration-500 ease-out group-hover:-translate-y-1">
        <div className="flex items-end justify-between">
          <div className="flex flex-1 flex-col gap-1 pr-4">
            <h3 className="font-display text-xl leading-none tracking-tight text-foreground transition-colors group-hover:text-accent">
              {title}
            </h3>
            <p className="line-clamp-1 font-body text-sm leading-snug text-muted-foreground">
              {description}
            </p>
          </div>

          {/* Progress Ring or Lock */}
          <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border bg-muted shadow-inner">
            {isLocked ? (
              <Lock className="h-4 w-4 text-muted-foreground/50" />
            ) : (
              <div className="relative flex h-full w-full items-center justify-center">
                <svg className="absolute inset-0 h-full w-full -rotate-90 p-1" viewBox="0 0 44 44">
                  <circle
                    className="stroke-current text-cream-400"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx="22"
                    cy="22"
                  />
                  <circle
                    className={cn(
                      "stroke-current transition-all duration-1000 ease-out",
                      "text-accent"
                    )}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx="22"
                    cy="22"
                    style={{ strokeDasharray: circumference, strokeDashoffset }}
                  />
                </svg>
                <div className="absolute flex h-full w-full items-center justify-center text-[9px] font-bold text-accent">
                  {progressPercentage > 0 ? (
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  ) : (
                    <span className="opacity-40">0%</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hover Actions Bar */}
      {!isLocked && (
        <div className="duration-400 absolute bottom-0 left-0 right-0 z-20 flex translate-y-[110%] justify-end gap-2 bg-gradient-to-t from-card via-card/95 to-transparent p-4 pt-12 opacity-0 transition-all ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("revise");
            }}
            className="flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            Revise
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("practice");
            }}
            className="flex-1 rounded-xl border border-border bg-muted px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            Quiz
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAction?.("chat");
            }}
            className="group/btn flex flex-none items-center gap-1.5 rounded-xl border border-accent/10 bg-accent-soft px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-accent transition-all hover:bg-accent/10"
          >
            Ask AI
            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/btn:translate-x-1" />
          </button>
        </div>
      )}

      {/* Locked Overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted/60 opacity-0 backdrop-blur-[1px] transition-opacity duration-500 group-hover:opacity-100">
          <button className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-foreground shadow-card transition-all hover:scale-105 hover:bg-muted">
            <Lock className="h-3.5 w-3.5 text-accent" />
            Unlock Module
          </button>
        </div>
      )}
    </div>
  );
}
