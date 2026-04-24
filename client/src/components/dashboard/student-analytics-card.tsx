import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubjectBreakdown {
  subject: string;
  averageScore: number;
}

interface RecentAttempt {
  testId: number;
  score: number;
  completedAt: string | Date;
}

export interface StudentAnalyticsSummary {
  studentId: number;
  name: string;
  avatar?: string;
  averageScore: number;
  completionRate: number;
  subjectBreakdown: SubjectBreakdown[];
  recentAttempts: RecentAttempt[];
}

export function StudentAnalyticsCard({ student }: { student: StudentAnalyticsSummary }) {
  const [expanded, setExpanded] = useState(false);

  const scoreColor =
    student.averageScore >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : student.averageScore >= 60
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  return (
    <Card
      className="cursor-pointer border border-border/60 transition-all duration-200 hover:shadow-md"
      onClick={() => setExpanded((e) => !e)}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={student.avatar} />
            <AvatarFallback>{student.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{student.name}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={cn("text-xs font-bold", scoreColor)}>
                {student.averageScore}% avg
              </span>
              <span className="text-xs text-muted-foreground">
                · {Math.round(student.completionRate * 100)}% completion
              </span>
            </div>
          </div>
          <div className="flex-shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-3">
            {student.subjectBreakdown.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subject Breakdown
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {student.subjectBreakdown.map((s) => (
                    <Badge key={s.subject} variant="outline" className="text-xs">
                      {s.subject}: {Math.round(s.averageScore)}%
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {student.recentAttempts.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent Tests
                </p>
                <div className="space-y-1">
                  {student.recentAttempts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Test #{a.testId}</span>
                      <span className="font-semibold">{a.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
