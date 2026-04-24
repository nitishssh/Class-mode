import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  options: Option[];
}

interface ArenaQuestionCardProps {
  question: Question;
  timeRemaining?: number;
  maxTime?: number;
  onAnswerSubmit: (optionId: string) => void;
  isAnswering?: boolean;
  selectedOptionId?: string | null;
  correctOptionId?: string | null;
}

export function ArenaQuestionCard({
  question,
  timeRemaining = 30,
  maxTime = 30,
  onAnswerSubmit,
  isAnswering = false,
  selectedOptionId = null,
  correctOptionId = null,
}: ArenaQuestionCardProps) {
  const progressPercentage = Math.max(0, (timeRemaining / maxTime) * 100);
  const isTimeLow = timeRemaining <= 10;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -50, opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="z-20 mx-auto w-full max-w-2xl"
    >
      <Card className="overflow-hidden rounded-2xl border-white/5 bg-[#111111] shadow-2xl">
        {/* Timer Bar */}
        <div className="h-1 w-full bg-black/40">
          <motion.div
            className={`h-full ${isTimeLow ? "bg-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.8)]" : "bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.5)]"}`}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ ease: "linear", duration: 1 }}
          />
        </div>

        <CardContent className="p-6 md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400"
            >
              Active Question
            </Badge>
            <div
              className={`flex items-center gap-1.5 font-mono text-sm font-medium ${isTimeLow ? "animate-pulse text-rose-400" : "text-zinc-500"}`}
            >
              <Clock className="h-4 w-4" />
              <span>{timeRemaining}s</span>
            </div>
          </div>

          <h3 className="mb-8 text-xl font-medium leading-relaxed tracking-tight text-zinc-100 md:text-2xl">
            {question.text}
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AnimatePresence>
              {question.options.map((option, index) => {
                const isSelected = selectedOptionId === option.id;
                const isCorrect = correctOptionId === option.id;
                const showAsCorrect = correctOptionId && isCorrect;
                const showAsWrong = correctOptionId && isSelected && !isCorrect;
                const isDisabled = isAnswering || correctOptionId !== null;

                let buttonClass =
                  "w-full justify-start p-4 text-left whitespace-normal h-auto transition-all duration-200 border rounded-xl";

                if (showAsCorrect) {
                  buttonClass +=
                    " border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
                } else if (showAsWrong) {
                  buttonClass += " border-rose-500/50 bg-rose-500/10 text-rose-100";
                } else if (isSelected) {
                  buttonClass += " border-indigo-500/50 bg-indigo-500/10 text-white";
                } else {
                  buttonClass +=
                    " border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 text-zinc-300";
                }

                return (
                  <motion.div
                    key={option.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Button
                      variant="outline"
                      className={buttonClass}
                      onClick={() => !isDisabled && onAnswerSubmit(option.id)}
                      disabled={isDisabled && !isSelected && !isCorrect}
                    >
                      <div className="flex w-full items-start gap-4">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-medium ${
                            showAsCorrect
                              ? "border-emerald-400 bg-emerald-500 text-white"
                              : showAsWrong
                                ? "border-rose-400 bg-rose-500 text-white"
                                : isSelected
                                  ? "border-indigo-400 bg-indigo-500 text-white"
                                  : "border-white/10 bg-black/40 text-zinc-400"
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="flex-1 leading-snug">{option.text}</span>
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
