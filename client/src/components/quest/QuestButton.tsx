import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { QUESTS, isQuestPanelSuppressed } from "@/lib/quest-config";
import { useQuestProgress, setPanelDismissed } from "@/hooks/use-quest-progress";

export function QuestButton() {
  const { currentUser } = useAuth();
  const role = currentUser?.profile?.role;
  const { progress, expired } = useQuestProgress();
  const [visible, setVisible] = useState(true);
  const [location] = useLocation();

  const allDone = progress.completedIds.length === QUESTS.length;

  // Fade out 2 seconds after all quests complete
  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  if (role !== "teacher") return null;

  // Suppressed alongside the panel on the register screens: showing the launcher
  // there would be a control that does nothing, since clicking it only clears
  // panelDismissed and the panel stays suppressed. The quests reappear as soon
  // as the teacher navigates anywhere else.
  const shouldShow =
    visible &&
    !expired &&
    !isQuestPanelSuppressed(location) &&
    (progress.panelDismissed || allDone);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.button
          key="quest-button"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            if (!allDone) setPanelDismissed(false);
          }}
          className="fixed bottom-6 right-6 z-[70] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 print:hidden"
          aria-label="Open quest checklist"
        >
          <Sparkles className="h-4 w-4" />
          {allDone ? (
            <span>You're all set! 🎉</span>
          ) : (
            <span>
              Get Started ({progress.completedIds.length}/{QUESTS.length})
            </span>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
