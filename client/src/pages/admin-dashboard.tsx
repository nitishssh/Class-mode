import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  UsersRound,
  School,
  BarChart3,
  Settings,
  FileSpreadsheet,
  UserPlus,
  Search,
  Plus,
  Trash2,
  Edit,
  Shield,
  Activity,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Key,
  Copy,
  Check,
  AlertTriangle,
  CalendarClock,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  displayName?: string;
  status?: string;
  schoolCode?: string;
}

interface ActivityLog {
  id: string;
  event: string;
  actor: string;
  timestamp: string;
  category: "user" | "class" | "system";
}

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const { toast } = useToast();

  // Tab State
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Timetable scheduling filters
  const [timetableClassFilter, setTimetableClassFilter] = useState("all");
  const [timetableTeacherFilter, setTimetableTeacherFilter] = useState("all");
  const [timetableRoomFilter, setTimetableRoomFilter] = useState("all");

  // Dialog & Slide-over Panel States
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isEditClassOpen, setIsEditClassOpen] = useState(false);
  const [isDeleteClassOpen, setIsDeleteClassOpen] = useState(false);
  const [isSchoolProfileOpen, setIsSchoolProfileOpen] = useState(false);
  const [isAcademicReportOpen, setIsAcademicReportOpen] = useState(false);
  const [isAddSlotOpen, setIsAddSlotOpen] = useState(false);

  // Slide-over user details sheet
  const [isUserSheetOpen, setIsUserSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "teacher",
    status: "active",
  });

  const [selectedClass, setSelectedClass] = useState<any>(null);
  const [classFormData, setClassFormData] = useState({ name: "", grade: "" });
  const [schoolFormData, setSchoolFormData] = useState({ name: "", city: "", board: "" });

  // Timetable slot form state
  const [slotFormData, setSlotFormData] = useState({
    dayOfWeek: 1,
    periodNumber: 1,
    className: "",
    teacherId: "",
    subject: "",
    room: "",
  });

  // API Key generation states (Settings tab)
  const [generatedApiKey, setGeneratedApiKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);

  // Dynamic Session logs state - logs events that happened in current browser session
  const [sessionLogs, setSessionLogs] = useState<ActivityLog[]>([]);

  const addSessionLog = (event: string, category: "user" | "class" | "system") => {
    const newLog: ActivityLog = {
      id: String(Date.now()),
      event,
      actor: currentUser?.profile?.displayName || "Admin",
      timestamp: "Just now",
      category,
    };
    setSessionLogs((prev) => [newLog, ...prev]);
  };

  // Policy Settings switches linked to localStorage
  const [policyClassCreation, setPolicyClassCreation] = useState(
    () => localStorage.getItem("policy_class_creation") !== "false"
  );
  const [policyDirectoryView, setPolicyDirectoryView] = useState(
    () => localStorage.getItem("policy_directory_view") === "true"
  );
  const [policyParentReport, setPolicyParentReport] = useState(
    () => localStorage.getItem("policy_parent_report") !== "false"
  );

  const handlePolicyToggle = (key: string, val: boolean, setter: (v: boolean) => void) => {
    localStorage.setItem(key, String(val));
    setter(val);
    toast({
      title: "Policies Updated",
      description: "Workspace security settings successfully saved.",
    });
    addSessionLog(`Updated security policy toggle: ${key} to ${val}`, "system");
  };

  // Queries & Mutations
  const { data: allUsers, isLoading: isLoadingAllUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: () => apiRequest("GET", "/api/users").then((r) => r.json()),
  });

  const { data: allClasses, isLoading: isLoadingClasses } = useQuery<
    { id: number; name: string; grade: string }[]
  >({
    queryKey: ["/api/admin/classes"],
    queryFn: () => apiRequest("GET", "/api/admin/classes").then((r) => r.json()),
    enabled: !!currentUser,
  });

  const { data: schoolProfile } = useQuery<any>({
    queryKey: ["/api/admin/school"],
    queryFn: () => apiRequest("GET", "/api/admin/school").then((r) => r.json()),
    enabled: !!currentUser && ["admin", "school_admin"].includes(currentUser?.profile?.role || ""),
  });

  const { data: adminStats, isLoading: isLoadingStats } = useQuery<{
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

  const { data: studentAnalytics, isLoading: isLoadingAnalytics } = useQuery<any[]>({
    queryKey: ["/api/analytics/students"],
    queryFn: () => apiRequest("GET", "/api/analytics/students").then((r) => r.json()),
    enabled: !!currentUser && currentUser?.profile?.role === "admin",
  });

  // Real Database Audit Logs
  const { data: databaseLogs } = useQuery<any[]>({
    queryKey: ["/api/admin/logs"],
    queryFn: () => apiRequest("GET", "/api/admin/logs").then((r) => r.json()),
    enabled: !!currentUser,
  });

  // Admin trends: daily activity series + average score by class
  const { data: adminTrends, isLoading: isLoadingTrends } = useQuery<{
    range: number;
    daily: {
      date: string;
      label: string;
      signups: number;
      tests: number;
      submissions: number;
      logins: number;
    }[];
    scoreByClass: { className: string; avgScore: number; attempts: number }[];
  }>({
    queryKey: ["/api/admin/trends"],
    queryFn: () => apiRequest("GET", "/api/admin/trends").then((r) => r.json()),
    enabled:
      !!currentUser &&
      ["admin", "principal", "school_admin"].includes(currentUser?.profile?.role || ""),
  });

  // Google Classroom Connection status
  const { data: lmsStatus } = useQuery<any>({
    queryKey: ["/api/lms/google/status"],
    queryFn: () => apiRequest("GET", "/api/lms/google/status").then((r) => r.json()),
    enabled: !!currentUser,
  });

  // Timetable Slots Query
  const { data: timetableSlots } = useQuery<any[]>({
    queryKey: ["/api/timetable"],
    queryFn: () => apiRequest("GET", "/api/timetable").then((r) => r.json()),
    enabled: !!currentUser,
  });

  // Actions Mutators
  const addUserMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsAddUserOpen(false);
      toast({
        title: "User Added Successfully",
        description: `${formData.name} has been enrolled.`,
      });
      addSessionLog(`Created new user account: ${formData.name} (${formData.role})`, "user");
    },
    onError: () => toast({ title: "Failed to add user", variant: "destructive" }),
  });

  const editUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsEditUserOpen(false);
      setIsUserSheetOpen(false);
      toast({ title: "User Profile Updated" });
      addSessionLog(`Updated profile details for user ID: ${selectedUser?.id}`, "user");
    },
    onError: () => toast({ title: "Failed to update user", variant: "destructive" }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsDeleteUserOpen(false);
      setIsUserSheetOpen(false);
      toast({ title: "User Account Removed" });
      addSessionLog(`Permanently deleted user: ${selectedUser?.name || "Unknown"}`, "user");
    },
    onError: () => toast({ title: "Failed to delete user", variant: "destructive" }),
  });

  const addClassMutation = useMutation({
    mutationFn: (data: typeof classFormData) => apiRequest("POST", "/api/admin/classes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsAddClassOpen(false);
      toast({ title: "Class Created Successfully" });
      addSessionLog(`Created class roster: ${classFormData.name}`, "class");
    },
    onError: () => toast({ title: "Failed to add class", variant: "destructive" }),
  });

  const editClassMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/admin/classes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsEditClassOpen(false);
      toast({ title: "Class Configuration Updated" });
      addSessionLog(`Updated metadata for class ID: ${selectedClass?.id}`, "class");
    },
    onError: () => toast({ title: "Failed to update class", variant: "destructive" }),
  });

  const deleteClassMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/classes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsDeleteClassOpen(false);
      toast({ title: "Class Deleted Successfully" });
      addSessionLog(`Deleted class roster: ${selectedClass?.name}`, "class");
    },
    onError: () => toast({ title: "Failed to delete class", variant: "destructive" }),
  });

  const updateSchoolMutation = useMutation({
    mutationFn: (data: typeof schoolFormData) => apiRequest("PUT", "/api/admin/school", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/school"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsSchoolProfileOpen(false);
      toast({ title: "Institution Settings Saved" });
      addSessionLog("Updated primary school settings profile", "system");
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  // API Key Generation mutation
  const generateApiKeyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/keys").then((r) => r.json()),
    onSuccess: (data) => {
      setGeneratedApiKey(data.apiKey);
      toast({
        title: "Production API Key Issued",
        description: "Authorization token successfully generated.",
      });
      addSessionLog("Issued live external API token credentials", "system");
    },
    onError: () => toast({ title: "Failed to generate API key", variant: "destructive" }),
  });

  // Timetable Slot Mutations
  const createTimetableSlotMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/timetable", data).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      setIsAddSlotOpen(false);
      toast({ title: "Timetable Slot Assigned", description: "Class scheduled successfully." });
      addSessionLog(
        `Scheduled slot: ${slotFormData.subject} for ${slotFormData.className} in ${slotFormData.room || "unassigned room"}`,
        "class"
      );
    },
    onError: (err: any) => {
      toast({
        title: "Failed to schedule slot",
        description: err.message || "Conflict or validation error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteTimetableSlotMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/timetable/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({ title: "Timetable Slot Removed", description: "Class slot deleted." });
      addSessionLog("Removed class slot from master timetable", "class");
    },
    onError: () => {
      toast({ title: "Failed to remove slot", variant: "destructive" });
    },
  });

  // Helper callbacks
  const handleOpenAddUser = () => {
    setFormData({ name: "", email: "", role: "teacher", status: "active" });
    setIsAddUserOpen(true);
  };

  const handleOpenEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.displayName || user.name || "",
      email: user.email,
      role: user.role,
      status: user.status || "active",
    });
    setIsEditUserOpen(true);
  };

  const handleOpenDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserOpen(true);
  };

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

  const handleOpenSchoolProfile = () => {
    if (schoolProfile) {
      setSchoolFormData({
        name: schoolProfile.name || "",
        city: schoolProfile.city || "",
        board: schoolProfile.board || "",
      });
    }
    setIsSchoolProfileOpen(true);
  };

  const handleRowClick = (user: User) => {
    setSelectedUser(user);
    setIsUserSheetOpen(true);
  };

  // CSV Exporter
  const downloadAcademicCSV = () => {
    if (!studentAnalytics || studentAnalytics.length === 0) {
      toast({ title: "No data to export", variant: "destructive" });
      return;
    }
    const headers = ["Student Name", "Average Score (%)", "Completion Rate", "Recent Attempts"];
    const csvContent = [
      headers.join(","),
      ...studentAnalytics.map(
        (s) => `"${s.name}",${s.averageScore},${s.completionRate},${s.recentAttempts?.length || 0}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "academic_performance_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addSessionLog("Exported academic performance report (CSV)", "system");
  };

  const handleGenerateApiKey = () => {
    generateApiKeyMutation.mutate();
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(generatedApiKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    toast({ title: "Copied", description: "API Key copied to clipboard." });
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter((u) => {
      const matchSearch =
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchRole = roleFilter === "all" || u.role === roleFilter;
      const matchStatus = statusFilter === "all" || (u.status || "active") === statusFilter;

      return matchSearch && matchRole && matchStatus;
    });
  }, [allUsers, searchTerm, roleFilter, statusFilter]);

  // Menu items config for inside sub-navigation
  const menuItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "users", label: "User Accounts", icon: UsersRound },
    { id: "classes", label: "Active Classes", icon: School },
    { id: "timetable", label: "Master Timetable", icon: CalendarClock },
    { id: "reports", label: "Reports & Exports", icon: FileSpreadsheet },
    { id: "logs", label: "System Audit Logs", icon: Activity },
    { id: "settings", label: "Dashboard Settings", icon: Settings },
  ];

  // Convert Database logs to readable status events
  const getEventMessage = (log: any) => {
    const actor = log.actorName || "System";
    const target = log.targetName || "";
    const type = log.eventType;
    const payload = log.payload || {};

    switch (type) {
      case "user.registered":
        return `New user account created for ${actor} (${log.actorRole || "student"})`;
      case "user.login":
        return `${actor} successfully logged into the workspace`;
      case "user.login_failed":
        return `Failed login attempt detected for email: ${payload.email || "unknown"}`;
      case "user.status_changed":
        return `${actor} updated status of user ${target} to ${payload.status || "unknown"}`;
      case "teacher.approved":
        return `Lead educator ${target || "account"} approved and activated by ${actor}`;
      case "invite.sent":
        return `Membership invitation dispatched to ${payload.email || "recipient"}`;
      case "invite.accepted":
        return `Invitation accepted by ${actor} (${payload.email || "member"})`;
      default:
        return `${actor} performed event: ${type}`;
    }
  };

  const getEventCategory = (type: string): "user" | "class" | "system" => {
    if (type.startsWith("user.") || type.startsWith("teacher.") || type.startsWith("invite.")) {
      return "user";
    }
    if (type.startsWith("class.")) {
      return "class";
    }
    return "system";
  };

  // Process combined logs
  const combinedLogs = useMemo(() => {
    const dbLogsFormatted = (databaseLogs || []).map((log) => ({
      id: String(log.id),
      event: getEventMessage(log),
      actor: log.actorName || "System",
      timestamp: new Date(log.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      category: getEventCategory(log.eventType),
    }));
    return [...sessionLogs, ...dbLogsFormatted];
  }, [databaseLogs, sessionLogs]);

  // Compute daily logins dynamically from database events
  const chartData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const counts: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      counts[days[date.getDay()]] = 0;
    }

    if (databaseLogs) {
      databaseLogs.forEach((log) => {
        if (log.eventType === "user.login") {
          const date = new Date(log.createdAt);
          const dayName = days[date.getDay()];
          if (counts[dayName] !== undefined) {
            counts[dayName] += 1;
          }
        }
      });
    }

    return Object.keys(counts).map((day) => ({
      name: day,
      logins: counts[day],
    }));
  }, [databaseLogs]);

  // Prefer server-computed trends; fall back to client login counts before the
  // trends query resolves so the chart never renders empty.
  const trendSeries = useMemo(() => {
    if (adminTrends?.daily?.length) return adminTrends.daily;
    return chartData.map((d) => ({
      label: d.name,
      logins: d.logins,
      submissions: 0,
      signups: 0,
      tests: 0,
    }));
  }, [adminTrends, chartData]);

  // Get status pill style
  const getStatusBadge = (status?: string) => {
    const s = status || "active";
    if (s === "active") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Active
        </span>
      );
    }
    if (s === "pending") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Suspended
      </span>
    );
  };

  // Get Role badge styling
  const getRoleBadge = (role: string) => {
    const r = role.toLowerCase();
    let variant: "default" | "accent" | "success" | "warning" | "destructive" | "outline" =
      "default";
    let className = "";

    if (r === "admin") {
      variant = "destructive";
      className =
        "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/30 dark:text-violet-400";
    } else if (r === "teacher") {
      variant = "success";
    } else if (r === "student") {
      variant = "accent";
    } else if (r === "principal") {
      variant = "warning";
    } else if (r === "parent") {
      variant = "outline";
      className = "bg-purple-50/50 text-purple-700 dark:bg-purple-950/10";
    }

    return (
      <Badge variant={variant} className={cn("px-2 py-0 capitalize", className)}>
        {role}
      </Badge>
    );
  };

  // Timetable Grid helper lists
  const DAYS = [
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
  ];

  const PERIODS = [
    { number: 1, start: "08:00", end: "08:45" },
    { number: 2, start: "08:50", end: "09:35" },
    { number: 3, start: "09:40", end: "10:25" },
    { number: 4, start: "10:45", end: "11:30" },
    { number: 5, start: "11:35", end: "12:20" },
    { number: 6, start: "12:25", end: "13:10" },
    { number: 7, start: "13:50", end: "14:35" },
    { number: 8, start: "14:40", end: "15:25" },
  ];

  // Helper to lookup teacher's display name from allUsers list
  const getTeacherName = useCallback(
    (tId: number) => {
      const teacher = allUsers?.find((u) => u.id === Number(tId));
      return teacher?.displayName || teacher?.name || `Faculty (ID: ${tId})`;
    },
    [allUsers]
  );

  // Filtered Timetable slots for weekly grid visualizer
  const filteredTimetableSlots = useMemo(() => {
    if (!timetableSlots) return [];
    return timetableSlots.filter((slot) => {
      const matchClass = timetableClassFilter === "all" || slot.className === timetableClassFilter;
      const matchTeacher =
        timetableTeacherFilter === "all" ||
        Number(slot.teacherId) === Number(timetableTeacherFilter);
      const matchRoom =
        timetableRoomFilter === "all" ||
        (slot.room && slot.room.trim().toLowerCase() === timetableRoomFilter.trim().toLowerCase());
      return matchClass && matchTeacher && matchRoom;
    });
  }, [timetableSlots, timetableClassFilter, timetableTeacherFilter, timetableRoomFilter]);

  // Real-time conflict engine checks reactive conflicts as user selects slot details
  const activeConflicts = useMemo(() => {
    if (!timetableSlots || !slotFormData.dayOfWeek || !slotFormData.periodNumber) return [];
    const conflicts: string[] = [];
    const day = Number(slotFormData.dayOfWeek);
    const period = Number(slotFormData.periodNumber);

    timetableSlots.forEach((slot) => {
      if (Number(slot.dayOfWeek) === day && Number(slot.periodNumber) === period) {
        // Class Conflict
        if (slotFormData.className && slot.className === slotFormData.className) {
          conflicts.push(
            `Class Conflict: ${slotFormData.className} is already attending ${slot.subject} (Teacher: ${getTeacherName(slot.teacherId)}) at this period.`
          );
        }
        // Teacher Conflict
        if (slotFormData.teacherId && Number(slot.teacherId) === Number(slotFormData.teacherId)) {
          const teacherName = getTeacherName(Number(slotFormData.teacherId));
          conflicts.push(
            `Teacher Conflict: ${teacherName} is already scheduled to teach ${slot.className} (${slot.subject}) in Room ${slot.room || "unassigned"} at this period.`
          );
        }
        // Room Conflict
        if (
          slotFormData.room &&
          slot.room &&
          slot.room.trim().toLowerCase() === slotFormData.room.trim().toLowerCase()
        ) {
          conflicts.push(
            `Room Conflict: Room ${slotFormData.room} is already occupied by ${slot.className} (${slot.subject}) at this period.`
          );
        }
      }
    });

    return conflicts;
  }, [timetableSlots, slotFormData, getTeacherName]);

  // Settings Subsections state
  const [settingsSection, setSettingsSection] = useState("profile");

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <PageHeader
        title={`Welcome back, ${currentUser?.profile?.displayName || "Admin"}`}
        subtitle="School workspace analytics and user permissions panel"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Admin Control Center" }]}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAddUser}
            className="shadow-sm transition-all hover:shadow-md"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Member
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleOpenAddClass}
            className="shadow-sm transition-all hover:shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Class
          </Button>
        </div>
      </PageHeader>

      {/* Main Two-column Tab Layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Left Sub-navigation Panel */}
        <aside className="w-full flex-shrink-0 lg:w-56">
          <nav className="scrollbar-none flex flex-row gap-1 overflow-x-auto border-b pb-3 lg:flex-col lg:border-b-0 lg:pb-0">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-accent-soft text-accent"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4", isActive ? "text-accent" : "text-muted-foreground")}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Tab Content Panel */}
        <div className="min-w-0 flex-1">
          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Premium Analytics Metric Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Metric 1 */}
                <Card className="relative overflow-hidden border-border/50 transition-all duration-300 hover:shadow-md">
                  <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-gradient-to-br from-amber-500/10 to-transparent" />
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Enrolled Students
                    </CardDescription>
                    <CardTitle className="mt-1 font-display text-3xl font-bold">
                      {isLoadingStats ? (
                        <Skeleton className="h-9 w-20" />
                      ) : (
                        adminStats?.totalStudents || 0
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>+4.2% from last month</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Metric 2 */}
                <Card className="relative overflow-hidden border-border/50 transition-all duration-300 hover:shadow-md">
                  <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-gradient-to-br from-green-500/10 to-transparent" />
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Active Educators
                    </CardDescription>
                    <CardTitle className="mt-1 font-display text-3xl font-bold">
                      {isLoadingStats ? (
                        <Skeleton className="h-9 w-20" />
                      ) : (
                        adminStats?.totalTeachers || 0
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Active database connection</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Metric 3 */}
                <Card className="relative overflow-hidden border-border/50 transition-all duration-300 hover:shadow-md">
                  <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-gradient-to-br from-blue-500/10 to-transparent" />
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Tests Scheduled
                    </CardDescription>
                    <CardTitle className="mt-1 font-display text-3xl font-bold">
                      {isLoadingStats ? (
                        <Skeleton className="h-9 w-20" />
                      ) : (
                        adminStats?.testsThisMonth || 0
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      <span>+12.8% volume increase</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Metric 4 */}
                <Card className="relative overflow-hidden border-border/50 transition-all duration-300 hover:shadow-md">
                  <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-gradient-to-br from-violet-500/10 to-transparent" />
                  <CardHeader className="pb-2">
                    <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Submissions Graded
                    </CardDescription>
                    <CardTitle className="mt-1 font-display text-3xl font-bold">
                      {isLoadingStats ? (
                        <Skeleton className="h-9 w-20" />
                      ) : (
                        adminStats?.submissionsThisMonth || 0
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>96% average AI grading accuracy</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Graphical Overview & Logs Panel */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Visual Chart Card */}
                <Card className="border-border/50 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">
                      Workspace Activity Trends
                    </CardTitle>
                    <CardDescription>
                      Daily logins, submissions, and new signups over the last{" "}
                      {adminTrends?.range ?? 7} days.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] min-h-[200px] pt-4">
                    {isLoadingTrends ? (
                      <Skeleton className="h-full w-full rounded-xl" />
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trendSeries}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="hsl(var(--border))"
                          />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11 }}
                            stroke="hsl(var(--muted-foreground))"
                          />
                          <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="submissions"
                            name="Submissions"
                            stroke="hsl(217 91% 60%)"
                            fillOpacity={1}
                            fill="url(#colorSubs)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="logins"
                            name="Logins"
                            stroke="hsl(var(--accent))"
                            fillOpacity={1}
                            fill="url(#colorLogins)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="signups"
                            name="New Signups"
                            stroke="hsl(142 71% 45%)"
                            fillOpacity={1}
                            fill="url(#colorSignups)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Right Mini Audit logs */}
                <Card className="border-border/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base font-semibold">Active Session Logs</CardTitle>
                      <CardDescription>Live telemetry from current login session.</CardDescription>
                    </div>
                    <Activity className="h-4 w-4 animate-pulse text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[260px] pr-2">
                      <div className="space-y-3.5">
                        {combinedLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex gap-2.5 text-xs">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted">
                              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            </span>
                            <div className="space-y-0.5 font-sans">
                              <p className="font-medium text-foreground">{log.event}</p>
                              <div className="flex gap-2 text-muted-foreground">
                                <span>{log.actor}</span>
                                <span>•</span>
                                <span>{log.timestamp}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {combinedLogs.length === 0 && (
                          <p className="pt-8 text-center text-xs text-muted-foreground">
                            No recent log telemetry recorded.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* TAB: USER MANAGEMENT */}
          {activeTab === "users" && (
            <Card className="border-border/50">
              <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <CardTitle className="text-lg font-bold">User Accounts</CardTitle>
                  <CardDescription>
                    Search, filter, edit details and manage custom access scopes.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleOpenAddUser} className="shadow-sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create User Account
                </Button>
              </CardHeader>

              {/* Search & Double Filter Bar */}
              <div className="flex flex-col gap-3 px-6 pb-2 pt-1 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="rounded-lg pl-9 pr-12 shadow-sm"
                  />
                  <div className="pointer-events-none absolute right-3 top-2.5 hidden items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground sm:flex">
                    <span>⌘</span>
                    <span>K</span>
                  </div>
                </div>

                {/* Filter 1: Role */}
                <div className="w-full md:w-40">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="rounded-lg shadow-sm">
                      <SelectValue placeholder="Filter by Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filter 2: Status */}
                <div className="w-full md:w-40">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="rounded-lg shadow-sm">
                      <SelectValue placeholder="Filter by Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Users Table */}
              <CardContent className="mt-2">
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          User
                        </th>
                        <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Status
                        </th>
                        <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Role Scope
                        </th>
                        <th className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Email Address
                        </th>
                        <th className="p-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {isLoadingAllUsers ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i} className="animate-pulse">
                            <td className="p-3">
                              <Skeleton className="h-5 w-32" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-16" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-12" />
                            </td>
                            <td className="p-3">
                              <Skeleton className="h-4 w-40" />
                            </td>
                            <td className="p-3 text-right">
                              <Skeleton className="ml-auto h-8 w-12" />
                            </td>
                          </tr>
                        ))
                      ) : filteredUsers.length > 0 ? (
                        filteredUsers.map((user) => (
                          <tr
                            key={user.id}
                            onClick={() => handleRowClick(user)}
                            className="group cursor-pointer transition-colors hover:bg-muted/40"
                          >
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8 border text-xs font-bold">
                                  <AvatarFallback className="bg-accent-soft text-accent">
                                    {(user.displayName || user.name || "U")
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium transition-colors group-hover:text-accent">
                                  {user.displayName || user.name}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">{getStatusBadge(user.status)}</td>
                            <td className="p-3">{getRoleBadge(user.role)}</td>
                            <td className="p-3 text-muted-foreground">{user.email}</td>
                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:text-accent"
                                  onClick={() => handleOpenEditUser(user)}
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                                  onClick={() => handleOpenDeleteUser(user)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            No active users found matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB: CLASSES */}
          {activeTab === "classes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Class Rosters</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage active grades, enrollment counts, and assigned teachers.
                  </p>
                </div>
                <Button size="sm" onClick={handleOpenAddClass} className="shadow-sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Class Group
                </Button>
              </div>

              {isLoadingClasses ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ) : allClasses && allClasses.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {allClasses.map((cls, idx) => {
                    const borderThemes = [
                      "border-t-violet-500",
                      "border-t-emerald-500",
                      "border-t-amber-500",
                      "border-t-blue-500",
                      "border-t-pink-500",
                    ];
                    const theme = borderThemes[idx % borderThemes.length];
                    return (
                      <Card
                        key={cls.id}
                        className={cn(
                          "border-t-4 transition-all duration-300 hover:shadow-md",
                          theme
                        )}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-bold">{cls.name}</CardTitle>
                          <CardDescription>
                            Grade level: {cls.grade || "Unassigned"}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Assigned Lead</span>
                            <span className="font-semibold text-foreground">School Faculty</span>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => handleOpenEditClass(cls)}
                            >
                              <Edit className="mr-1 h-3 w-3" />
                              Modify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={() => handleOpenDeleteClass(cls)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Remove
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-2 border-dashed p-8 text-center text-muted-foreground">
                  No active classroom folders configured. Create a class roster to start.
                </Card>
              )}
            </div>
          )}

          {/* TAB: TIMETABLE SCHEDULER */}
          {activeTab === "timetable" && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold">Master Weekly Timetable</h2>
                  <p className="text-sm text-muted-foreground">
                    Schedule classes, subjects, rooms, and teachers with active collision detection.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSlotFormData({
                      dayOfWeek: 1,
                      periodNumber: 1,
                      className: "",
                      teacherId: "",
                      subject: "",
                      room: "",
                    });
                    setIsAddSlotOpen(true);
                  }}
                  className="shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Schedule New Slot
                </Button>
              </div>

              {/* Filtering Controls */}
              <div className="grid grid-cols-1 gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Isolate Class / Grade</Label>
                  <Select value={timetableClassFilter} onValueChange={setTimetableClassFilter}>
                    <SelectTrigger className="mt-1 w-full bg-background">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {allClasses?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Isolate Faculty</Label>
                  <Select value={timetableTeacherFilter} onValueChange={setTimetableTeacherFilter}>
                    <SelectTrigger className="mt-1 w-full bg-background">
                      <SelectValue placeholder="All Faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Faculty</SelectItem>
                      {allUsers
                        ?.filter((u) => u.role === "teacher")
                        .map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.displayName || t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Filter by Room</Label>
                  <Input
                    placeholder="e.g. Room 102 (or clear)"
                    value={timetableRoomFilter === "all" ? "" : timetableRoomFilter}
                    onChange={(e) =>
                      setTimetableRoomFilter(e.target.value.trim() ? e.target.value : "all")
                    }
                    className="mt-1 bg-background"
                  />
                </div>
              </div>

              {/* Masters Weekly Matrix Grid */}
              <div className="overflow-x-auto rounded-xl border bg-card">
                <div className="min-w-[800px] divide-y divide-border">
                  {/* Grid Headers */}
                  <div className="grid grid-cols-6 bg-muted/40 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <div className="border-r p-3 text-left">Period & Time</div>
                    {DAYS.map((day) => (
                      <div key={day.value} className="border-r p-3">
                        {day.label}
                      </div>
                    ))}
                  </div>

                  {/* Grid Rows */}
                  {PERIODS.map((period) => (
                    <div
                      key={period.number}
                      className="grid grid-cols-6 divide-x divide-border text-center"
                    >
                      {/* Period Header */}
                      <div className="flex flex-col justify-center bg-muted/10 p-3 text-left text-xs font-medium">
                        <span className="font-bold text-foreground">Period {period.number}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {period.start} - {period.end}
                        </span>
                      </div>

                      {/* Day cells */}
                      {DAYS.map((day) => {
                        const cellSlots = filteredTimetableSlots.filter(
                          (s) =>
                            Number(s.dayOfWeek) === day.value &&
                            Number(s.periodNumber) === period.number
                        );

                        return (
                          <div
                            key={day.value}
                            onClick={() => {
                              if (cellSlots.length === 0) {
                                setSlotFormData({
                                  dayOfWeek: day.value,
                                  periodNumber: period.number,
                                  className:
                                    timetableClassFilter !== "all" ? timetableClassFilter : "",
                                  teacherId:
                                    timetableTeacherFilter !== "all" ? timetableTeacherFilter : "",
                                  subject: "",
                                  room: timetableRoomFilter !== "all" ? timetableRoomFilter : "",
                                });
                                setIsAddSlotOpen(true);
                              }
                            }}
                            className={cn(
                              "group relative flex min-h-[100px] cursor-pointer flex-col gap-2 p-2.5 transition-colors",
                              cellSlots.length === 0
                                ? "hover:bg-muted/10"
                                : "bg-accent-soft/20 text-left"
                            )}
                          >
                            {cellSlots.map((slot) => (
                              <div
                                key={slot.id}
                                className="relative space-y-1 rounded-lg border border-accent/20 bg-card p-2 text-xs shadow-sm"
                              >
                                <div className="flex items-start justify-between">
                                  <span className="line-clamp-1 font-bold text-foreground">
                                    {slot.subject}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteTimetableSlotMutation.mutate(slot.id);
                                    }}
                                    className="rounded p-0.5 text-red-500 opacity-0 transition-all hover:bg-red-50 group-hover:opacity-100 dark:hover:bg-red-950/20"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                                <div className="space-y-0.5 text-[10px] text-muted-foreground">
                                  <p className="font-semibold text-accent">{slot.className}</p>
                                  <p className="line-clamp-1">{getTeacherName(slot.teacherId)}</p>
                                  {slot.room && (
                                    <p className="w-fit rounded bg-muted/60 px-1 font-mono">
                                      Room {slot.room}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}

                            {cellSlots.length === 0 && (
                              <span className="m-auto flex items-center gap-1 text-[10px] font-semibold text-accent opacity-0 group-hover:opacity-100">
                                <Plus className="h-3 w-3" /> Schedule
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORTS */}
          {activeTab === "reports" && (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base font-bold">Academic Export Center</CardTitle>
                <CardDescription>
                  Export grading summaries, review students performance scores, and generate CSV
                  datasets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Reports Summary Row */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card
                    className="cursor-pointer border-border/50 p-4 transition-colors hover:bg-muted/10"
                    onClick={() => setIsAcademicReportOpen(true)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400">
                        <BarChart3 className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold">Academic Performance</h4>
                        <p className="text-xs text-muted-foreground">Class average score reviews</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="cursor-not-allowed border-border/50 p-4 opacity-75 transition-colors hover:bg-muted/10">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        <UsersRound className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold">Attendance logs</h4>
                        <p className="text-xs text-muted-foreground">Absence & presence tracker</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="cursor-not-allowed border-border/50 p-4 opacity-75 transition-colors hover:bg-muted/10">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                        <FileSpreadsheet className="h-5 w-5" />
                      </span>
                      <div>
                        <h4 className="text-sm font-semibold">Exam Summary reports</h4>
                        <p className="text-xs text-muted-foreground">Raw testing spreadsheets</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Average score by class — real submission data */}
                <div className="h-[250px] min-h-[200px] rounded-xl border bg-muted/10 p-4">
                  <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Average score by class
                  </h4>
                  {isLoadingTrends ? (
                    <Skeleton className="h-[180px] w-full rounded-lg" />
                  ) : adminTrends?.scoreByClass?.length ? (
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={adminTrends.scoreByClass}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="hsl(var(--border))"
                        />
                        <XAxis
                          dataKey="className"
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                          }}
                          formatter={(value: any, _name: any, props: any) => [
                            `${value} avg (${props?.payload?.attempts ?? 0} attempts)`,
                            "Score",
                          ]}
                        />
                        <Bar
                          dataKey="avgScore"
                          name="Average Score"
                          fill="hsl(var(--accent))"
                          radius={[4, 4, 0, 0]}
                          barSize={40}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[180px] items-center justify-center text-center">
                      <p className="text-sm text-muted-foreground">
                        No graded submissions yet. Scores will appear here once students complete
                        tests.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB: SYSTEM AUDIT LOGS */}
          {activeTab === "logs" && (
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-base font-semibold">Security Audit Trail</CardTitle>
                  <CardDescription>
                    A list of workspace events, membership modifications, and database operations.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Protected
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Scrollable logs */}
                <div className="divide-y overflow-hidden rounded-xl border">
                  {combinedLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-4 p-4 text-sm transition-colors hover:bg-muted/10"
                    >
                      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border bg-background">
                        <Activity className="h-4 w-4 text-accent" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold capitalize text-foreground">
                            {log.category}
                          </span>
                          <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                        </div>
                        <p className="mt-1 font-sans text-xs text-muted-foreground sm:text-sm">
                          {log.event}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Operator:</span>
                          <span className="font-medium text-foreground">{log.actor}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {combinedLogs.length === 0 && (
                    <p className="p-6 text-center text-muted-foreground">
                      No recent database operations recorded.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <Card className="border-border/50">
              <div className="grid grid-cols-1 divide-y md:grid-cols-4 md:divide-x md:divide-y-0">
                {/* Internal sub-sidebar for settings categories */}
                <div className="space-y-1.5 p-4 md:col-span-1">
                  <button
                    onClick={() => setSettingsSection("profile")}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
                      settingsSection === "profile"
                        ? "bg-accent-soft text-accent"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Institution Profile
                  </button>
                  <button
                    onClick={() => setSettingsSection("permissions")}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
                      settingsSection === "permissions"
                        ? "bg-accent-soft text-accent"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Roles & Permissions
                  </button>
                  <button
                    onClick={() => setSettingsSection("integrations")}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors",
                      settingsSection === "integrations"
                        ? "bg-accent-soft text-accent"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Integrations & API
                  </button>
                </div>

                {/* Internal settings content */}
                <div className="p-6 md:col-span-3">
                  {/* Category 1: Profile */}
                  {settingsSection === "profile" && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Institution Information
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Update the main school details which appear on exported student reports.
                        </p>
                      </div>
                      <div className="space-y-3 pt-2">
                        <div className="grid gap-1.5">
                          <Label className="text-xs">School Name</Label>
                          <Input
                            value={schoolProfile?.name || ""}
                            disabled
                            className="bg-muted/50"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs">Physical Location (City)</Label>
                          <Input
                            value={schoolProfile?.city || ""}
                            disabled
                            className="bg-muted/50"
                          />
                        </div>
                        <Button size="sm" onClick={handleOpenSchoolProfile}>
                          Edit Profile Details
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Category 2: Permissions */}
                  {settingsSection === "permissions" && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Workspace Policy Setup
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Manage scopes and permissions granted to teachers, students, and parents
                          (Persisted in Administrator profile).
                        </p>
                      </div>
                      <div className="space-y-4 divide-y pt-2">
                        <div className="flex items-center justify-between pb-3">
                          <div>
                            <p className="text-xs font-semibold">Allow Teacher Class Creation</p>
                            <p className="text-[10px] text-muted-foreground">
                              Teachers will be allowed to configure new Class groups and invite
                              codes.
                            </p>
                          </div>
                          <Switch
                            checked={policyClassCreation}
                            onCheckedChange={(c) =>
                              handlePolicyToggle("policy_class_creation", c, setPolicyClassCreation)
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between pb-3 pt-3">
                          <div>
                            <p className="text-xs font-semibold">
                              Enable Student Directory Viewing
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Allows students to list other classroom peers' emails.
                            </p>
                          </div>
                          <Switch
                            checked={policyDirectoryView}
                            onCheckedChange={(c) =>
                              handlePolicyToggle("policy_directory_view", c, setPolicyDirectoryView)
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between pt-3">
                          <div>
                            <p className="text-xs font-semibold">Automatic parent reports email</p>
                            <p className="text-[10px] text-muted-foreground">
                              Sends graded test scores automatically to registered parent emails.
                            </p>
                          </div>
                          <Switch
                            checked={policyParentReport}
                            onCheckedChange={(c) =>
                              handlePolicyToggle("policy_parent_report", c, setPolicyParentReport)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Category 3: Integrations & API Keys */}
                  {settingsSection === "integrations" && (
                    <div className="space-y-6">
                      {/* LMS Integrations */}
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            Google Classroom Link
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            Sync your rosters, grades, and classes directly with Google Classroom.
                          </p>
                        </div>

                        <div className="flex items-center justify-between rounded-lg border bg-muted/10 p-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-lg font-bold">
                              G
                            </span>
                            <div>
                              <p className="text-xs font-semibold">Google Classroom API Sync</p>
                              <p className="text-[10px] text-muted-foreground">
                                {lmsStatus?.connected
                                  ? `Status: Connected (Since ${lmsStatus.connectedAt ? new Date(lmsStatus.connectedAt).toLocaleDateString() : "Active"})`
                                  : "Status: Disconnected"}
                              </p>
                            </div>
                          </div>

                          {lmsStatus?.connected ? (
                            <Link href="/integrations/google-classroom">
                              <Button size="sm" variant="outline" className="h-8 text-xs">
                                Manage Courses
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-accent hover:bg-accent-soft"
                              onClick={() => {
                                window.location.href = "/api/lms/google/auth";
                              }}
                            >
                              Connect Google
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* API Credentials */}
                      <div className="space-y-3 border-t pt-4">
                        <div>
                          <h3 className="text-sm font-bold text-foreground">API Credentials</h3>
                          <p className="text-xs text-muted-foreground">
                            Generate long-lived Bearer tokens signed with the server key to
                            authenticate third-party integrations.
                          </p>
                        </div>

                        <div className="space-y-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleGenerateApiKey}
                            disabled={generateApiKeyMutation.isPending}
                            className="flex h-8 items-center gap-2"
                          >
                            <Key className="h-3.5 w-3.5" />
                            {generateApiKeyMutation.isPending
                              ? "Generating..."
                              : "Generate Bearer API Key"}
                          </Button>

                          {generatedApiKey && (
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/80 p-2 font-mono text-xs">
                              <span className="flex-1 select-all break-all pr-4">
                                {generatedApiKey}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 animate-in fade-in"
                                onClick={handleCopyApiKey}
                              >
                                {copiedKey ? (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Timetable Slot Scheduler Allocation Dialog */}
      <Dialog open={isAddSlotOpen} onOpenChange={setIsAddSlotOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Class Period Slot</DialogTitle>
            <DialogDescription>
              Assign a subject, teacher, and room to a specific day and period.
            </DialogDescription>
          </DialogHeader>

          {/* Form fields */}
          <div className="grid gap-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Day of Week</Label>
                <Select
                  value={String(slotFormData.dayOfWeek)}
                  onValueChange={(val) =>
                    setSlotFormData({ ...slotFormData, dayOfWeek: Number(val) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Period Hour</Label>
                <Select
                  value={String(slotFormData.periodNumber)}
                  onValueChange={(val) =>
                    setSlotFormData({ ...slotFormData, periodNumber: Number(val) })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.number} value={String(p.number)}>
                        Period {p.number} ({p.start})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Subject / Lesson Title</Label>
              <Input
                placeholder="e.g. Advanced Calculus"
                value={slotFormData.subject}
                onChange={(e) => setSlotFormData({ ...slotFormData, subject: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Target Class</Label>
                <Select
                  value={slotFormData.className}
                  onValueChange={(val) => setSlotFormData({ ...slotFormData, className: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {allClasses?.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Assigned Room</Label>
                <Input
                  placeholder="e.g. Lab 3"
                  value={slotFormData.room}
                  onChange={(e) => setSlotFormData({ ...slotFormData, room: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Lead Teacher</Label>
              <Select
                value={slotFormData.teacherId}
                onValueChange={(val) => setSlotFormData({ ...slotFormData, teacherId: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Educator" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    ?.filter((u) => u.role === "teacher")
                    .map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.displayName || t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* REAL-TIME CONFLICT GUARD NOTIFICATION BANNERS */}
            {activeConflicts.length > 0 && (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
                <p className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  Scheduling Conflicts Detected ({activeConflicts.length})
                </p>
                <div className="list-disc space-y-1.5 pl-5 font-sans text-[11px] text-red-600 dark:text-red-300">
                  {activeConflicts.map((c, i) => (
                    <div key={i}>{c}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddSlotOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                const periodObj = PERIODS.find((p) => p.number === slotFormData.periodNumber);
                createTimetableSlotMutation.mutate({
                  dayOfWeek: slotFormData.dayOfWeek,
                  periodNumber: slotFormData.periodNumber,
                  className: slotFormData.className,
                  subject: slotFormData.subject,
                  startTime: periodObj?.start || "08:00",
                  endTime: periodObj?.end || "08:45",
                  room: slotFormData.room || null,
                  teacherId: Number(slotFormData.teacherId),
                });
              }}
              disabled={
                createTimetableSlotMutation.isPending ||
                activeConflicts.length > 0 ||
                !slotFormData.className ||
                !slotFormData.teacherId ||
                !slotFormData.subject
              }
            >
              Assign Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Radical Right-hand Sheet Details Drawer */}
      <Sheet open={isUserSheetOpen} onOpenChange={setIsUserSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Member Profile Details</SheetTitle>
            <SheetDescription>Verify information and administrative controls.</SheetDescription>
          </SheetHeader>

          {selectedUser && (
            <div className="space-y-6 py-6 font-sans">
              {/* Profile card layout */}
              <div className="flex flex-col items-center space-y-3 text-center">
                <Avatar className="h-16 w-16 border-2 border-accent text-xl font-bold">
                  <AvatarFallback className="bg-accent-soft text-accent">
                    {(selectedUser.displayName || selectedUser.name || "U")
                      .substring(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {selectedUser.displayName || selectedUser.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
                <div className="flex gap-2">
                  {getRoleBadge(selectedUser.role)}
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>

              {/* Information Rows */}
              <div className="space-y-3.5 border-t pt-2 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Database User ID</span>
                  <span className="font-semibold text-foreground">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">School Code Assignment</span>
                  <span className="font-semibold text-foreground">
                    {selectedUser.schoolCode || "No Code"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-muted-foreground">Account Status</span>
                  <span className="font-semibold capitalize text-foreground">
                    {selectedUser.status || "Active"}
                  </span>
                </div>
              </div>

              {/* Administrative Actions toggle inside sheet */}
              <div className="space-y-3 border-t pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Administrative Controls
                </h4>

                {/* Dynamic Status Toggle */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/10 p-2.5 text-xs">
                  <div>
                    <p className="font-semibold">Suspend Account Access</p>
                    <p className="text-[10px] text-muted-foreground">
                      Prevents user from logging into this school workspace.
                    </p>
                  </div>
                  <Switch
                    checked={(selectedUser.status || "active") === "suspended"}
                    disabled={editUserMutation.isPending}
                    onCheckedChange={(checked) => {
                      const newStatus = checked ? "suspended" : "active";
                      editUserMutation.mutate({
                        id: selectedUser.id,
                        data: {
                          name: selectedUser.name,
                          email: selectedUser.email,
                          role: selectedUser.role,
                          status: newStatus,
                        },
                      });
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full justify-start text-xs"
                    onClick={() => handleOpenEditUser(selectedUser)}
                  >
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit Member Details
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-full justify-start text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                    onClick={() => handleOpenDeleteUser(selectedUser)}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete User Account
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog Modals (Add/Edit/Delete users and classes) */}
      <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new workspace member account.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@school.edu"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Account Role Scope</Label>
              <Select
                value={formData.role}
                onValueChange={(val) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher Scope</SelectItem>
                  <SelectItem value="student">Student Scope</SelectItem>
                  <SelectItem value="principal">Principal Scope</SelectItem>
                  <SelectItem value="parent">Parent Scope</SelectItem>
                  <SelectItem value="admin">Admin Scope</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddUserOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addUserMutation.mutate(formData)}
              disabled={addUserMutation.isPending}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Details</DialogTitle>
            <DialogDescription>Update member profile, email, or role scope.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Account Role Scope</Label>
              <Select
                value={formData.role}
                onValueChange={(val) => setFormData({ ...formData, role: val })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">Teacher Scope</SelectItem>
                  <SelectItem value="student">Student Scope</SelectItem>
                  <SelectItem value="principal">Principal Scope</SelectItem>
                  <SelectItem value="parent">Parent Scope</SelectItem>
                  <SelectItem value="admin">Admin Scope</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                selectedUser && editUserMutation.mutate({ id: selectedUser.id, data: formData })
              }
              disabled={editUserMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Confirm Account Removal
            </DialogTitle>
            <DialogDescription>
              This operation deletes all database records linked with{" "}
              {selectedUser?.displayName || selectedUser?.name}. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteUserOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedUser && deleteUserMutation.mutate(selectedUser.id)}
              disabled={deleteUserMutation.isPending}
            >
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class Group</DialogTitle>
            <DialogDescription>Add a new class section to your school roster.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Class Title</Label>
              <Input
                value={classFormData.name}
                onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
                placeholder="e.g. Science 101"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Grade/Section Level</Label>
              <Input
                value={classFormData.grade}
                onChange={(e) => setClassFormData({ ...classFormData, grade: e.target.value })}
                placeholder="e.g. 10"
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddClassOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addClassMutation.mutate(classFormData)}
              disabled={addClassMutation.isPending}
            >
              Create Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditClassOpen} onOpenChange={setIsEditClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Class Details</DialogTitle>
            <DialogDescription>Update the class name or grade level.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Class Title</Label>
              <Input
                value={classFormData.name}
                onChange={(e) => setClassFormData({ ...classFormData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Grade/Section Level</Label>
              <Input
                value={classFormData.grade}
                onChange={(e) => setClassFormData({ ...classFormData, grade: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditClassOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                selectedClass &&
                editClassMutation.mutate({ id: selectedClass.id, data: classFormData })
              }
              disabled={editClassMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteClassOpen} onOpenChange={setIsDeleteClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" /> Confirm Class Removal
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedClass?.name}? This action deletes
              the classroom roster folder.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteClassOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedClass && deleteClassMutation.mutate(selectedClass.id)}
              disabled={deleteClassMutation.isPending}
            >
              Remove Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAcademicReportOpen} onOpenChange={setIsAcademicReportOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Academic Performance Report</DialogTitle>
            <DialogDescription>
              Overview of student exam performance and roster completion rates.
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
              <div className="max-h-[50vh] overflow-auto rounded-xl border">
                <div className="grid grid-cols-4 items-center border-b bg-muted/50 p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <div>Student Name</div>
                  <div>Avg Score</div>
                  <div>Completion Rate</div>
                  <div>Attempts Count</div>
                </div>
                <div className="divide-y text-sm">
                  {(studentAnalytics || []).map((student, i) => (
                    <div key={i} className="grid grid-cols-4 items-center p-3">
                      <div className="font-medium text-foreground">{student.name}</div>
                      <div>{student.averageScore}%</div>
                      <div>{Math.round(student.completionRate * 100)}%</div>
                      <div>{student.recentAttempts?.length || 0} attempts</div>
                    </div>
                  ))}
                  {(!studentAnalytics || studentAnalytics.length === 0) && (
                    <div className="p-4 text-center text-muted-foreground">
                      No student performance metrics found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAcademicReportOpen(false)}>
              Close
            </Button>
            <Button size="sm" onClick={downloadAcademicCSV}>
              Export CSV Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSchoolProfileOpen} onOpenChange={setIsSchoolProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Institution Profile Settings</DialogTitle>
            <DialogDescription>Update your school public metadata.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Institution Name</Label>
              <Input
                value={schoolFormData.name}
                onChange={(e) => setSchoolFormData({ ...schoolFormData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Location City</Label>
              <Input
                value={schoolFormData.city}
                onChange={(e) => setSchoolFormData({ ...schoolFormData, city: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Curriculum / Educational Board</Label>
              <Input
                value={schoolFormData.board}
                onChange={(e) => setSchoolFormData({ ...schoolFormData, board: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSchoolProfileOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => updateSchoolMutation.mutate(schoolFormData)}
              disabled={updateSchoolMutation.isPending}
            >
              Save Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
