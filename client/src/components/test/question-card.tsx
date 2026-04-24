import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, CheckCircle, Sparkles, Loader2 } from "lucide-react";
import { AnswerInput } from "./answer-input";

interface QuestionCardProps {
  question: any;
  currentAnswer: string;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onHintRequest: () => void;
  hintsRemaining: number;
  isSubmitting: boolean;
}

export function QuestionCard({
  question,
  currentAnswer,
  onAnswerChange,
  onSubmit,
  onSkip,
  onHintRequest,
  hintsRemaining,
  isSubmitting,
}: QuestionCardProps) {
  if (!question) return null;

  return (
    <Card className="animate-fade-in mx-auto mt-8 w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-card md:mt-12">
      <CardHeader className="p-8 pb-4">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent/60" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {question.type} Assessment
            </span>
          </div>
          <div className="rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
            {question.marks} Points
          </div>
        </div>
        <h2 className="font-display text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
          {question.text}
        </h2>
      </CardHeader>

      <CardContent className="px-8 pb-10 pt-6">
        <AnswerInput
          type={question.type}
          options={question.options}
          value={currentAnswer}
          onChange={onAnswerChange}
          disabled={isSubmitting}
        />
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t border-border bg-muted/50 px-8 py-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onHintRequest}
          disabled={hintsRemaining <= 0 || isSubmitting}
          className="rounded-xl px-4 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        >
          <Lightbulb className="mr-2 h-4 w-4 text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest">Ask for an AI Nudge</span>
        </Button>

        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={onSkip}
            disabled={isSubmitting}
            className="rounded-xl border-border px-6 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            Skip
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!currentAnswer || isSubmitting}
            className="min-w-[140px] rounded-xl bg-accent text-white shadow-soft transition-all hover:bg-accent/90"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Submit Answer
              </span>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
