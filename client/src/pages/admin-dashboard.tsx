import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { toast } = useToast();
  
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "teacher",
  });

  const handleOpenAddUser = () => {
    setFormData({ name: "", email: "", role: "teacher" });
    setIsAddUserOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({ name: user.name || user.displayName || "", email: user.email, role: user.role });
    setIsEditUserOpen(true);
  };

  const handleOpenDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };

  const addUserMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserOpen(false);
      toast({ title: "User Added" });
    },
    onError: () => toast({ title: "Failed to add user", variant: "destructive" })
  });

  const editUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => apiRequest("PUT", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditUserOpen(false);
      toast({ title: "User Updated" });
    },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" })
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteUserOpen(false);
      toast({ title: "User Deleted" });
    },
    onError: () => toast({ title: "Failed to delete user", variant: "destructive" })
  });


  
  const { data: studentAnalytics, isLoading: isLoadingAnalytics } = useQuery<any[]>({
    queryKey: ["/api/analytics/students"],
    queryFn: () => apiRequest("GET", "/api/analytics/students").then(r => r.json()),
    enabled: !!currentUser && (currentUser as any).role === "admin",
  });

  const [isAcademicReportOpen, setIsAcademicReportOpen] = useState(false);

  const downloadAcademicCSV = () => {
    if (!studentAnalytics || studentAnalytics.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = ["Student Name", "Average Score (%)", "Completion Rate", "Recent Attempts"];
    const csvContent = [
      headers.join(","),
      ...studentAnalytics.map(s => 
        `"${s.name}",${s.averageScore},${s.completionRate},${s.recentAttempts?.length || 0}`
      )
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "academic_performance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { data: allClasses, isLoading: isLoadingClasses } = useQuery<{id: number, name: string, grade: string}[]>({
    queryKey: ["/api/admin/classes"],
    queryFn: () => apiRequest("GET", "/api/admin/classes").then(r => r.json()),
    enabled: !!currentUser,
  });

  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isEditClassOpen, setIsEditClassOpen] = useState(false);
  const [isDeleteClassOpen, setIsDeleteClassOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  
  const [classFormData, setClassFormData] = useState({ name: "", grade: "" });

  const handleOpenAddClass = () => {
    setClassFormData({ name: "", grade: "" });
    setIsAddClassOpen(true);
  };

  const handleOpenEditClass = (cls: any) => {
    setSelectedClass(cls);
    setClassFormData({ name: cls.name || "", grade: cls.grade || "" });
    setIsEditClassOpen(true);
  };

  const handleOpenDeleteClass = (cls: any) => {
    setSelectedClass(cls);
    setIsDeleteClassOpen(true);
  };

  const addClassMutation = useMutation({
    mutationFn: (data: typeof classFormData) => apiRequest("POST", "/api/admin/classes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      setIsAddClassOpen(false);
      toast({ title: "Class Added" });
    },
    onError: () => toast({ title: "Failed to add class", variant: "destructive" })
  });

  const editClassMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: any }) => apiRequest("PUT", `/api/admin/classes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      setIsEditClassOpen(false);
      toast({ title: "Class Updated" });
    },
    onError: () => toast({ title: "Failed to update class", variant: "destructive" })
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      setIsDeleteClassOpen(false);
      toast({ title: "Class Deleted" });
    },
    onError: () => toast({ title: "Failed to delete class", variant: "destructive" })
  });

  // Fetch real admin stats
  const { data: schoolProfile, isLoading: isLoadingSchool } = useQuery<any>({
    queryKey: ["/api/admin/school"],
    queryFn: () => apiRequest("GET", "/api/admin/school").then(r => r.json()),
    enabled: !!currentUser && (currentUser as any).role === "admin",
  });

  const [isSchoolProfileOpen, setIsSchoolProfileOpen] = useState(false);
  const [schoolFormData, setSchoolFormData] = useState({ name: "", city: "", board: "" });

  const handleOpenSchoolProfile = () => {
    if (schoolProfile) {
      setSchoolFormData({ 
        name: schoolProfile.name || "", 
        city: schoolProfile.city || "", 
        board: schoolProfile.board || "" 
      });
    }
    setIsSchoolProfileOpen(true);
  };

  const updateSchoolMutation = useMutation({
    mutationFn: (data: typeof schoolFormData) => apiRequest("PUT", "/api/admin/school", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/school"] });
      setIsSchoolProfileOpen(false);
      toast({ title: "Institution Profile Updated" });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" })
  });

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
          <Button variant="outline" size="sm" onClick={handleOpenAddUser}>
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
              <Button size="sm" onClick={handleOpenAddUser}>
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
                            <Button variant="outline" size="sm" onClick={() => handleOpenEditUser(user)}>
                              Edit
                            </Button>
                            <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleOpenDeleteUser(user)}>
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
              <Button size="sm" onClick={handleOpenAddClass}>Add Class</Button>
            </CardHeader>
            <CardContent>
              {isLoadingClasses ? (
                <div className="flex gap-4 p-4"><Skeleton className="h-32 w-1/3" /><Skeleton className="h-32 w-1/3" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {(allClasses || []).map((cls, i) => (
                    <Card key={cls.id || i} className="p-4">
                      <h3 className="text-lg font-bold">{cls.name}</h3>
                      <p className="mb-3 text-sm text-muted-foreground">{cls.grade ? `Grade ${cls.grade}` : 'No Grade'}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenEditClass(cls)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-500" onClick={() => handleOpenDeleteClass(cls)}>
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                  {allClasses?.length === 0 && <p className="text-muted-foreground">No classes found.</p>}
                </div>
              )}
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
                  <Button variant="outline" size="sm" onClick={() => setIsAcademicReportOpen(true)}>View Report</Button>
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
                  <Button variant="outline" size="sm" className="mt-auto" onClick={handleOpenSchoolProfile}>
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
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={val => setFormData({ ...formData, role: val })}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>Cancel</Button>
            <Button onClick={() => addUserMutation.mutate(formData)} disabled={addUserMutation.isPending}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={val => setFormData({ ...formData, role: val })}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedUser && editUserMutation.mutate({ id: selectedUser.id, data: formData })} disabled={editUserMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.displayName || selectedUser?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteUserOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)} disabled={deleteUserMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
      <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Class Name</Label>
              <Input value={classFormData.name} onChange={e => setClassFormData({ ...classFormData, name: e.target.value })} placeholder="e.g. Science 101" />
            </div>
            <div className="grid gap-2">
              <Label>Grade/Level</Label>
              <Input value={classFormData.grade} onChange={e => setClassFormData({ ...classFormData, grade: e.target.value })} placeholder="e.g. 10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddClassOpen(false)}>Cancel</Button>
            <Button onClick={() => addClassMutation.mutate(classFormData)} disabled={addClassMutation.isPending}>Add Class</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditClassOpen} onOpenChange={setIsEditClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Class Name</Label>
              <Input value={classFormData.name} onChange={e => setClassFormData({ ...classFormData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Grade/Level</Label>
              <Input value={classFormData.grade} onChange={e => setClassFormData({ ...classFormData, grade: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditClassOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedClass && editClassMutation.mutate({ id: selectedClass.id, data: classFormData })} disabled={editClassMutation.isPending}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteClassOpen} onOpenChange={setIsDeleteClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete class {selectedClass?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteClassOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedClass && deleteClassMutation.mutate(selectedClass.id)} disabled={deleteClassMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
      <Dialog open={isAcademicReportOpen} onOpenChange={setIsAcademicReportOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Academic Performance Report</DialogTitle>
            <DialogDescription>
              Overview of student test performance and completion rates.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {isLoadingAnalytics ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="rounded-md border max-h-[60vh] overflow-auto">
                <div className="grid grid-cols-4 items-center border-b bg-muted/50 p-3 font-medium">
                  <div>Student Name</div>
                  <div>Avg Score</div>
                  <div>Completion Rate</div>
                  <div>Recent Attempts</div>
                </div>
                <div className="divide-y">
                  {(studentAnalytics || []).map((student, i) => (
                    <div key={i} className="grid grid-cols-4 items-center p-3 text-sm">
                      <div>{student.name}</div>
                      <div>{student.averageScore}%</div>
                      <div>{Math.round(student.completionRate * 100)}%</div>
                      <div>{student.recentAttempts?.length || 0}</div>
                    </div>
                  ))}
                  {(!studentAnalytics || studentAnalytics.length === 0) && (
                    <div className="p-4 text-center text-muted-foreground">No analytical data found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAcademicReportOpen(false)}>Close</Button>
            <Button onClick={downloadAcademicCSV}>Export CSV</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSchoolProfileOpen} onOpenChange={setIsSchoolProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Institution Profile</DialogTitle>
            <DialogDescription>
              Update your school or institution's public profile information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Institution Name</Label>
              <Input 
                value={schoolFormData.name} 
                onChange={e => setSchoolFormData({ ...schoolFormData, name: e.target.value })} 
              />
            </div>
            <div className="grid gap-2">
              <Label>City</Label>
              <Input 
                value={schoolFormData.city} 
                onChange={e => setSchoolFormData({ ...schoolFormData, city: e.target.value })} 
              />
            </div>
            <div className="grid gap-2">
              <Label>Educational Board</Label>
              <Input 
                value={schoolFormData.board} 
                onChange={e => setSchoolFormData({ ...schoolFormData, board: e.target.value })} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSchoolProfileOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => updateSchoolMutation.mutate(schoolFormData)} 
              disabled={updateSchoolMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
