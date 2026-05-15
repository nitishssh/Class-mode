import React from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";

interface DiscussionCardProps {
  topic: string;
  prompt?: string;
  onJoin: () => void;
  onSkip: () => void;
}

export function DiscussionCard({ topic, prompt, onJoin, onSkip }: DiscussionCardProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="discussion-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <Card className="border-primary/40 shadow-lg bg-background/95 backdrop-blur-sm">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
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
              Join Discussion
            </Button>
            <Button size="sm" variant="outline" onClick={onSkip}>
              Skip
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
