import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { Quest } from "@/lib/quest-config";

interface QuestItemProps {
  quest: Quest;
  completed: boolean;
}

export function QuestItem({ quest, completed }: QuestItemProps) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
        completed ? "opacity-60" : "hover:bg-muted/50"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {completed ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{quest.emoji}</span>
          <p
            className={`text-sm font-medium leading-tight ${
              completed ? "text-muted-foreground line-through" : "text-foreground"
            }`}
          >
            {quest.title}
          </p>
        </div>
        {!completed && (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{quest.description}</p>
        )}
      </div>

      {!completed && (
        <Link href={quest.ctaPath}>
          <button className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary transition-colors hover:text-primary/80">
            {quest.ctaLabel}
            <ChevronRight className="h-3 w-3" />
          </button>
        </Link>
      )}
    </div>
  );
}
