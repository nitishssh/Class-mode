import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function AnalyticsPage() {
  const { t } = useTranslation();

  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/analytics"],
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.learningAnalytics", "Learning Analytics")}</h1>
          <p className="text-muted-foreground">
            {t("admin.analyticsDesc", "Detailed insights into student performance and content engagement.")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Progress Trend Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>{t("admin.progressTrend", "Progress Trend (30 Days)")}</CardTitle>
              <CardDescription>{t("admin.averageProgressDesc", "Average student progress over time")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics?.dailyProgress || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgPct" stroke="hsl(var(--primary))" strokeWidth={2} name="Avg Progress %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Subject Completion Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>{t("admin.subjectCompletion", "Subject Completion")}</CardTitle>
              <CardDescription>{t("admin.completionBySubject", "Completion percentage by subject")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.subjectCompletion || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="subject" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Bar dataKey="pct" fill="hsl(var(--primary))" name="Completion %" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Students */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.topPerformingStudents", "Top Performing Students")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.topStudents?.map((student: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="font-medium">{student.name}</div>
                    <div className="text-green-500 font-bold">{student.progressPct}%</div>
                  </div>
                ))}
                {!analytics?.topStudents?.length && (
                  <div className="text-muted-foreground text-sm">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bottom Students */}
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.studentsNeedingAttention", "Students Needing Attention")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.bottomStudents?.map((student: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="font-medium">{student.name}</div>
                    <div className="text-destructive font-bold">{student.progressPct}%</div>
                  </div>
                ))}
                {!analytics?.bottomStudents?.length && (
                  <div className="text-muted-foreground text-sm">No data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
