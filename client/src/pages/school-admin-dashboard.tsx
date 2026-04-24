import { useFirebaseAuth as useAuth } from "@/contexts/firebase-auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  Building2,
  BarChart3,
  School,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  school_code?: string;
}

export default function SchoolAdminDashboard() {
  const {
    currentUser: { profile },
  } = useAuth();
  const { toast } = useToast();

  const { data: teachers, isLoading } = useQuery<User[]>({
    queryKey: ["/api/school/teachers"],
  });

  const {
    data: students,
    isLoading: isLoadingStudents,
    isError: isErrorStudents,
  } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "student" }],
    queryFn: () => apiRequest("GET", "/api/users?role=student").then((r) => r.json()),
  });

  const approveMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await apiRequest("POST", `/api/school/teachers/${teacherId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/school/teachers"] });
      toast({
        title: "Teacher Approved",
        description: "The teacher account is now active.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Action Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const activeTeachers = teachers?.filter((t) => t.status === "active")?.length || 0;
  const pendingTeachers = teachers?.filter((t) => t.status === "pending")?.length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">School Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {profile?.displayName || "Administrator"}. Your school code is{" "}
          <span className="font-mono font-bold text-primary">
            {(profile as any)?.school_code || "N/A"}
          </span>
          .
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {activeTeachers} Active | {pendingTeachers} Pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingStudents ? (
                <Skeleton className="h-7 w-16" />
              ) : isErrorStudents ? (
                <span className="text-sm text-red-500">Error</span>
              ) : (
                students?.length?.toLocaleString() || "0"
              )}
            </div>
            <p className="text-xs text-muted-foreground">+12 from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">86</div>
            <p className="text-xs text-muted-foreground">Across all grades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Performance</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">76%</div>
            <p className="text-xs text-muted-foreground">+2.4% from last term</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher Management</CardTitle>
          <CardDescription>Manage teacher accounts and approvals for your school.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : teachers && teachers.length > 0 ? (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-3 text-left font-medium">Name</th>
                    <th className="p-3 text-left font-medium">Email</th>
                    <th className="p-3 text-left font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {teachers.map((teacher) => (
                    <tr key={teacher.id} className="transition-colors hover:bg-muted/30">
                      <td className="p-3 font-medium">{teacher.name}</td>
                      <td className="p-3 text-muted-foreground">{teacher.email}</td>
                      <td className="p-3">
                        {teacher.status === "active" ? (
                          <span className="flex w-fit items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-600 dark:bg-green-900/20">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                          </span>
                        ) : teacher.status === "pending" ? (
                          <span className="flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-900/20">
                            <Clock className="mr-1 h-3 w-3" /> Pending
                          </span>
                        ) : (
                          <span className="flex w-fit items-center rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:bg-red-900/20">
                            <XCircle className="mr-1 h-3 w-3" /> {teacher.status}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {teacher.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() => approveMutation.mutate(teacher.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
              <p className="text-sm italic text-muted-foreground">
                No teachers found for your school code.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>School Performance Overview</CardTitle>
            <CardDescription>Teacher active vs pending status breakdown.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] border-t pt-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Active", count: activeTeachers },
                    { name: "Pending", count: pendingTeachers },
                    {
                      name: "Other",
                      count: Math.max(
                        0,
                        (teachers?.length || 0) - activeTeachers - pendingTeachers
                      ),
                    },
                  ]}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
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
                    dataKey="count"
                    name="Teachers"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest teacher approvals and pending items.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] overflow-y-auto border-t pt-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : teachers && teachers.length > 0 ? (
              <div className="space-y-2">
                {teachers.slice(0, 8).map((teacher) => (
                  <div
                    key={teacher.id}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {teacher.status === "active" ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                      ) : teacher.status === "pending" ? (
                        <Clock className="h-4 w-4 flex-shrink-0 text-amber-500" />
                      ) : (
                        <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                      )}
                      <span className="max-w-[140px] truncate text-sm font-medium">
                        {teacher.name}
                      </span>
                    </div>
                    <span className="text-xs capitalize text-muted-foreground">
                      {teacher.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
