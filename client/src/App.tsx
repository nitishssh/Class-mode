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

function ComingSoon() {
  return (
    <div className="mt-20 flex flex-col items-center justify-center space-y-4 p-8 text-center">
      <h2 className="text-2xl font-bold">Coming Soon</h2>
      <p className="text-muted-foreground">This feature is currently under development.</p>
      <Button onClick={() => window.history.back()}>Go Back</Button>
    </div>
  );
}

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

/** Wraps a component with role-based access control. */
const withProtection = <P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles?: string[]
) => {
  const Protected = (props: P) => {
    const {
      currentUser: { profile },
    } = useFirebaseAuth();

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

  // Unauthenticated — show landing/login
  if (!profile) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={LoginPage} />
        <Route component={() => <Redirect to="/" />} />
      </Switch>
    );
  }

  if (profile.status === "pending") {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
          <h2 className="mb-3 text-2xl font-bold text-foreground">Account Pending Approval</h2>
          <p className="mb-6 text-muted-foreground">
            Your account has been created successfully but is currently awaiting approval from an
            administrator. You will be able to access the platform once your account is activated.
          </p>
          <Button onClick={() => logout()} variant="default" className="w-full">
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const role = profile.role;
  const getDashboard = () => {
    switch (role) {
      case "principal":
        return withLayout(PrincipalDashboard);
      case "school_admin":
        return withLayout(SchoolAdminDashboard);
      case "admin":
        return withLayout(AdminDashboard);
      case "teacher":
        return withLayout(Dashboard);
      case "student":
        return withLayout(StudentDashboard);
      case "parent":
        return withLayout(ParentDashboard);
      default:
        return withLayout(Dashboard);
    }
  };

  const protect = withProtection;

  return (
    <Switch>
      <Route path="/" component={getDashboard()} />
      <Route path="/dashboard" component={withLayout(protect(Dashboard, ["teacher"]))} />
      <Route
        path="/principal-dashboard"
        component={withLayout(protect(PrincipalDashboard, ["principal"]))}
      />
      <Route
        path="/school-admin-dashboard"
        component={withLayout(protect(SchoolAdminDashboard, ["school_admin"]))}
      />
      <Route path="/admin-dashboard" component={withLayout(protect(AdminDashboard, ["admin"]))} />
      <Route
        path="/student-dashboard"
        component={withLayout(protect(StudentDashboard, ["student"]))}
      />
      <Route
        path="/parent-dashboard"
        component={withLayout(protect(ParentDashboard, ["parent"]))}
      />

      <Route path="/create-test" component={withLayout(protect(CreateTest, ["teacher"]))} />
      <Route
        path="/ocr-scan"
        component={withLayout(protect(OcrScan, ["teacher", "student", "parent"]))}
      />
      <Route path="/analytics" component={withLayout(protect(Analytics))} />
      <Route path="/ai-tutor" component={withLayout(protect(AiTutor, ["student"]))} />
      <Route
        path="/student-directory"
        component={withLayout(protect(StudentDirectory, ["teacher", "principal", "admin"]))}
      />
      <Route path="/messages" component={withLayout(protect(Messages), { fullWidth: true })} />
      <Route
        path="/test/:id"
        component={withLayout(protect(TestPage, ["student", "teacher", "admin"]), {
          fullWidth: true,
        })}
      />
      <Route
        path="/resources"
        component={withLayout(protect(ComingSoon, ["student"]), { fullWidth: true })}
      />
      <Route
        path="/study-arena"
        component={withLayout(protect(ComingSoon, ["student"]), { fullWidth: true })}
      />
      <Route path="/tasks" component={withLayout(protect(Tasks))} />

      <Route path="/institution" component={withLayout(ComingSoon)} />
      <Route path="/staff" component={withLayout(ComingSoon)} />
      <Route path="/students" component={withLayout(ComingSoon)} />

      <Route path="/notifications" component={withLayout(protect(Notifications))} />
      <Route path="/tests" component={withLayout(protect(TestsList, ["student"]))} />
      <Route path="/calendar" component={withLayout(protect(AcademicCalendar))} />
      <Route path="/focus" component={withLayout(protect(Focus, ["student"]))} />
      <Route path="/achievements" component={withLayout(protect(Achievements, ["student"]))} />

      <Route path="/infrastructure" component={withLayout(ComingSoon)} />
      <Route
        path="/live-classes"
        component={withLayout(protect(LiveClasses, ["teacher", "student", "admin", "principal"]))}
      />
      <Route path="/live/:id" component={withLayout(protect(LiveClassRoom), { fullWidth: true })} />
      <Route
        path="/progress"
        component={withLayout(protect(MyProgress, ["student", "parent"]), { fullWidth: true })}
      />
      <Route path="/study-groups" component={withLayout(ComingSoon)} />
      <Route path="/settings" component={withLayout(protect(Settings))} />
      <Route path="/system-settings" component={withLayout(ComingSoon)} />
      <Route path="/users" component={withLayout(ComingSoon)} />
      <Route path="/classes" component={withLayout(ComingSoon)} />
      <Route path="/partners" component={withLayout(ComingSoon)} />
      <Route path="/children" component={withLayout(ComingSoon)} />
      <Route path="/meetings" component={withLayout(ComingSoon)} />
      <Route path="/reports" component={withLayout(ComingSoon)} />
      <Route path="/ai-study-plans" component={withLayout(protect(AiStudyPlans, ["student"]))} />
      <Route path="/ai-classroom" component={withLayout(protect(AIClassroom, ["student", "teacher"]))} />
      <Route path="/test-results" component={withLayout(ComingSoon)} />

      {/* Public invite acceptance — no auth required */}
      <Route path="/accept-invite" component={AcceptInvite} />

      {/* Onboarding flows */}
      <Route
        path="/onboarding/school"
        component={withLayout(protect(SchoolSetup, ["school_admin"]))}
      />
      <Route
        path="/onboarding/invite-teachers"
        component={withLayout(protect(InviteTeachers, ["school_admin"]))}
      />
      <Route
        path="/onboarding/teacher"
        component={withLayout(protect(TeacherClassSetup, ["teacher"]))}
      />
      <Route
        path="/onboarding/invite-students"
        component={withLayout(protect(InviteStudents, ["teacher"]))}
      />

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
