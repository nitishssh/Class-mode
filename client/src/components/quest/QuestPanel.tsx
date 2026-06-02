import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { X } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { QUESTS } from "@/lib/quest-config";
import {
  useQuestProgress,
  setFirstSeenAt,
  setPanelDismissed,
  hasConfettiFired,
  markConfettiFired,
} from "@/hooks/use-quest-progress";
import { QuestItem } from "./QuestItem";

export function QuestPanel() {
  const { currentUser } = useFirebaseAuth();
  const role = currentUser?.profile?.role;

  const { progress, expired } = useQuestProgress();

  // Write firstSeenAt on first mount for teacher users
  useEffect(() => {
    if (role === "teacher" && !progress.firstSeenAt) {
      setFirstSeenAt(new Date().toISOString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]); // progress.firstSeenAt omitted intentionally: setFirstSeenAt is idempotent, re-reading on every render would be wasteful

  // Fire confetti once when all quests complete
  useEffect(() => {
    if (
      progress.completedIds.length === QUESTS.length &&
      !hasConfettiFired()
    ) {
      markConfettiFired();
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      const t = setTimeout(() => {
        confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
      }, 250);
      return () => clearTimeout(t);
    }
  }, [progress.completedIds.length]);

  if (role !== "teacher") return null;
  if (expired && progress.completedIds.length < QUESTS.length) return null;
  if (progress.panelDismissed) return null;
  if (progress.completedIds.length === QUESTS.length) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="quest-panel"
        initial={{ x: 340, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 340, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-4 bottom-20 z-[72] w-80 rounded-xl border border-border bg-background shadow-xl"
        role="complementary"
        aria-label="Quest checklist"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Get started</p>
            <p className="text-xs text-muted-foreground">
              {progress.completedIds.length}/{QUESTS.length} complete
            </p>
          </div>
          <button
            onClick={() => setPanelDismissed(true)}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Dismiss quest panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-1 bg-primary transition-all duration-500"
            style={{
              width: `${(progress.completedIds.length / QUESTS.length) * 100}%`,
            }}
          />
        </div>

        {/* Quest list */}
        <div className="overflow-y-auto max-h-[60vh] p-2">
          {QUESTS.map((quest) => (
            <QuestItem
              key={quest.id}
              quest={quest}
              completed={progress.completedIds.includes(quest.id)}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
