import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { TopStudents } from "@/components/dashboard/top-students";
import {
  StudentAnalyticsCard,
  type StudentAnalyticsSummary,
} from "@/components/dashboard/student-analytics-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { PageHeader } from "@/components/layout/page-header";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Users,
  Brain,
  BookOpen,
  BarChart3,
  Sparkles,
  Lightbulb,
  Target,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";

function IndividualStudentsTab() {
  const {
    data: students,
    isLoading,
    isError,
  } = useQuery<StudentAnalyticsSummary[]>({
    queryKey: ["/api/analytics/students"],
    queryFn: () => apiRequest("GET", "/api/analytics/students").then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError)
    return <div className="p-4 text-center text-muted-foreground">Failed to load student data</div>;

  return (
    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {students?.map((student) => (
        <StudentAnalyticsCard key={student.studentId} student={student} />
      ))}
    </div>
  );
}

export default function Analytics() {
  const { currentUser } = useFirebaseAuth();
  const studentId = currentUser?.profile?.uid;
  const [analysis, setAnalysis] = useState<any>(null);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ai/performance-analysis", {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setAnalysis(data);
    },
  });

  // Fetch real analytics data
  const { data: analyticsData } = useQuery<Array<{ subject: string; avgScore: number }>>({
    queryKey: ["/api/analytics/student", studentId],
    queryFn: () => apiRequest("GET", `/api/analytics/student/${studentId}`).then((r) => r.json()),
    enabled: !!studentId && currentUser?.profile?.role === "student",
  });

  const testCompletionData = [
    { name: "Completed", value: 85, color: "hsl(var(--chart-1))" },
    { name: "In Progress", value: 10, color: "hsl(var(--chart-2))" },
    { name: "Not Started", value: 5, color: "hsl(var(--chart-3))" },
  ];

  const kpis = [
    {
      label: "Class Average",
      value: "78%",
      trend: "+4% vs last month",
      trendUp: true,
      icon: <TrendingUp className="h-5 w-5" />,
      gradient: "from-emerald-500 to-teal-600",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Total Students",
      value: "86",
      trend: "+5 enrolled",
      trendUp: true,
      icon: <Users className="h-5 w-5" />,
      gradient: "from-blue-500 to-indigo-600",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Tests Conducted",
      value: "24",
      trend: "12 this month",
      trendUp: true,
      icon: <Target className="h-5 w-5" />,
      gradient: "from-purple-500 to-violet-600",
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10",
    },
    {
      label: "Completion Rate",
      value: "85%",
      trend: "+2% vs target",
      trendUp: true,
      icon: <BarChart3 className="h-5 w-5" />,
      gradient: "from-amber-500 to-orange-600",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <>
      <PageHeader
        title="Learning Analytics"
        subtitle="Monitor academic progress and identify improvement opportunities."
        className="animate-fade-in-up"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card
            key={kpi.label}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${kpi.bg} ${kpi.color}`}>{kpi.icon}</div>
                <div
                  className={`flex items-center text-xs font-bold ${kpi.trendUp ? "text-emerald-600" : "text-amber-600"}`}
                >
                  {kpi.trendUp ? (
                    <ArrowUpRight className="mr-1 h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="mr-1 h-3 w-3" />
                  )}
                  {kpi.trend}
                </div>
              </div>
              <div className="font-display text-3xl font-bold text-foreground">{kpi.value}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Performance chart + Top students */}
      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="animate-fade-in-up md:col-span-2" style={{ animationDelay: "150ms" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-indigo-500/10 p-1.5">
                <BarChart3 className="h-4 w-4 text-indigo-500" />
              </div>
              <CardTitle className="text-base font-semibold">
                Class Performance by Subject
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-72">
            <PerformanceChart />
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <CardTitle className="text-base font-semibold">Top Performing Students</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <TopStudents />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="animate-fade-in-up" style={{ animationDelay: "250ms" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-teal-500/10 p-1.5">
                <Target className="h-4 w-4 text-teal-500" />
              </div>
              <CardTitle className="text-base font-semibold">Test Completion Rate</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={testCompletionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {testCompletionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* AI Performance Analyst */}
        <Card
          className="animate-fade-in-up border-accent/10 shadow-soft"
          style={{ animationDelay: "300ms" }}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-base font-semibold">AI Performance Analyst</CardTitle>
              <Badge className="ml-auto border-primary/20 bg-primary/10 text-xs text-primary">
                Powered by GPT-4o
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {!analysis ? (
              <div className="rounded-2xl border-2 border-dashed bg-muted/20 py-8 text-center">
                <Sparkles className="mx-auto mb-4 h-10 w-10 text-accent/40" />
                <h3 className="text-lg font-bold">Deep Performance Analysis</h3>
                <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
                  Let EduAI analyze your last 90 days of test history to find trends and actionable
                  insights.
                </p>
                <Button
                  onClick={() => analyzeMutation.mutate()}
                  disabled={analyzeMutation.isPending}
                  className="rounded-full bg-accent px-8 text-white hover:bg-accent-hover"
                >
                  {analyzeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing History...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" /> Generate Insights
                    </>
                  )}
                </Button>
              </div>
            ) : analysis.error ? (
              <div className="p-8 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-amber-500" />
                <p className="font-semibold text-foreground">{analysis.error}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                      <ArrowUpRight className="h-3.5 w-3.5" /> Improving
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.improving?.map((s: string) => (
                        <Badge
                          key={s}
                          className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-700"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-700">
                      <ArrowDownRight className="h-3.5 w-3.5" /> Attention
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.declining?.map((s: string) => (
                        <Badge
                          key={s}
                          className="border-red-500/20 bg-red-500/10 text-[10px] text-red-700"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-accent/10 bg-accent-soft/30 p-5">
                  <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
                    Key Recommendation
                  </h4>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {analysis.recommendation}
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/50 p-5">
                  <h4 className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Overall Summary
                  </h4>
                  <p className="text-xs italic leading-relaxed text-muted-foreground">
                    "{analysis.summary}"
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnalysis(null)}
                  className="mx-auto block h-8 text-[10px] font-bold uppercase tracking-widest opacity-50 hover:opacity-100"
                >
                  Reset Analysis
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Legacy Insights Section */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "350ms" }}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base font-semibold">Curriculum Data Management</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="class" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="class">Class Insights</TabsTrigger>
              <TabsTrigger value="individuals">Individual Students</TabsTrigger>
            </TabsList>

            <TabsContent value="class" className="mt-4">
              <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-8 w-8 opacity-20" />
                <p className="text-sm">
                  Class-level trends are being aggregated. Check back shortly.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="individuals" className="mt-4">
              <IndividualStudentsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
