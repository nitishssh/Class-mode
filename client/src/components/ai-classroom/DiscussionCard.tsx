import React from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/lib/i18n";

interface DiscussionCardProps {
  topic: string;
  prompt?: string;
  onJoin: () => void;
  onSkip: () => void;
}

export function DiscussionCard({ topic, prompt, onJoin, onSkip }: DiscussionCardProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      <motion.div
        key="discussion-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="fixed bottom-24 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4"
      >
        <Card className="border-primary/40 bg-background/95 shadow-lg backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <CardTitle className="text-sm font-semibold leading-tight">{topic}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onSkip}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          {prompt && (
            <CardContent className="pb-3 pt-0">
              <p className="text-sm text-muted-foreground">{prompt}</p>
            </CardContent>
          )}
          <CardFooter className="gap-2 pb-4">
            <Button size="sm" onClick={onJoin} className="flex-1">
              {t("discussion.joinDiscussion", "Join Discussion")}
            </Button>
            <Button size="sm" variant="outline" onClick={onSkip}>
              {t("discussion.skip", "Skip")}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
