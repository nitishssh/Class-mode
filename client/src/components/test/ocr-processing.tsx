import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Info, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RecognizedAnswer {
  id: string;
  question: string;
  text: string;
  confidence: number;
  isEditing: boolean;
}

interface OCRProcessingProps {
  initialOCRText?: string;
  testId?: number;
}

export function OCRProcessing({ initialOCRText, testId }: OCRProcessingProps) {
  const { toast } = useToast();
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [recognizedAnswers, setRecognizedAnswers] = useState<RecognizedAnswer[]>([
    {
      id: "1",
      question: "Define Newton's Third Law of Motion",
      text:
        initialOCRText ||
        "Newton's third law states that for every action, there is an equal and opposite reaction.",
      confidence: 98,
      isEditing: false,
    },
    {
      id: "2",
      question: "Explain the concept of acceleration",
      text: "Acceleration is the rate of change of velocity with respect to time. It is calculated as a = (v-u)/t.",
      confidence: 78,
      isEditing: false,
    },
  ]);

  const evaluateAnswerMutation = useMutation({
    mutationFn: async ({ answerId, text }: { answerId: string; text: string }) => {
      // Simulate API call for now until we have actual answer IDs
      // In a real app, this would call the AI evaluation endpoint
      return apiRequest("POST", "/api/evaluate", { answerId, text });
    },
    onSuccess: () => {
      toast({
        title: "Answer Evaluated",
        description: "The AI has evaluated the answer successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Evaluation Failed",
        description: error instanceof Error ? error.message : "Failed to evaluate answer",
        variant: "destructive",
      });
    },
  });

  const handleSelectAnswer = (id: string) => {
    setSelectedAnswer(id);
  };

  const toggleEditMode = (id: string) => {
    setRecognizedAnswers(
      recognizedAnswers.map((answer) =>
        answer.id === id ? { ...answer, isEditing: !answer.isEditing } : answer
      )
    );
  };

  const handleTextChange = (id: string, text: string) => {
    setRecognizedAnswers(
      recognizedAnswers.map((answer) => (answer.id === id ? { ...answer, text } : answer))
    );
  };

  const saveEditedText = (id: string) => {
    const answer = recognizedAnswers.find((a) => a.id === id);
    if (!answer) return;

    // In a real app, you'd save the edited text to the API
    toggleEditMode(id);

    toast({
      title: "Answer Updated",
      description: "The recognized text has been updated.",
    });
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) {
      return <CheckCircle className="text-sm text-secondary" />;
    } else if (confidence >= 70) {
      return <Info className="text-sm text-accent" />;
    } else {
      return <AlertCircle className="text-sm text-destructive" />;
    }
  };

  const getConfidenceText = (confidence: number) => {
    if (confidence >= 90) {
      return "High";
    } else if (confidence >= 70) {
      return "Medium";
    } else {
      return "Low";
    }
  };

  return (
    <div className="space-y-4">
      <div className="h-64 overflow-y-auto rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
        <div className="mb-4 flex justify-between">
          <p className="text-sm font-medium">Answer Recognition</p>
          <span className="text-xs text-muted-foreground">AI-Powered</span>
        </div>

        <div className="space-y-4">
          {recognizedAnswers.map((answer) => (
            <div
              key={answer.id}
              className={cn(
                "cursor-pointer rounded-md border-l-4 p-3 transition-all",
                selectedAnswer === answer.id
                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                  : "border-transparent hover:border-primary hover:bg-muted"
              )}
              onClick={() => handleSelectAnswer(answer.id)}
            >
              <p className="text-sm font-medium">
                Q{answer.id}: {answer.question}
              </p>

              {answer.isEditing ? (
                <div className="mt-2">
                  <Textarea
                    value={answer.text}
                    onChange={(e) => handleTextChange(answer.id, e.target.value)}
                    className="min-h-24 text-sm"
                  />
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2"
                      onClick={() => toggleEditMode(answer.id)}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => saveEditedText(answer.id)}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-2 rounded bg-muted p-2 text-sm">
                    <p className="text-muted-foreground">Recognized text:</p>
                    <p>{answer.text}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center">
                      {getConfidenceIcon(answer.confidence)}
                      <span className="ml-1 text-xs">
                        AI Confidence: {getConfidenceText(answer.confidence)} ({answer.confidence}%)
                      </span>
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs font-medium text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEditMode(answer.id);
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Process Status: </span>
          <span className="text-sm text-secondary">
            {recognizedAnswers.length > 0
              ? `${recognizedAnswers.length}/10 Answers Processed`
              : "No answers processed yet"}
          </span>
        </div>
        <Button
          onClick={() =>
            toast({
              title: "Review Initiated",
              description: "All processed answers are now ready for review.",
            })
          }
        >
          Review All Answers
        </Button>
      </div>
    </div>
  );
}
