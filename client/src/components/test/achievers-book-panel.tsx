import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, HelpCircle, AlertCircle, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AchieversBookPanelProps {
  summary: string;
  pyqs: any[];
  isOpen: boolean;
  onChange?: (isOpen: boolean) => void;
}

export function AchieversBookPanel({ summary, pyqs, isOpen, onChange }: AchieversBookPanelProps) {
  return (
    <div
      className={cn(
        "fixed right-0 top-16 z-[60] flex h-[calc(100vh-64px)] w-full max-w-sm flex-col overflow-y-auto border-l border-border bg-background shadow-inner transition-all duration-500 ease-in-out md:relative md:top-0",
        isOpen
          ? "translate-x-0 opacity-100"
          : "pointer-events-none translate-x-full opacity-0 md:hidden"
      )}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card/50 p-6 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-accent" />
          <h3 className="font-display text-xl tracking-tight text-foreground">Digital Textbook</h3>
        </div>
        {onChange && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(false)}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 p-6">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="mb-8 grid w-full grid-cols-2 rounded-xl bg-muted p-1">
            <TabsTrigger
              value="summary"
              className="rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-soft"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="pyqs"
              className="rounded-lg text-[10px] font-bold uppercase tracking-widest text-muted-foreground transition-all data-[state=active]:bg-background data-[state=active]:text-accent data-[state=active]:shadow-soft"
            >
              PYQs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            <div className="prose prose-sm prose-stone max-w-none font-body leading-relaxed text-muted-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {summary || "*No summary available for this chapter.*"}
              </ReactMarkdown>
            </div>
            {summary && (
              <div className="mt-8 flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p className="font-body text-sm leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">Study Tip:</span> Focus on the key
                  formulas marked above. They frequently appear in numerical problems in the board
                  exams.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pyqs" className="space-y-6">
            {pyqs.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <HelpCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p className="font-body text-sm text-muted-foreground">
                  No Previous Year Questions available for this chapter.
                </p>
              </div>
            ) : (
              pyqs.map((pyq, index) => (
                <div
                  key={index}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:shadow-card"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                      {pyq.year}
                    </span>
                    <span className="rounded-full border border-accent/10 bg-accent-soft px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest text-accent">
                      {pyq.board}
                    </span>
                  </div>
                  <p className="mb-4 font-display text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-accent">
                    {pyq.question}
                  </p>
                  <div className="rounded-xl border border-border bg-muted p-4 font-body text-sm leading-relaxed text-muted-foreground">
                    <span className="mb-2 block text-[10px] font-extrabold uppercase tracking-widest text-foreground opacity-60">
                      Verified Solution
                    </span>
                    {pyq.answer}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
