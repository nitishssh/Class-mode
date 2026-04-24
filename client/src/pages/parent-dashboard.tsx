import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Users,
  TrendingUp,
  Calendar,
  MessageSquare,
  GraduationCap,
  Clock,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Render the Parent Dashboard UI showing children's overviews, academic progression, and upcoming schedule.
 *
 * Renders a page header with action buttons, a responsive grid of child cards (attendance, average grade,
 * curriculum progress, and status), an academic progression line chart comparing children over time, and a list
 * of upcoming events with icons and a control to view all events.
 *
 * @returns A React element representing the Parent Dashboard page.
 */
export default function ParentDashboard() {
  const { currentUser } = useFirebaseAuth();

  const { data: childrenData, isLoading: isLoadingChildren } = useQuery<any[]>({
    queryKey: ["/api/users/children"],
    queryFn: () => apiRequest("GET", "/api/users/children").then((r) => r.json()),
  });

  const fallbackChildren = [
    {
      name: "Sarah Johnson",
      grade: "10th Grade",
      attendance: "98%",
      avgGrade: "92%",
      progress: 88,
      status: "Excellent",
      color: "blue",
    },
    {
      name: "Leo Johnson",
      grade: "8th Grade",
      attendance: "95%",
      avgGrade: "85%",
      progress: 72,
      status: "Good",
      color: "emerald",
    },
  ];

  const children =
    childrenData && childrenData.length > 0
      ? childrenData.map((c: any) => ({
          name: c.displayName || c.name || "Unknown",
          grade: c.grade || "N/A",
          attendance: c.attendance || "N/A",
          avgGrade: c.avgGrade || "N/A",
          progress: c.progress || 0,
          status: c.status || "N/A",
          color: c.color || "blue",
        }))
      : fallbackChildren;

  const performanceData = [
    { month: "Sep", sarah: 88, leo: 78 },
    { month: "Oct", sarah: 90, leo: 81 },
    { month: "Nov", sarah: 89, leo: 80 },
    { month: "Dec", sarah: 92, leo: 84 },
    { month: "Jan", sarah: 94, leo: 85 },
  ];

  const events = [
    {
      title: "Parent-Teacher Meeting",
      subject: "Sarah - Mathematics",
      date: "Feb 25, 4:00 PM",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      title: "Science Fair",
      subject: "Leo - Project Presentation",
      date: "Mar 02, 10:00 AM",
      icon: <Trophy className="h-4 w-4" />,
    },
    {
      title: "Term Exam Results",
      subject: "Sarah - Physics",
      date: "Mar 05, All Day",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <PageHeader
        title={`Welcome, ${currentUser?.profile?.displayName || "Parent"} 👋`}
        subtitle="Stay updated with your children's academic journey."
        className="animate-fade-in-up"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Parent Dashboard" }]}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <MessageSquare className="mr-2 h-4 w-4" />
            Contact Teachers
          </Button>
          <Button size="sm">
            <Calendar className="mr-2 h-4 w-4" />
            School Calendar
          </Button>
        </div>
      </PageHeader>

      {/* Children Overview */}
      <section className="mb-8">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Users className="h-5 w-5 text-primary" />
          Children's Overview
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {isLoadingChildren
            ? Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="animate-fade-in-up">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-12 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="mb-4 h-24 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            : children.map((child, i) => (
                <Card
                  key={child.name}
                  className="animate-fade-in-up transition-all duration-300 hover:shadow-md"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div
                          className={`h-12 w-12 rounded-full bg-${child.color}-500/10 flex items-center justify-center`}
                        >
                          <GraduationCap
                            className={`h-6 w-6 text-${child.color}-600 dark:text-${child.color}-400`}
                          />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{child.name}</CardTitle>
                          <CardDescription>{child.grade}</CardDescription>
                        </div>
                      </div>
                      <Badge variant={child.status === "Excellent" ? "default" : "default"}>
                        {child.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 mt-2 grid grid-cols-2 gap-4">
                      <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Attendance
                        </div>
                        <div className="mt-1 text-lg font-bold">{child.attendance}</div>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/50 p-3">
                        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Avg. Grade
                        </div>
                        <div className="mt-1 text-lg font-bold text-primary">{child.avgGrade}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-muted-foreground">
                          Curriculum Completion
                        </span>
                        <span className="font-semibold">{child.progress}%</span>
                      </div>
                      <Progress value={child.progress} className="h-2" />
                    </div>
                    <Button variant="ghost" size="sm" className="group mt-4 w-full">
                      View Detailed Report
                      <ArrowUpRight className="ml-2 h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Academic Progression */}
        <Card className="animate-fade-in-up lg:col-span-2" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-1.5">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-lg font-semibold">Academic Progression</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[60, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sarah"
                    name="Sarah"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="leo"
                    name="Leo"
                    stroke="hsl(var(--emerald-500))"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "hsl(var(--emerald-500))" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="animate-fade-in-up" style={{ animationDelay: "300ms" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-amber-500/10 p-1.5">
                <Calendar className="h-4 w-4 text-amber-500" />
              </div>
              <CardTitle className="text-lg font-semibold">Upcoming Schedule</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.map((event, i) => (
                <div
                  key={i}
                  className="flex gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
                    {event.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{event.title}</div>
                    <div className="text-xs font-medium text-muted-foreground">{event.subject}</div>
                    <div className="mt-1 flex w-fit items-center gap-1.5 rounded-full bg-muted/80 px-2 py-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 text-primary" />
                      {event.date}
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full">
                View All Events
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/**
 * Render a trophy-shaped SVG icon and forward all received props to the root <svg> element.
 *
 * @param props - Attributes and event handlers to spread onto the root SVG element (e.g., `className`, `width`, `height`, `style`, `aria-*`).
 * @returns A React element containing the trophy SVG icon.
 */
function Trophy(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
