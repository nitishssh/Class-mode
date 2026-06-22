import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useFirebaseAuth as useAuth } from "@/contexts/firebase-auth-context";
import { useTranslation } from "@/lib/i18n";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import {
  LayoutDashboard,
  FileQuestion,
  BarChart,
  Users,
  Video,
  Settings,
  LogOut,
  Menu,
  Sparkles,
  MessageSquare,
  BookOpen,
  Brain,
  Trophy,
  GraduationCap,
  CalendarDays,
  Award,
  Database,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ClipboardCheck,
  UserCheck,
  Link2,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  /** True = route exists but feature is incomplete. Renders non-clickable. */
  disabled?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const {
    currentUser: { profile: user },
    logout,
  } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openTeacherSections, setOpenTeacherSections] = useState<Record<string, boolean>>({
    Teaching: true,
    Students: false,
    Operations: false,
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) setIsCollapsed(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", isCollapsed ? "4rem" : "16rem");
  }, [isCollapsed]);

  const closeMobileMenu = () => setIsMobileOpen(false);
  const toggleSidebar = () => setIsCollapsed((prev) => !prev);

  const principalNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/principal-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "Student Directory",
      href: "/student-directory",
      icon: <GraduationCap className="h-5 w-5" />,
    },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "Live Classes", href: "/live-classes", icon: <Video className="h-5 w-5" /> },
    { title: "No-Code SIS", href: "/dynamic-sis", icon: <Database className="h-5 w-5" /> },
    { title: "Calendar", href: "/calendar", icon: <CalendarDays className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    {
      title: "Google Classroom",
      href: "/integrations/google-classroom",
      icon: <Link2 className="h-5 w-5" />,
    },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const schoolAdminNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/school-admin-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "Student Directory",
      href: "/student-directory",
      icon: <GraduationCap className="h-5 w-5" />,
    },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "No-Code SIS", href: "/dynamic-sis", icon: <Database className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    {
      title: "Google Classroom",
      href: "/integrations/google-classroom",
      icon: <Link2 className="h-5 w-5" />,
    },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const adminNavItems: NavItem[] = [
    { title: "Dashboard", href: "/admin-dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    {
      title: "Student Directory",
      href: "/student-directory",
      icon: <GraduationCap className="h-5 w-5" />,
    },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "No-Code SIS", href: "/dynamic-sis", icon: <Database className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    {
      title: "Google Classroom",
      href: "/integrations/google-classroom",
      icon: <Link2 className="h-5 w-5" />,
    },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const teacherOverview: NavItem = {
    title: "Overview",
    href: "/teacher-dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
  };
  const teacherNavSections: NavSection[] = [
    {
      title: "Teaching",
      items: [
        { title: "Tests", href: "/create-test", icon: <FileQuestion className="h-5 w-5" /> },
        { title: "Grading", href: "/grading", icon: <ClipboardCheck className="h-5 w-5" /> },
        {
          title: "AI Classroom",
          href: "/ai-classroom",
          icon: <Sparkles className="h-5 w-5" />,
        },
        { title: "Live Classes", href: "/live-classes", icon: <Video className="h-5 w-5" /> },
      ],
    },
    {
      title: "Students",
      items: [
        { title: "My Students", href: "/my-students", icon: <UserCheck className="h-5 w-5" /> },
        {
          title: "Directory",
          href: "/student-directory",
          icon: <GraduationCap className="h-5 w-5" />,
        },
        { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
      ],
    },
    {
      title: "Operations",
      items: [
        { title: "School SIS", href: "/dynamic-sis", icon: <Database className="h-5 w-5" /> },
        {
          title: "Google Classroom",
          href: "/integrations/google-classroom",
          icon: <Link2 className="h-5 w-5" />,
        },
        { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
      ],
    },
  ];
  const teacherNavItems = [
    teacherOverview,
    ...teacherNavSections.flatMap((section) => section.items),
  ];

  const studentNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/student-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    { title: "My Tests", href: "/tests", icon: <FileQuestion className="h-5 w-5" /> },
    { title: "My Progress", href: "/progress", icon: <BarChart className="h-5 w-5" /> },
    { title: "Resources", href: "/resources", icon: <BookOpen className="h-5 w-5" /> },
    { title: "AI Tutor", href: "/ai-tutor", icon: <Brain className="h-5 w-5" /> },
    { title: "AI Classroom", href: "/ai-classroom", icon: <Sparkles className="h-5 w-5" /> },
    { title: "Study Arena", href: "/study-arena", icon: <Award className="h-5 w-5" /> },
    { title: "Live Classes", href: "/live-classes", icon: <Video className="h-5 w-5" /> },
    { title: "Achievements", href: "/achievements", icon: <Trophy className="h-5 w-5" /> },
    { title: "Tasks", href: "/tasks", icon: <ClipboardCheck className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
  ];

  const parentNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/parent-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    { title: "Academic Progress", href: "/progress", icon: <BarChart className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    {
      title: "My Children",
      href: "/children",
      icon: <Users className="h-5 w-5" />,
      disabled: true,
    },
    {
      title: "Test Results",
      href: "/test-results",
      icon: <FileQuestion className="h-5 w-5" />,
      disabled: true,
    },
    {
      title: "Teacher Meetings",
      href: "/meetings",
      icon: <Video className="h-5 w-5" />,
      disabled: true,
    },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
  ];

  let items = teacherNavItems;
  if (user?.role === "student") items = studentNavItems;
  else if (user?.role === "teacher") items = teacherNavItems;
  else if (user?.role === "principal") items = principalNavItems;
  else if (user?.role === "school_admin") items = schoolAdminNavItems;
  else if (user?.role === "admin") items = adminNavItems;
  else if (user?.role === "parent") items = parentNavItems;

  const getRoleLabel = (role?: string): string => {
    if (!role) return "User";
    switch (role) {
      case "student":
        return "Student";
      case "teacher":
        return "Teacher";
      case "principal":
        return "Principal";
      case "school_admin":
        return "School Admin";
      case "admin":
        return "Admin";
      case "parent":
        return "Parent";
      default:
        return role;
    }
  };

  const roleLabel = getRoleLabel(user?.role);
  const renderNavItem = (item: NavItem) => {
    const isActive = location === item.href;
    if (item.disabled) {
      return (
        <div
          key={item.href}
          className={cn(
            "flex min-h-11 cursor-not-allowed items-center rounded-lg text-sm font-medium opacity-40",
            isCollapsed ? "justify-center px-2" : "px-3"
          )}
          title={isCollapsed ? `${item.title} (Coming Soon)` : undefined}
        >
          <span className={cn("flex h-5 w-5 items-center justify-center", !isCollapsed && "mr-3")}>
            {item.icon}
          </span>
          {!isCollapsed && <span className="flex-1 truncate">{item.title}</span>}
        </div>
      );
    }
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={closeMobileMenu}
        className={cn(
          "group relative flex min-h-11 items-center rounded-lg text-sm font-medium transition-colors duration-150",
          isActive
            ? "bg-accent-soft font-semibold text-accent"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          isCollapsed ? "justify-center px-2" : "px-3"
        )}
        title={isCollapsed ? item.title : undefined}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={cn(
            "flex h-5 w-5 items-center justify-center transition-colors",
            isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground",
            !isCollapsed && "mr-3"
          )}
        >
          {item.icon}
        </span>
        {!isCollapsed && <span className="flex-1 truncate">{item.title}</span>}
      </Link>
    );
  };

  return (
    <>
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={closeMobileMenu} />
      )}

      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Button
          variant="ghost"
          className="h-9 w-9 rounded-full p-0 md:hidden"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("sidebar.toggleMenu", "Toggle menu")}</span>
        </Button>
      </div>

      <div
        className={cn(
          "fixed bottom-0 left-0 top-0 z-[60] flex h-screen flex-col border-r border-border bg-muted/30 transition-all duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "w-16 md:w-16" : "w-64 md:w-64",
          className
        )}
      >
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 hidden h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground md:flex"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo */}
        <div className="flex items-center px-6 py-6">
          {!isCollapsed ? (
            <div className="flex flex-col">
              <div className="font-display text-2xl leading-tight text-foreground">
                {t("sidebar.classMode", "Class Mode")}
              </div>
              <p className="mt-0.5 font-body text-xs text-muted-foreground">
                {t("sidebar.learningPlatform", "Learning Platform")}
              </p>
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft font-display text-xl text-accent">
              {t("sidebar.shortLogo", "E")}
            </div>
          )}
        </div>

        {/* Workspace switcher */}
        <div className={cn("px-3", isCollapsed ? "flex justify-center" : "")}>
          <WorkspaceSwitcher isCollapsed={isCollapsed} />
        </div>

        {/* User info */}
        <div className={cn("mb-4 mt-2 px-3", isCollapsed && "flex justify-center")}>
          {isCollapsed ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
              {user?.displayName ? getInitials(user.displayName) : "U"}
            </div>
          ) : (
            <div className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                {user?.displayName ? getInitials(user.displayName) : "U"}
              </div>
              <div className="overflow-hidden">
                <p className="truncate text-sm font-medium text-foreground">{user?.displayName}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={cn("flex-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
          <nav className="space-y-1" aria-label="Primary navigation">
            {user?.role === "teacher" && !isCollapsed ? (
              <>
                {renderNavItem(teacherOverview)}
                {teacherNavSections.map((section) => {
                  const isOpen = openTeacherSections[section.title];
                  const containsActive = section.items.some((item) => item.href === location);
                  return (
                    <div key={section.title} className="pt-2">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                        onClick={() =>
                          setOpenTeacherSections((current) => ({
                            ...current,
                            [section.title]: !isOpen,
                          }))
                        }
                        aria-expanded={isOpen}
                      >
                        <span>{section.title}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            (isOpen || containsActive) && "rotate-180"
                          )}
                        />
                      </button>
                      {(isOpen || containsActive) && (
                        <div className="space-y-1">{section.items.map(renderNavItem)}</div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              items.map(renderNavItem)
            )}
          </nav>
        </div>

        {/* Bottom actions */}
        <div
          className={cn(
            "mt-auto border-t border-border",
            isCollapsed
              ? "flex flex-col items-center space-y-3 p-3"
              : "flex items-center justify-between p-4"
          )}
        >
          {isCollapsed ? (
            <>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-500"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <div className="flex gap-1">
                <ThemeToggle />
                <Link href="/settings">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-500"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
