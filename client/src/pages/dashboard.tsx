import { Link } from "wouter";
import {
  FileQuestion,
  ScanBarcode,
  BarChart3,
  PlusCircle,
  Sparkles,
  MessageSquare,
  Video,
  BellRing,
  BookOpen,
  Brain,
  TrendingUp,
  Users,
  ClipboardCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { RecentTestsTable } from "@/components/dashboard/recent-tests-table";
import { TopStudents } from "@/components/dashboard/top-students";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { ClassSchedule } from "@/components/dashboard/class-schedule";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { currentUser } = useFirebaseAuth();

  const { data: dashboardData, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboards/teacher"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const {
    stats = { activeTests: 0, totalStudents: 0, avgScore: 0, classesCount: 0 },
    tests = [],
    pendingSubmissions = [],
    liveClasses = [],
  } = dashboardData || {};

  const quickActions = [
    {
      title: "Create Test",
      description: "Design assessments",
      icon: <PlusCircle className="h-5 w-5" />,
      href: "/create-test",
      bgColor: "bg-accent-soft",
      iconColor: "text-accent",
    },
    {
      title: "Scan Papers",
      description: "AI-assisted grading",
      icon: <ScanBarcode className="h-5 w-5" />,
      href: "/ocr-scan",
      bgColor: "bg-muted",
      iconColor: "text-emerald-700",
    },
    {
      title: "Analytics",
      description: "Class insights",
      icon: <BarChart3 className="h-5 w-5" />,
      href: "/analytics",
      bgColor: "bg-muted",
      iconColor: "text-amber-700",
    },
    {
      title: "Study Plans",
      description: "AI Generation",
      icon: <Sparkles className="h-5 w-5" />,
      href: "/ai-study-plans",
      bgColor: "bg-muted",
      iconColor: "text-purple-700",
    },
    {
      title: "Live Class",
      description: "Host sessions",
      icon: <Video className="h-5 w-5" />,
      href: "/live-classes",
      bgColor: "bg-muted",
      iconColor: "text-rose-700",
    },
    {
      title: "Messages",
      description: "Chat & Support",
      icon: <MessageSquare className="h-5 w-5" />,
      href: "/messages",
      bgColor: "bg-muted",
      iconColor: "text-blue-700",
    },
  ];

  const statCards = [
    {
      label: "Active Tests",
      value: stats.activeTests.toString(),
      icon: <ClipboardCheck className="h-5 w-5" />,
      trend: "Real-time",
      color: "text-accent",
    },
    {
      label: "Total Students",
      value: stats.totalStudents.toString(),
      icon: <Users className="h-5 w-5" />,
      trend: "Enrolled",
      color: "text-emerald-700",
    },
    {
      label: "Avg. Score",
      value: `${stats.avgScore}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      trend: "Overall",
      color: "text-amber-700",
    },
    {
      label: "Classes Today",
      value: stats.classesCount.toString(),
      icon: <BookOpen className="h-5 w-5" />,
      trend: "Scheduled",
      color: "text-purple-700",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${currentUser?.profile?.displayName} 👋`}
        subtitle="Your teaching hub is updated with today's student insights and class goals."
        className="animate-fade-in-up"
      >
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="h-10 text-xs font-bold uppercase tracking-widest"
            asChild
          >
            <Link href="/analytics">
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </Link>
          </Button>
          <Button className="h-10 text-xs font-bold uppercase tracking-widest shadow-soft" asChild>
            <Link href="/create-test">
              <PlusCircle className="mr-2 h-4 w-4" />
              New Test
            </Link>
          </Button>
        </div>
      </PageHeader>

      <section className="mb-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
        {statCards.map((stat, index) => (
          <Card
            key={stat.label}
            className="animate-fade-in-up border-border bg-card transition-all duration-300 hover:shadow-card"
          >
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className={`rounded-xl bg-muted p-2.5 ${stat.color} shadow-soft`}>
                  {stat.icon}
                </div>
                <div className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {stat.trend}
                </div>
              </div>
              <div className="font-display text-3xl leading-none text-foreground">{stat.value}</div>
              <div className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="animate-fade-in-up mb-10">
        <h2 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-4 w-4 text-accent" />
          Teaching Toolkit
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {quickActions.map((action) => (
            <QuickActionCard
              key={action.href}
              title={action.title}
              description={action.description}
              icon={action.icon}
              href={action.href}
              bgColor={action.bgColor}
              iconColor={action.iconColor}
            />
          ))}
        </div>
      </section>

      <section className="animate-fade-in-up mb-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <ClipboardCheck className="h-4 w-4 text-accent" />
            Recent Assessments
          </h2>
          <Link
            href="/tests"
            className="text-xs font-bold uppercase tracking-widest text-accent hover:underline"
          >
            View Archive
          </Link>
        </div>
        <Card className="overflow-hidden border-border bg-card shadow-soft">
          <RecentTestsTable data={tests} />
        </Card>
      </section>

      <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="animate-fade-in-up border-border bg-card shadow-soft">
            <CardHeader className="pb-0">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Class Performance Benchmark
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart />
            </CardContent>
          </Card>

          <Card className="animate-fade-in-up overflow-hidden border-border bg-card shadow-soft">
            <CardHeader className="border-b border-border bg-muted/50 pb-4">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-accent" />
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Recent Submissions to Review
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {pendingSubmissions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No submissions to review yet.
                </div>
              ) : (
                <div className="divide-y divide-cream-400">
                  {pendingSubmissions.map((submission: any, index: number) => (
                    <div
                      key={index}
                      className="group bg-background p-5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="mb-1 font-display text-base text-foreground transition-colors group-hover:text-accent">
                            {submission.studentId?.displayName || submission.studentId?.name}
                          </div>
                          <p className="font-body text-sm text-muted-foreground">
                            Submitted test #{submission.testId}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 text-[10px] font-bold uppercase tracking-widest"
                          asChild
                        >
                          <Link href={`/tests/${submission.testId}/review/${submission.id}`}>
                            Review
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="animate-fade-in-up border-border bg-card shadow-soft">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Today's Live Classes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {liveClasses.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No live classes scheduled for today.
                </div>
              ) : (
                <div className="space-y-3">
                  {liveClasses.map((cls: any, i: number) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-soft"
                    >
                      <div className="font-display text-sm text-foreground">{cls.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(cls.scheduledTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8 p-8">
      <div className="h-20 w-full rounded-xl bg-muted" />
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 w-full rounded-xl bg-muted" />
    </div>
  );
}
