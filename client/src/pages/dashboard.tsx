import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  GraduationCap,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { RecentTestsTable } from "@/components/dashboard/recent-tests-table";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface TeacherDashboardData {
  stats?: {
    activeTests?: number;
    totalStudents?: number;
    avgScore?: number;
    classesCount?: number;
  };
  tests?: Array<Record<string, unknown>>;
  pendingSubmissions?: Array<Record<string, unknown>>;
  liveClasses?: Array<Record<string, unknown>>;
}

const tools = [
  { label: "Create test", detail: "Build an assessment", href: "/create-test", icon: FilePlus2 },
  { label: "Class analytics", detail: "Review performance", href: "/analytics", icon: BarChart3 },
  { label: "AI classroom", detail: "Prepare a lesson", href: "/ai-classroom", icon: Sparkles },
  { label: "Messages", detail: "Contact students", href: "/messages", icon: MessageSquare },
];

function textValue(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

export default function Dashboard() {
  const { currentUser } = useFirebaseAuth();
  const {
    data: dashboardData,
    isLoading,
    isError,
    refetch,
  } = useQuery<TeacherDashboardData>({
    queryKey: ["/api/dashboards/teacher"],
  });

  if (isLoading) return <DashboardSkeleton />;

  if (isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
          <h1 className="font-display text-2xl">Dashboard unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not load your teaching overview. Check the local data services and try again.
          </p>
          <Button className="mt-5" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const {
    stats = { activeTests: 0, totalStudents: 0, avgScore: 0, classesCount: 0 },
    tests = [],
    pendingSubmissions = [],
    liveClasses = [],
  } = dashboardData || {};
  const nextClass = liveClasses[0];
  const teacherName = currentUser?.profile?.displayName?.split(" ")[0] || "Teacher";

  return (
    <div className="pb-12">
      <PageHeader
        title={`Good morning, ${teacherName}`}
        subtitle="Review what needs attention, then move into today’s teaching."
      >
        <Button asChild>
          <Link href="/create-test">
            <FilePlus2 className="h-4 w-4" />
            Create test
          </Link>
        </Button>
      </PageHeader>

      <section
        className="mb-8 grid overflow-hidden rounded-[var(--radius-surface)] border bg-card md:grid-cols-3"
        aria-label="Class summary"
      >
        {[
          {
            label: "Students",
            value: stats.totalStudents ?? 0,
            detail: "assigned to your tests",
            icon: Users,
          },
          {
            label: "Active tests",
            value: stats.activeTests ?? 0,
            detail: "draft or published",
            icon: BookOpenCheck,
          },
          {
            label: "Average score",
            value: `${stats.avgScore ?? 0}%`,
            detail: "across evaluated work",
            icon: GraduationCap,
          },
        ].map((item, index) => (
          <div
            key={item.label}
            className={`flex items-center gap-4 p-5 ${index > 0 ? "border-t md:border-l md:border-t-0" : ""}`}
          >
            <item.icon className="h-5 w-5 text-accent" aria-hidden="true" />
            <div>
              <div className="font-display text-2xl tabular-nums text-foreground">{item.value}</div>
              <div className="text-sm font-medium text-foreground">{item.label}</div>
              <div className="text-xs text-muted-foreground">{item.detail}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden shadow-[var(--surface-raised)]">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b p-5">
              <div>
                <CardTitle className="font-body text-base">Needs grading</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Completed submissions waiting for your review.
                </p>
              </div>
              <Badge variant={pendingSubmissions.length > 0 ? "warning" : "success"}>
                {pendingSubmissions.length}
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {pendingSubmissions.length === 0 ? (
                <div className="flex items-center gap-4 p-6">
                  <CheckCircle2 className="h-6 w-6 text-progress" />
                  <div>
                    <p className="text-sm font-medium">You’re caught up</p>
                    <p className="text-sm text-muted-foreground">
                      New completed work will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {pendingSubmissions.map((submission, index) => (
                    <div
                      key={textValue(submission, "id") || index}
                      className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {textValue(submission, "student_name", "studentName") || "Student"}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {textValue(submission, "test_title", "testTitle") || "Assessment"}
                        </p>
                      </div>
                      <Button size="sm" asChild>
                        <Link href="/grading">
                          Review submission
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <section aria-labelledby="recent-assessments">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 id="recent-assessments" className="font-body text-base font-semibold">
                  Recent assessments
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your latest drafts, published tests, and completed work.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/create-test">Manage tests</Link>
              </Button>
            </div>
            <RecentTestsTable data={tests as never[]} />
          </section>
        </div>

        <aside className="space-y-6" aria-label="Today and teaching tools">
          <Card className="shadow-[var(--surface-raised)]">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-body text-base">Next live class</CardTitle>
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {nextClass ? (
                <>
                  <p className="font-medium text-foreground">
                    {textValue(nextClass, "title") || "Live class"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(
                      textValue(nextClass, "scheduled_time", "scheduledTime")
                    ).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {textValue(nextClass, "duration_minutes", "durationMinutes") || "60"} minutes
                  </p>
                  <Button className="mt-5 w-full" variant="outline" asChild>
                    <Link href="/live-classes">
                      <Video className="h-4 w-4" />
                      Open live classes
                    </Link>
                  </Button>
                </>
              ) : (
                <div>
                  <p className="text-sm font-medium">No class scheduled today</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Schedule a session when your class needs real-time support.
                  </p>
                  <Button className="mt-5 w-full" variant="outline" asChild>
                    <Link href="/live-classes">Schedule a class</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <section>
            <div className="mb-3">
              <h2 className="font-body text-base font-semibold">Teaching tools</h2>
              <p className="text-sm text-muted-foreground">Shortcuts for common work.</p>
            </div>
            <div className="overflow-hidden rounded-[var(--radius-surface)] border bg-card">
              {tools.map((tool, index) => (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className={`flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <tool.icon className="h-5 w-5 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">{tool.label}</div>
                    <div className="text-xs text-muted-foreground">{tool.detail}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-label="Loading dashboard">
      <div className="space-y-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-[28rem] max-w-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-[var(--radius-surface)]" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.75fr)]">
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-[var(--radius-surface)]" />
          <Skeleton className="h-72 rounded-[var(--radius-surface)]" />
        </div>
        <Skeleton className="h-72 rounded-[var(--radius-surface)]" />
      </div>
    </div>
  );
}
