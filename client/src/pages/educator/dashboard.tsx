import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ClipboardCheck, TrendingUp, BookOpen } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";

export default function EducatorDashboard() {
  useFirebaseAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/educator/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/educator/dashboard");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  const { stats, recentTests } = data?.data || {};

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Educator Dashboard"
        subtitle="Manage your classes and track student progress"
      />
      <div className="grid gap-4 p-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tests</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTests || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Grading</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingGrading || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.avgScore || 0}%</div>
          </CardContent>
        </Card>
      </div>
      <div className="p-4">
        <h2 className="mb-4 text-xl font-bold">Recent Tests</h2>
        <div className="space-y-2">
          {(recentTests || []).map((t: any) => (
            <div key={t.id} className="flex items-center justify-between rounded border p-4">
              <div>
                <p className="font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground">
                  {t.subject} • {t.class}
                </p>
              </div>
              <Badge>{t.status}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
