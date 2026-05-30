import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Activity, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function AdminDashboard() {
  const { t } = useTranslation();

  const { data: overview, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/overview"],
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

  const stats = [
    {
      title: t("admin.totalStudents", "Total Students"),
      value: overview?.totalStudents || 0,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: t("admin.totalTeachers", "Total Teachers"),
      value: overview?.totalTeachers || 0,
      icon: GraduationCap,
      color: "text-green-500",
    },
    {
      title: t("admin.activeClasses", "Active Classes"),
      value: overview?.activeClasses || 0,
      icon: BookOpen,
      color: "text-purple-500",
    },
    {
      title: t("admin.avgProgress", "Avg Progress"),
      value: `${overview?.avgProgress || 0}%`,
      icon: Activity,
      color: "text-orange-500",
    },
  ];

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.dashboardTitle", "Dashboard Overview")}</h1>
          <p className="text-muted-foreground">
            {t("admin.dashboardDesc", "View high-level metrics for your school.")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity Feed placeholder */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>{t("admin.recentActivity", "Recent Activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">New student enrolled</p>
                  <p className="text-sm text-muted-foreground">Alice Johnson joined Grade 10-A</p>
                </div>
                <div className="text-sm text-muted-foreground">2 hours ago</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">Teacher assigned to class</p>
                  <p className="text-sm text-muted-foreground">Mr. Davis assigned to Grade 10-B</p>
                </div>
                <div className="text-sm text-muted-foreground">5 hours ago</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
