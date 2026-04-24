import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileQuestion,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  BookOpen,
  BarChart3,
  Trophy,
  Calendar,
  Timer,
  Play,
  Eye,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Test } from "@shared/schema";

type TestStatus = "upcoming" | "available" | "completed" | "overdue";

interface StudentTest {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  status: TestStatus;
  dueDate: string;
  duration: number; // minutes
  totalMarks: number;
  score?: number;
  type: string;
  questionsCount: number;
}

// Server-side Test type alias for clarity
type ServerTest = Test;

export function mapServerTest(t: ServerTest): StudentTest {
  let status: TestStatus;
  switch (t.status) {
    case "published":
      status = "available";
      break;
    case "completed":
      status = "completed";
      break;
    case "draft":
    default:
      status = "upcoming";
      break;
  }

  return {
    id: String(t.id),
    title: t.title,
    subject: t.subject,
    teacher: String(t.teacherId),
    status,
    dueDate: t.testDate ? new Date(t.testDate).toLocaleDateString() : "TBD",
    duration: t.duration,
    totalMarks: t.totalMarks,
    type: t.questionTypes?.[0] || "Test",
    questionsCount: 0,
  };
}

export function computeStats(tests: StudentTest[]): {
  available: number;
  upcoming: number;
  completed: number;
  overdue: number;
  avgScore: number;
} {
  const available = tests.filter((t) => t.status === "available").length;
  const upcoming = tests.filter((t) => t.status === "upcoming").length;
  const completed = tests.filter((t) => t.status === "completed").length;
  const overdue = tests.filter((t) => t.status === "overdue").length;

  const scoredTests = tests.filter((t) => t.score !== undefined);
  const avgScore =
    scoredTests.length > 0
      ? scoredTests.reduce((acc, t) => acc + (t.score! / t.totalMarks) * 100, 0) /
        scoredTests.length
      : 0;

  return { available, upcoming, completed, overdue, avgScore };
}

const subjectColors: Record<string, { gradient: string; badge: string; text: string }> = {
  Physics: {
    gradient: "from-blue-500 to-indigo-600",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    text: "text-blue-500",
  },
  Mathematics: {
    gradient: "from-indigo-500 to-purple-600",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    text: "text-indigo-500",
  },
  Chemistry: {
    gradient: "from-orange-500 to-amber-500",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    text: "text-orange-500",
  },
  "Computer Science": {
    gradient: "from-purple-500 to-violet-600",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    text: "text-purple-500",
  },
  Biology: {
    gradient: "from-emerald-500 to-teal-600",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-500",
  },
  English: {
    gradient: "from-cyan-500 to-blue-600",
    badge: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    text: "text-cyan-500",
  },
};

const statusConfig = {
  available: {
    label: "Available",
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    icon: <Play className="h-3 w-3" />,
  },
  upcoming: {
    label: "Upcoming",
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: <Calendar className="h-3 w-3" />,
  },
  completed: {
    label: "Completed",
    color: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  overdue: {
    label: "Overdue",
    color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

type TabId = "all" | TestStatus;

export default function TestsListPage() {
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const {
    data: serverTests,
    isLoading,
    isError,
    refetch,
  } = useQuery<ServerTest[]>({
    queryKey: ["/api/tests"],
  });

  const tests: StudentTest[] = (serverTests ?? []).map(mapServerTest);
  const stats = computeStats(tests);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "all", label: "All Tests", count: tests.length },
    { id: "available", label: "Available", count: stats.available },
    { id: "upcoming", label: "Upcoming", count: stats.upcoming },
    { id: "completed", label: "Completed", count: stats.completed },
    { id: "overdue", label: "Overdue", count: stats.overdue },
  ];

  const filtered = tests.filter((t) => activeTab === "all" || t.status === activeTab);

  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Tests & Assessments"
          subtitle="View all your upcoming, available, and completed tests."
          className="animate-fade-in-up"
          breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Tests" }]}
        />
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <PageHeader
          title="Tests & Assessments"
          subtitle="View all your upcoming, available, and completed tests."
          className="animate-fade-in-up"
          breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Tests" }]}
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-16 text-center">
            <div className="rounded-2xl bg-destructive/10 p-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <p className="font-semibold">Failed to load tests</p>
            <p className="text-sm text-muted-foreground">
              Something went wrong while fetching your tests.
            </p>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tests & Assessments"
        subtitle="View all your upcoming, available, and completed tests."
        className="animate-fade-in-up"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Tests" }]}
      />

      {/* Summary stats */}
      <div
        className="animate-fade-in-up mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        style={{ animationDelay: "50ms" }}
      >
        {[
          {
            label: "Available Now",
            value: stats.available,
            icon: <Play className="h-4 w-4" />,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
          },
          {
            label: "Upcoming",
            value: stats.upcoming,
            icon: <Calendar className="h-4 w-4" />,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            label: "Completed",
            value: stats.completed,
            icon: <CheckCircle2 className="h-4 w-4" />,
            color: "text-violet-500",
            bg: "bg-violet-500/10",
          },
          {
            label: "Avg Score",
            value: `${Math.round(stats.avgScore)}%`,
            icon: <Trophy className="h-4 w-4" />,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
          },
        ].map((stat, i) => (
          <Card key={i} className="transition-all hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn("rounded-xl p-2", stat.bg)}>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div>
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs font-medium text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="scrollbar-hide animate-fade-in-up mb-5 flex gap-2 overflow-x-auto pb-2"
        style={{ animationDelay: "100ms" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                activeTab === tab.id ? "bg-primary-foreground/20" : "bg-muted"
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Test Cards */}
      <div className="animate-fade-in-up space-y-3" style={{ animationDelay: "150ms" }}>
        {filtered.map((test) => {
          const subColors = subjectColors[test.subject] || subjectColors.Physics;
          const statusCfg = statusConfig[test.status];
          const pct =
            test.score !== undefined ? Math.round((test.score / test.totalMarks) * 100) : null;

          return (
            <Card
              key={test.id}
              className="group overflow-hidden border border-border/60 transition-all duration-200 hover:shadow-md"
            >
              {/* Top accent */}
              <div className={`h-0.5 w-full bg-gradient-to-r ${subColors.gradient}`} />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div
                    className={`rounded-xl bg-gradient-to-br p-3 ${subColors.gradient} flex-shrink-0 text-white shadow-sm`}
                  >
                    <FileQuestion className="h-5 w-5" />
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-semibold leading-tight transition-colors group-hover:text-primary">
                          {test.title}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              subColors.badge
                            )}
                          >
                            {test.subject}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{test.teacher}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{test.type}</span>
                        </div>
                      </div>
                      <Badge
                        className={cn(
                          "flex flex-shrink-0 items-center gap-1 text-[10px] font-bold",
                          statusCfg.color
                        )}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </Badge>
                    </div>

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {test.duration} min
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        {test.questionsCount} questions
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {test.dueDate}
                      </span>
                      {pct !== null && (
                        <span
                          className={cn(
                            "ml-auto flex items-center gap-1.5 text-xs font-semibold",
                            pct >= 90
                              ? "text-emerald-500"
                              : pct >= 70
                                ? "text-blue-500"
                                : "text-amber-500"
                          )}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          {test.score}/{test.totalMarks} ({pct}%)
                        </span>
                      )}
                    </div>

                    {/* Score bar for completed */}
                    {pct !== null && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            pct >= 90
                              ? "bg-emerald-500"
                              : pct >= 70
                                ? "bg-blue-500"
                                : "bg-amber-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="ml-2 flex-shrink-0">
                    {test.status === "available" ? (
                      <Button
                        asChild
                        size="sm"
                        className={`bg-gradient-to-r ${subColors.gradient} border-0 font-semibold text-white hover:opacity-90`}
                      >
                        <Link href={`/test/${test.id}`}>
                          <Play className="mr-1.5 h-3.5 w-3.5 fill-white" />
                          Start
                        </Link>
                      </Button>
                    ) : test.status === "completed" ? (
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link href={`/test/${test.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-muted-foreground"
                        disabled={test.status === "overdue"}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-16 text-center">
              <div className="rounded-2xl bg-muted p-4">
                <FileQuestion className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-semibold">No tests in this category</p>
              <p className="text-sm text-muted-foreground">Check back later or switch tabs.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
