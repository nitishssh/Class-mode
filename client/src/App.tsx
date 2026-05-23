import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/theme-context";
import { FirebaseAuthProvider, useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/layout/sidebar";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import PrincipalDashboard from "@/pages/principal-dashboard";
import ParentDashboard from "@/pages/parent-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import SchoolAdminDashboard from "@/pages/school-admin-dashboard";
import CreateTest from "@/pages/create-test";
import OcrScan from "@/pages/ocr-scan";
import Analytics from "@/pages/analytics";
import AiTutor from "@/pages/ai-tutor";
import StudentDirectory from "@/pages/student-directory";
import Messages from "@/pages/messages";
import LiveClasses from "@/pages/live-classes";
import LiveClassRoom from "@/pages/live-classroom";
import MyProgress from "@/pages/my-progress";
import Tasks from "@/pages/tasks";
import Notifications from "@/pages/notifications";
import AcademicCalendar from "@/pages/academic-calendar";
import Achievements from "@/pages/achievements";
import Settings from "@/pages/settings";
import AiStudyPlans from "./pages/ai-study-plans";
import Focus from "@/pages/focus";
import AIClassroom from "@/pages/ai-classroom";
import EducatorGrading from "@/pages/educator/grading";
import EducatorStudents from "@/pages/educator/students";
import StudyArena from "@/pages/study-arena";
import ResourcesPage from "@/pages/resources-page";
import TestPage from "@/pages/test-page";
import TestsList from "@/pages/tests-list";
import Landing from "@/pages/landing";
import LoginPage from "@/pages/login";
import AcceptInvite from "@/pages/accept-invite";
import SchoolSetup from "@/pages/onboarding/school-setup";
import InviteTeachers from "@/pages/onboarding/invite-teachers";
import TeacherClassSetup from "@/pages/onboarding/teacher-class-setup";
import InviteStudents from "@/pages/onboarding/invite-students";
import { useOnboardingGuard } from "@/hooks/use-onboarding-guard";

function Layout({
  children,
  fullWidth = false,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main
        className="flex-1 transition-all duration-300 ease-in-out"
        style={{ marginLeft: "var(--sidebar-width, 16rem)" }}
      >
        {fullWidth ? (
          <div className="h-screen w-full overflow-hidden">{children}</div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        )}
      </main>
    </div>
  );
}

const withLayout = <P extends object>(
  Component: React.ComponentType<P>,
  options?: { fullWidth?: boolean }
) => {
  const Wrapped = (props: P) => (
    <Layout fullWidth={options?.fullWidth}>
      <Component {...props} />
    </Layout>
  );
  Wrapped.displayName = `WithLayout(${Component.displayName || Component.name || "Component"})`;
  return Wrapped;
};

/** Wraps a component with role-based access control. Redirects to /login if unauthenticated. */
const withProtection = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: string[]
) => {
  const Protected = (props: P) => {
    const {
      currentUser: { profile },
      isLoading,
    } = useFirebaseAuth();

    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!profile) {
      return <Redirect to="/login" />;
    }

    if (allowedRoles && !allowedRoles.includes(profile.role)) {
      return (
        <Layout>
          <div className="mt-20 flex flex-col items-center justify-center space-y-4 p-8 text-center">
            <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to view this page.</p>
            <Button onClick={() => window.history.back()}>Go Back</Button>
          </div>
        </Layout>
      );
    }

    return <Component {...props} />;
  };
  Protected.displayName = `Protected(${Component.displayName || Component.name || "Component"})`;
  return Protected;
};

// ── Pre-defined route components (stable references across renders) ────────────
const protect = withProtection;

const TeacherDashboardRoute = withLayout(protect(Dashboard, ["teacher"]));
const PrincipalDashboardRoute = withLayout(protect(PrincipalDashboard, ["principal"]));
const SchoolAdminDashboardRoute = withLayout(protect(SchoolAdminDashboard, ["school_admin"]));
const AdminDashboardRoute = withLayout(protect(AdminDashboard, ["admin"]));
const StudentDashboardRoute = withLayout(protect(StudentDashboard, ["student"]));
const ParentDashboardRoute = withLayout(protect(ParentDashboard, ["parent"]));

const CreateTestRoute = withLayout(protect(CreateTest, ["teacher"]));
const GradingRoute = withLayout(protect(EducatorGrading, ["teacher"]));
const MyStudentsRoute = withLayout(protect(EducatorStudents, ["teacher"]));
const OcrScanRoute = withLayout(protect(OcrScan, ["teacher", "student", "parent"]));
const AnalyticsRoute = withLayout(protect(Analytics));
const AiTutorRoute = withLayout(protect(AiTutor, ["student"]));
const StudentDirRoute = withLayout(protect(StudentDirectory, ["teacher", "principal", "admin"]));
const MessagesRoute = withLayout(protect(Messages), { fullWidth: true });
const TestPageRoute = withLayout(protect(TestPage, ["student", "teacher", "admin"]), {
  fullWidth: true,
});
const ResourcesRoute = withLayout(protect(ResourcesPage, ["student"]), { fullWidth: true });
const StudyArenaRoute = withLayout(protect(StudyArena, ["student"]), { fullWidth: true });
const TasksRoute = withLayout(protect(Tasks));
const NotificationsRoute = withLayout(protect(Notifications));
const TestsListRoute = withLayout(protect(TestsList, ["student"]));
const CalendarRoute = withLayout(protect(AcademicCalendar));
const FocusRoute = withLayout(protect(Focus, ["student"]));
const AchievementsRoute = withLayout(protect(Achievements, ["student"]));
const LiveClassesRoute = withLayout(
  protect(LiveClasses, ["teacher", "student", "admin", "principal"])
);
const LiveClassRoomRoute = withLayout(protect(LiveClassRoom), { fullWidth: true });
const MyProgressRoute = withLayout(protect(MyProgress, ["student", "parent"]), { fullWidth: true });
const SettingsRoute = withLayout(protect(Settings));
const AiStudyPlansRoute = withLayout(protect(AiStudyPlans, ["student"]));
const AIClassroomRoute = withLayout(protect(AIClassroom, ["student", "teacher"]));
const OnboardingSchoolRoute = withLayout(protect(SchoolSetup, ["school_admin"]));
const OnboardingInvTeachRoute = withLayout(protect(InviteTeachers, ["school_admin"]));
const OnboardingTeacherRoute = withLayout(protect(TeacherClassSetup, ["teacher"]));
const OnboardingInvStdRoute = withLayout(protect(InviteStudents, ["teacher"]));

// Role → dashboard path map used to redirect /dashboard to the role-specific route
const dashboardPathByRole: Partial<Record<string, string>> = {
  principal: "/principal-dashboard",
  school_admin: "/school-admin-dashboard",
  admin: "/admin-dashboard",
  teacher: "/teacher-dashboard",
  student: "/student-dashboard",
  parent: "/parent-dashboard",
};

function App() {
  const {
    currentUser: { profile },
    isLoading,
    logout,
  } = useFirebaseAuth();
  useOnboardingGuard();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (profile?.status === "pending") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
          <h2 className="mb-3 text-2xl font-bold text-foreground">Account Pending Approval</h2>
          <p className="mb-6 text-muted-foreground">
            Your account is awaiting administrator approval. You will receive access once activated.
          </p>
          <Button onClick={() => logout()} variant="default" className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (profile?.status === "suspended") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-sm">
          <h2 className="mb-3 text-2xl font-bold text-destructive">Account Suspended</h2>
          <p className="mb-6 text-muted-foreground">
            Your account has been suspended. Please contact support for assistance.
          </p>
          <Button onClick={() => logout()} variant="destructive" className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (profile?.status === "rejected") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-sm">
          <h2 className="mb-3 text-2xl font-bold text-destructive">Account Not Approved</h2>
          <p className="mb-6 text-muted-foreground">
            Your registration was not approved. Please contact your school administrator.
          </p>
          <Button onClick={() => logout()} variant="destructive" className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const dashboardPath = profile ? (dashboardPathByRole[profile.role] ?? "/teacher-dashboard") : "/login";

  return (
    <Switch>
      {/* ── Public routes — no auth required ─────────────────────── */}
      <Route path="/" component={Landing} />

      {/* /login: show login page; if already authenticated go to dashboard */}
      <Route path="/login">
        {profile ? <Redirect to={dashboardPath} /> : <LoginPage />}
      </Route>

      {/* Invite acceptance must be public — unauthenticated users click invite links */}
      <Route path="/accept-invite" component={AcceptInvite} />

      {/* ── /dashboard — redirects to the role-specific dashboard ─── */}
      <Route path="/dashboard">
        {!profile ? <Redirect to="/login" /> : <Redirect to={dashboardPath} />}
      </Route>

      {/* ── Role-specific dashboards ──────────────────────────────── */}
      <Route path="/teacher-dashboard" component={TeacherDashboardRoute} />
      <Route path="/principal-dashboard" component={PrincipalDashboardRoute} />
      <Route path="/school-admin-dashboard" component={SchoolAdminDashboardRoute} />
      <Route path="/admin-dashboard" component={AdminDashboardRoute} />
      <Route path="/student-dashboard" component={StudentDashboardRoute} />
      <Route path="/parent-dashboard" component={ParentDashboardRoute} />

      {/* ── Protected app routes ──────────────────────────────────── */}
      <Route path="/create-test" component={CreateTestRoute} />
      <Route path="/grading" component={GradingRoute} />
      <Route path="/my-students" component={MyStudentsRoute} />
      <Route path="/ocr-scan" component={OcrScanRoute} />
      <Route path="/analytics" component={AnalyticsRoute} />
      <Route path="/ai-tutor" component={AiTutorRoute} />
      <Route path="/student-directory" component={StudentDirRoute} />
      <Route path="/messages" component={MessagesRoute} />
      <Route path="/test/:id" component={TestPageRoute} />
      <Route path="/resources" component={ResourcesRoute} />
      <Route path="/study-arena" component={StudyArenaRoute} />
      <Route path="/tasks" component={TasksRoute} />
      <Route path="/notifications" component={NotificationsRoute} />
      <Route path="/tests" component={TestsListRoute} />
      <Route path="/calendar" component={CalendarRoute} />
      <Route path="/focus" component={FocusRoute} />
      <Route path="/achievements" component={AchievementsRoute} />
      <Route path="/live-classes" component={LiveClassesRoute} />
      <Route path="/live/:id" component={LiveClassRoomRoute} />
      <Route path="/progress" component={MyProgressRoute} />
      <Route path="/settings" component={SettingsRoute} />
      <Route path="/ai-study-plans" component={AiStudyPlansRoute} />
      <Route path="/ai-classroom" component={AIClassroomRoute} />

      {/* ── Onboarding flows ──────────────────────────────────────── */}
      <Route path="/onboarding/school" component={OnboardingSchoolRoute} />
      <Route path="/onboarding/invite-teachers" component={OnboardingInvTeachRoute} />
      <Route path="/onboarding/teacher" component={OnboardingTeacherRoute} />
      <Route path="/onboarding/invite-students" component={OnboardingInvStdRoute} />

      <Route component={NotFound} />
    </Switch>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <FirebaseAuthProvider>
          <App />
          <Toaster />
        </FirebaseAuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
