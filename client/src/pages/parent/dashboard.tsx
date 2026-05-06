import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, BookOpen, Bell } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";

export default function ParentDashboard() {
  const { currentUser } = useFirebaseAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/parent/dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/parent/dashboard");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  const { children = [], stats, upcomingTests = [], recentGrades = [] } = data?.data || {};

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Parent Dashboard" subtitle="Track your child's progress" />
      <div className="grid gap-4 md:grid-cols-4 p-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Children</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{children.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.totalTasks || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats?.completionRate || 0}%</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Tests</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{upcomingTests.length}</div></CardContent>
        </Card>
      </div>
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Children</h2>
        <div className="space-y-2">
          {children.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-4 border rounded">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted-foreground">{c.class} • {c.grade}</p>
              </div>
              <span className="text-sm text-muted-foreground">{c.avatar}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
