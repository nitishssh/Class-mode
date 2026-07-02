import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PageHeader } from "@/components/layout/page-header";
import { StatCardGrid } from "@/components/dashboard/stat-card-grid";
import {
  Users,
  GraduationCap,
  School,
  TrendingUp,
  Calendar,
  Award,
  Bell,
  BarChart3,
  BookOpen,
  Building2,
  DollarSign,
  MessageCircle,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/**
 * Renders the Principal's dashboard with statistics, charts, staff and finance summaries, events, and notifications.
 */
export default function PrincipalDashboard() {
  const { currentUser } = useFirebaseAuth();
  const [isDemoMode, setIsDemoMode] = useState(true);

  const { data: dashboardData, isLoading: isLoadingStats } = useQuery<any>({
    queryKey: ["/api/admin/stats", { demo: isDemoMode }],
    queryFn: () =>
      apiRequest("GET", `/api/admin/stats${isDemoMode ? "?demo=true" : ""}`).then((r) => r.json()),
  });

  const stats = [
    {
      label: "Total Students",
      value: dashboardData?.totalStudents?.toLocaleString(),
      icon: <GraduationCap className="h-5 w-5" />,
      trend: isDemoMode ? "+42 this term" : "Current census",
      gradient: "from-blue-500 to-indigo-600",
      isLoading: isLoadingStats,
    },
    {
      label: "Teachers",
      value: dashboardData?.totalTeachers?.toLocaleString(),
      icon: <Users className="h-5 w-5" />,
      trend: isDemoMode ? "3 new hires" : "Active staff",
      gradient: "from-emerald-500 to-teal-600",
      isLoading: isLoadingStats,
    },
    {
      label: "Active Classes",
      value: dashboardData?.activeClasses || "0",
      icon: <School className="h-5 w-5" />,
      trend: "All running",
      gradient: "from-amber-500 to-orange-600",
      isLoading: isLoadingStats,
    },
    {
      label: "Pass Rate",
      value: `${dashboardData?.attendanceRate || 0}%`,
      icon: <TrendingUp className="h-5 w-5" />,
      trend: isDemoMode ? "+2.1% vs last year" : "Avg attendance",
      gradient: "from-purple-500 to-violet-600",
      isLoading: isLoadingStats,
    },
  ];

  const performanceData = dashboardData?.subjectPerformance || [];

  const gradeDistribution = (dashboardData?.gradeDistribution || []).map((g: any) => ({
    ...g,
    color:
      g.grade === "A+"
        ? "from-emerald-500 to-teal-500"
        : g.grade === "A"
          ? "from-blue-500 to-indigo-500"
          : g.grade === "B"
            ? "from-amber-500 to-orange-500"
            : g.grade === "C"
              ? "from-rose-400 to-red-500"
              : "from-gray-400 to-gray-500",
  }));

  const staffDistribution = [
    { name: "Science", value: 25, color: "hsl(var(--chart-1))" },
    { name: "Mathematics", value: 18, color: "hsl(var(--chart-2))" },
    { name: "Languages", value: 20, color: "hsl(var(--chart-3))" },
    { name: "Social Studies", value: 12, color: "hsl(var(--chart-4))" },
    { name: "Other", value: 12, color: "hsl(var(--chart-5))" },
  ];

  const financeSummary = [
    { label: "Annual Budget", value: dashboardData?.revenue || "₹0", status: "Approved" },
    { label: "Spent YTD", value: isDemoMode ? "₹1.8 Cr" : "₹0", status: "75% utilized" },
    { label: "Pending Fees", value: dashboardData?.pendingFees || "₹0", status: "8% outstanding" },
  ];

  const upcomingEvents = [
    { title: "Annual Sports Day", date: "Mar 15", type: "Event", color: "bg-blue-500" },
    { title: "Term 2 Exams Begin", date: "Mar 20", type: "Academic", color: "bg-amber-500" },
    { title: "Parent-Teacher Meeting", date: "Mar 25", type: "Meeting", color: "bg-emerald-500" },
    { title: "Science Exhibition", date: "Apr 2", type: "Event", color: "bg-purple-500" },
  ];

  const notifications = [
    {
      title: "Staff Leave Request",
      desc: "3 pending approvals for next week",
      time: "1h ago",
      urgent: true,
    },
    {
      title: "Exam Results",
      desc: "Term 1 results compilation complete",
      time: "3h ago",
      urgent: false,
    },
    {
      title: "Infrastructure",
      desc: "Lab equipment delivery scheduled for Monday",
      time: "5h ago",
      urgent: false,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${currentUser?.profile?.displayName || "Principal"} 🏫`}
        subtitle="Your institution's performance dashboard"
        className="animate-fade-in-up"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Principal Dashboard" }]}
      >
        <div className="mr-4 flex items-center space-x-2">
          <Switch id="demo-mode" checked={isDemoMode} onCheckedChange={setIsDemoMode} />
          <Label htmlFor="demo-mode" className="text-xs font-semibold text-muted-foreground">
            Demo Data
          </Label>
        </div>
        <Button variant="outline">
          <Calendar className="mr-2 h-4 w-4" />
          Schedule
        </Button>
        <Button>
          <BarChart3 className="mr-2 h-4 w-4" />
          Reports
        </Button>
      </PageHeader>

      {/* Stats */}
      <StatCardGrid stats={stats} />

      {/* Main Content Tabs */}
      <Tabs defaultValue="academic" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="finance">Finance</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
        </TabsList>

        {/* Academic Tab */}
        <TabsContent value="academic" className="animate-fade-in-up space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">
                  Academic Performance by Subject
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData} barGap={4}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
                      <XAxis
                        dataKey="subject"
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar
                        dataKey="avgScore"
                        name="Avg Score"
                        fill="hsl(var(--chart-1))"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="passRate"
                        name="Pass Rate %"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Grade Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {gradeDistribution.map((g: any) => (
                    <div key={g.grade} className="flex items-center gap-3">
                      <span className="w-28 text-xs font-medium text-muted-foreground">
                        {g.grade}
                      </span>
                      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${g.color}`}
                          style={{ width: `${g.pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-semibold">{g.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="animate-fade-in-up space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">
                  Staff Distribution by Department
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={staffDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {staffDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} staff`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Staff Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      label: "Total Teaching Staff",
                      value: "87",
                      icon: <BookOpen className="h-4 w-4" />,
                      color: "text-blue-600 dark:text-blue-400 bg-blue-500/10",
                    },
                    {
                      label: "Non-Teaching Staff",
                      value: "28",
                      icon: <Building2 className="h-4 w-4" />,
                      color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                    },
                    {
                      label: "Staff on Leave Today",
                      value: "4",
                      icon: <Calendar className="h-4 w-4" />,
                      color: "text-amber-600 dark:text-amber-400 bg-amber-500/10",
                    },
                    {
                      label: "Avg. Experience",
                      value: "8.5 yrs",
                      icon: <Award className="h-4 w-4" />,
                      color: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${item.color}`}>{item.icon}</div>
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Finance Tab */}
        <TabsContent value="finance" className="animate-fade-in-up">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {financeSummary.map((item) => (
              <Card key={item.label}>
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                  </div>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <Badge variant="default" className="mt-2 text-xs">
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Infrastructure Tab */}
        <TabsContent value="infrastructure" className="animate-fade-in-up">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              {
                label: "Classrooms",
                value: "42",
                status: "All operational",
                icon: <School className="h-5 w-5" />,
              },
              {
                label: "Labs",
                value: "8",
                status: "1 under maintenance",
                icon: <BookOpen className="h-5 w-5" />,
              },
              {
                label: "Library",
                value: "15K+",
                status: "Books available",
                icon: <BookOpen className="h-5 w-5" />,
              },
              {
                label: "Sports Facilities",
                value: "6",
                status: "All available",
                icon: <Award className="h-5 w-5" />,
              },
            ].map((item) => (
              <Card key={item.label} className="transition-shadow hover:shadow-md">
                <CardContent className="p-5 text-center">
                  <div className="mx-auto mb-3 w-fit rounded-xl bg-primary/10 p-2.5 text-primary">
                    {item.icon}
                  </div>
                  <div className="text-2xl font-bold">{item.value}</div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                  <div className="mt-1 text-xs text-primary/70">{item.status}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Events + Notifications */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Upcoming Events */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Upcoming Events</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingEvents.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-8 w-2 rounded-full ${event.color}`} />
                    <div>
                      <div className="text-sm font-medium">{event.title}</div>
                      <div className="text-xs text-muted-foreground">{event.date}</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "350ms" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <Bell className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold">Notifications</CardTitle>
              </div>
              <Badge className="border-0 bg-primary/10 text-xs text-primary hover:bg-primary/20">
                {notifications.filter((n) => n.urgent).length} Urgent
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.map((notif, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 transition-colors hover:bg-muted/50 ${notif.urgent ? "border-destructive/20 bg-destructive/5" : "bg-transparent"}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {notif.title}
                        {notif.urgent && (
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notif.desc}</p>
                    </div>
                    <span className="ml-2 whitespace-nowrap text-xs text-muted-foreground">
                      {notif.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Support Chat Floating Button */}
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    </>
  );
}
