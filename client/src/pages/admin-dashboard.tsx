import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  UsersRound,
  School,
  BookOpen,
  BarChart3,
  CalendarClock,
  Settings,
  FileSpreadsheet,
  UserPlus,
  Mail,
} from "lucide-react";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  displayName?: string;
}

/**
 * Render the administration dashboard for institution administrators.
 *
 * Displays a PageHeader with user-aware greeting and action buttons, and a Tabs-driven interface
 * with sections for User Management, Class Management, Reports & Analytics, and System Settings.
 *
 * The UI is static (hard-coded data) and provides layout, summary cards, lists, and action controls
 * for each section without attached event handlers or data fetching.
 *
 * @returns A JSX element representing the admin dashboard UI
 */
export default function AdminDashboard() {
  const { currentUser } = useFirebaseAuth();

  // Fetch real admin stats
  const {
    data: adminStats,
    isLoading: isLoadingStats,
    isError: isErrorStats,
  } = useQuery<{
    totalStudents: number;
    totalTeachers: number;
    testsThisMonth: number;
    submissionsThisMonth: number;
  }>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then((r) => r.json()),
    enabled:
      !!currentUser &&
      ["admin", "principal", "school_admin"].includes(currentUser?.profile?.role || ""),
  });

  const {
    data: principalUsers,
    isLoading: isLoadingPrincipals,
    isError: isErrorPrincipals,
  } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "principal" }],
    queryFn: () => apiRequest("GET", "/api/users?role=principal").then((r) => r.json()),
  });

  const {
    data: teacherUsers,
    isLoading: isLoadingTeachers,
    isError: isErrorTeachers,
  } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "teacher" }],
    queryFn: () => apiRequest("GET", "/api/users?role=teacher").then((r) => r.json()),
  });

  const {
    data: studentUsers,
    isLoading: isLoadingStudents,
    isError: isErrorStudents,
  } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "student" }],
    queryFn: () => apiRequest("GET", "/api/users?role=student").then((r) => r.json()),
  });

  const {
    data: parentUsers,
    isLoading: isLoadingParents,
    isError: isErrorParents,
  } = useQuery<User[]>({
    queryKey: ["/api/users", { role: "parent" }],
    queryFn: () => apiRequest("GET", "/api/users?role=parent").then((r) => r.json()),
  });

  const { data: allUsers, isLoading: isLoadingAllUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users").then((r) => r.json()),
  });

  return (
    <>
      <PageHeader
        title={`Welcome, ${currentUser?.profile?.displayName || "Admin"} 🛠️`}
        subtitle="Institution Administration Panel"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Admin Dashboard" }]}
      >
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
          <Button variant="outline" size="sm">
            <Mail className="mr-2 h-4 w-4" />
            Send Notice
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </PageHeader>

      {/* Real-time Stats Cards */}
      {["admin", "principal", "school_admin"].includes(currentUser?.profile?.role || "") && (
        <div className="mb-6 grid grid-cols-4 gap-4">
          <Card className="flex flex-col items-center p-4">
            <UsersRound className="mb-2 h-8 w-8 text-amber-500" />
            <p className="text-2xl font-medium">
              {isLoadingStats ? (
                <Skeleton className="h-7 w-16" />
              ) : isErrorStats ? (
                <span className="text-xs text-red-500">Error</span>
              ) : (
                adminStats?.totalStudents || 0
              )}
            </p>
            <p className="text-center text-xs text-muted-foreground">Total Students</p>
          </Card>
          <Card className="flex flex-col items-center p-4">
            <BookOpen className="mb-2 h-8 w-8 text-green-500" />
            <p className="text-2xl font-medium">
              {isLoadingStats ? (
                <Skeleton className="h-7 w-16" />
              ) : isErrorStats ? (
                <span className="text-xs text-red-500">Error</span>
              ) : (
                adminStats?.totalTeachers || 0
              )}
            </p>
            <p className="text-center text-xs text-muted-foreground">Total Teachers</p>
          </Card>
          <Card className="flex flex-col items-center p-4">
            <FileSpreadsheet className="mb-2 h-8 w-8 text-blue-500" />
            <p className="text-2xl font-medium">
              {isLoadingStats ? (
                <Skeleton className="h-7 w-16" />
              ) : isErrorStats ? (
                <span className="text-xs text-red-500">Error</span>
              ) : (
                adminStats?.testsThisMonth || 0
              )}
            </p>
            <p className="text-center text-xs text-muted-foreground">Tests This Month</p>
          </Card>
          <Card className="flex flex-col items-center p-4">
            <BarChart3 className="mb-2 h-8 w-8 text-purple-500" />
            <p className="text-2xl font-medium">
              {isLoadingStats ? (
                <Skeleton className="h-7 w-16" />
              ) : isErrorStats ? (
                <span className="text-xs text-red-500">Error</span>
              ) : (
                adminStats?.submissionsThisMonth || 0
              )}
            </p>
            <p className="text-center text-xs text-muted-foreground">Submissions This Month</p>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users">
        <TabsList className="mb-4 grid grid-cols-4">
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage all users in the system</CardDescription>
              </div>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-4 gap-4">
                <Card className="flex flex-col items-center p-4">
                  <School className="mb-2 h-8 w-8 text-blue-500" />
                  <p className="font-medium">
                    {isLoadingPrincipals ? (
                      <Skeleton className="h-5 w-12" />
                    ) : isErrorPrincipals ? (
                      <span className="text-xs text-red-500">Error</span>
                    ) : (
                      principalUsers?.length || 0
                    )}
                  </p>
                  <p className="text-center text-xs text-muted-foreground">Principal</p>
                </Card>
                <Card className="flex flex-col items-center p-4">
                  <BookOpen className="mb-2 h-8 w-8 text-green-500" />
                  <p className="font-medium">
                    {isLoadingTeachers ? (
                      <Skeleton className="h-5 w-12" />
                    ) : isErrorTeachers ? (
                      <span className="text-xs text-red-500">Error</span>
                    ) : (
                      teacherUsers?.length || 0
                    )}
                  </p>
                  <p className="text-center text-xs text-muted-foreground">Teachers</p>
                </Card>
                <Card className="flex flex-col items-center p-4">
                  <UsersRound className="mb-2 h-8 w-8 text-amber-500" />
                  <p className="font-medium">
                    {isLoadingStudents ? (
                      <Skeleton className="h-5 w-12" />
                    ) : isErrorStudents ? (
                      <span className="text-xs text-red-500">Error</span>
                    ) : (
                      studentUsers?.length || 0
                    )}
                  </p>
                  <p className="text-center text-xs text-muted-foreground">Students</p>
                </Card>
                <Card className="flex flex-col items-center p-4">
                  <UsersRound className="mb-2 h-8 w-8 text-purple-500" />
                  <p className="font-medium">
                    {isLoadingParents ? (
                      <Skeleton className="h-5 w-12" />
                    ) : isErrorParents ? (
                      <span className="text-xs text-red-500">Error</span>
                    ) : (
                      parentUsers?.length || 0
                    )}
                  </p>
                  <p className="text-center text-xs text-muted-foreground">Parents</p>
                </Card>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center border-b bg-muted/50 p-3">
                  <div className="w-1/4 font-medium">Name</div>
                  <div className="w-1/4 font-medium">Role</div>
                  <div className="w-1/4 font-medium">Email</div>
                  <div className="w-1/4 font-medium">Actions</div>
                </div>
                <div className="divide-y">
                  {isLoadingAllUsers
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                          <Skeleton className="h-4 w-1/4" />
                          <Skeleton className="h-4 w-1/4" />
                          <Skeleton className="h-4 w-1/4" />
                          <Skeleton className="h-4 w-1/4" />
                        </div>
                      ))
                    : (allUsers?.slice(0, 10) || []).map((user, i) => (
                        <div key={user.id ?? i} className="flex items-center p-3">
                          <div className="w-1/4">{user.displayName || user.name}</div>
                          <div className="w-1/4 capitalize">{user.role}</div>
                          <div className="w-1/4">{user.email}</div>
                          <div className="flex w-1/4 space-x-2">
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500">
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Class Management</CardTitle>
                <CardDescription>Manage classes and sections</CardDescription>
              </div>
              <Button size="sm">Add Class</Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[
                  "Grade 6",
                  "Grade 7",
                  "Grade 8",
                  "Grade 9",
                  "Grade 10",
                  "Grade 11",
                  "Grade 12",
                ].map((grade, i) => (
                  <Card key={i} className="p-4">
                    <h3 className="text-lg font-bold">{grade}</h3>
                    <p className="mb-3 text-sm text-muted-foreground">4 Sections | 125 Students</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reports & Analytics</CardTitle>
              <CardDescription>View and generate reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-bold">
                    <BarChart3 className="h-5 w-5 text-blue-500" />
                    Academic Performance
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    View academic performance reports across classes
                  </p>
                  <Button variant="outline" size="sm">
                    Generate Report
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-bold">
                    <UsersRound className="h-5 w-5 text-green-500" />
                    Attendance Report
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Student and teacher attendance statistics
                  </p>
                  <Button variant="outline" size="sm">
                    Generate Report
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-bold">
                    <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                    Exam Results
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Comprehensive exam results and analysis
                  </p>
                  <Button variant="outline" size="sm">
                    Generate Report
                  </Button>
                </Card>
                <Card className="p-4">
                  <h3 className="mb-2 flex items-center gap-2 font-bold">
                    <CalendarClock className="h-5 w-5 text-purple-500" />
                    Term Calendar
                  </h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Academic calendar and important dates
                  </p>
                  <Button variant="outline" size="sm">
                    View Calendar
                  </Button>
                </Card>
              </div>

              <h3 className="mb-2 font-medium">Recent Reports</h3>
              <div className="rounded-md border">
                <div className="divide-y">
                  {[
                    {
                      name: "Annual Performance Report 2024-25",
                      date: "April 2, 2025",
                      type: "Academic",
                    },
                    {
                      name: "Term 1 Attendance Summary",
                      date: "March 25, 2025",
                      type: "Attendance",
                    },
                    { name: "Mid-term Examination Results", date: "March 15, 2025", type: "Exam" },
                    { name: "Teacher Evaluation Report", date: "March 10, 2025", type: "Staff" },
                  ].map((report, i) => (
                    <div key={i} className="flex items-center p-3">
                      <div className="flex-1 font-medium">{report.name}</div>
                      <div className="w-1/4 text-sm text-muted-foreground">{report.date}</div>
                      <div className="w-1/6">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                          {report.type}
                        </span>
                      </div>
                      <div className="w-1/6">
                        <Button variant="ghost" size="sm">
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>Configure system-wide settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <Card className="flex flex-col p-4">
                  <Settings className="mb-3 h-8 w-8 text-blue-500" />
                  <h3 className="mb-1 font-bold">General Settings</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Configure basic system settings
                  </p>
                  <Button variant="outline" size="sm" className="mt-auto">
                    Configure
                  </Button>
                </Card>
                <Card className="flex flex-col p-4">
                  <School className="mb-3 h-8 w-8 text-green-500" />
                  <h3 className="mb-1 font-bold">Institution Profile</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Update institution information
                  </p>
                  <Button variant="outline" size="sm" className="mt-auto">
                    Update
                  </Button>
                </Card>
                <Card className="flex flex-col p-4">
                  <CalendarClock className="mb-3 h-8 w-8 text-amber-500" />
                  <h3 className="mb-1 font-bold">Academic Calendar</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Manage academic year and terms
                  </p>
                  <Button variant="outline" size="sm" className="mt-auto">
                    Configure
                  </Button>
                </Card>
                <Card className="flex flex-col p-4">
                  <BookOpen className="mb-3 h-8 w-8 text-purple-500" />
                  <h3 className="mb-1 font-bold">Curriculum Setup</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Configure subjects and curriculum
                  </p>
                  <Button variant="outline" size="sm" className="mt-auto">
                    Configure
                  </Button>
                </Card>
                <Card className="flex flex-col p-4">
                  <Mail className="mb-3 h-8 w-8 text-red-500" />
                  <h3 className="mb-1 font-bold">Notification Settings</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Configure email and notification settings
                  </p>
                  <Button variant="outline" size="sm" className="mt-auto">
                    Configure
                  </Button>
                </Card>
                <Card className="flex flex-col p-4">
                  <UsersRound className="mb-3 h-8 w-8 text-indigo-500" />
                  <h3 className="mb-1 font-bold">User Permissions</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Manage user roles and permissions
                  </p>
                  <Button variant="outline" size="sm" className="mt-auto">
                    Configure
                  </Button>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
