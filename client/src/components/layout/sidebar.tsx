import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useFirebaseAuth as useAuth } from "@/contexts/firebase-auth-context";
import {
  LayoutDashboard,
  FileQuestion,
  BarChart,
  Users,
  Video,
  Settings,
  LogOut,
  Menu,
  ScanBarcode,
  Sparkles,
  MessageSquare,
  BookOpen,
  Brain,
  Trophy,
  School,
  GraduationCap,
  UserCog,
  Building2,
  CalendarDays,
  Award,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ReactNode;
  isSoon?: boolean;
}

interface SidebarProps {
  className?: string;
}

/**
 * Responsive, role-aware collapsible sidebar with mobile overlay, user panel, navigation, and bottom actions.
 *
 * Renders a left-side navigation UI that:
 * - selects menu items based on the current user's role
 * - supports expanded and collapsed widths (syncs width to CSS variable `--sidebar-width`)
 * - provides a mobile full-screen overlay and toggle
 * - displays user initials/name, an optional student progress card, theme toggle, settings, and logout actions
 *
 * @param className - Optional additional class names applied to the root sidebar container
 * @returns The sidebar React element ready to be rendered in the application layout
 */
export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const {
    currentUser: { profile: user },
    logout,
  } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Check if we're on mobile to set default state
  useEffect(() => {
    const checkIfMobile = () => window.innerWidth < 768;
    setIsCollapsed(checkIfMobile());

    const handleResize = () => setIsCollapsed(checkIfMobile());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sync sidebar width via CSS variable (replaces CustomEvent approach)
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", isCollapsed ? "4rem" : "16rem");
  }, [isCollapsed]);

  const toggleMobileMenu = () => setIsMobileOpen(!isMobileOpen);
  const closeMobileMenu = () => setIsMobileOpen(false);
  const toggleSidebar = () => setIsCollapsed((prev) => !prev);

  // Principal navigation items
  const principalNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/principal-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: "Institution",
      href: "/institution",
      icon: <School className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Staff", href: "/staff", icon: <Users className="h-5 w-5" />, isSoon: true },
    {
      title: "Students",
      href: "/students",
      icon: <GraduationCap className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Student Directory", href: "/student-directory", icon: <Award className="h-5 w-5" /> },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    {
      title: "Calendar",
      href: "/calendar",
      icon: <CalendarDays className="h-5 w-5" />,
      isSoon: true,
    },
    {
      title: "Infrastructure",
      href: "/infrastructure",
      icon: <Building2 className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, isSoon: true },
  ];

  // School Admin navigation items
  const schoolAdminNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/school-admin-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    { title: "Staff", href: "/staff", icon: <Users className="h-5 w-5" />, isSoon: true },
    {
      title: "Students",
      href: "/students",
      icon: <GraduationCap className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Student Directory", href: "/student-directory", icon: <Award className="h-5 w-5" /> },
    {
      title: "Reports",
      href: "/reports",
      icon: <FileQuestion className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, isSoon: true },
  ];

  // Admin navigation items
  const adminNavItems: NavItem[] = [
    { title: "Dashboard", href: "/admin-dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    {
      title: "User Management",
      href: "/users",
      icon: <UserCog className="h-5 w-5" />,
      isSoon: true,
    },
    {
      title: "Institution",
      href: "/institution",
      icon: <Building2 className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Classes", href: "/classes", icon: <School className="h-5 w-5" />, isSoon: true },
    {
      title: "Student Directory",
      href: "/student-directory",
      icon: <GraduationCap className="h-5 w-5" />,
    },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    {
      title: "Reports",
      href: "/reports",
      icon: <FileQuestion className="h-5 w-5" />,
      isSoon: true,
    },
    {
      title: "System Settings",
      href: "/system-settings",
      icon: <Settings className="h-5 w-5" />,
      isSoon: true,
    },
  ];

  // Teacher navigation items
  const teacherNavItems: NavItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { title: "Tests", href: "/create-test", icon: <FileQuestion className="h-5 w-5" /> },
    { title: "Scan Tests", href: "/ocr-scan", icon: <ScanBarcode className="h-5 w-5" /> },
    { title: "Analytics", href: "/analytics", icon: <BarChart className="h-5 w-5" /> },
    { title: "Students", href: "/students", icon: <Users className="h-5 w-5" />, isSoon: true },
    {
      title: "Student Directory",
      href: "/student-directory",
      icon: <GraduationCap className="h-5 w-5" />,
    },
    {
      title: "AI Study Plans",
      href: "/ai-study-plans",
      icon: <Sparkles className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Live Classes", href: "/live-classes", icon: <Video className="h-5 w-5" /> },
    { title: "AI Classroom", href: "/ai-classroom", icon: <Sparkles className="h-5 w-5" /> },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, isSoon: true },
  ];

  // Student navigation items
  const studentNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/student-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    { title: "Test MVP", href: "/test/1", icon: <FileQuestion className="h-5 w-5" /> },
    { title: "My Progress", href: "/progress", icon: <BarChart className="h-5 w-5" /> },
    {
      title: "Resources",
      href: "/resources",
      icon: <BookOpen className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "AI Tutor", href: "/ai-tutor", icon: <Brain className="h-5 w-5" /> },
    { title: "Live Classes", href: "/live-classes", icon: <Video className="h-5 w-5" /> },
    { title: "AI Classroom", href: "/ai-classroom", icon: <Sparkles className="h-5 w-5" /> },
    { title: "Study Arena", href: "/study-arena", icon: <Users className="h-5 w-5" /> },
    {
      title: "Achievements",
      href: "/achievements",
      icon: <Trophy className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, isSoon: true },
    { title: "Tasks", href: "/tasks", icon: <FileQuestion className="h-5 w-5" /> },
  ];

  // Parent navigation items
  const parentNavItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/parent-dashboard",
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    { title: "My Children", href: "/children", icon: <Users className="h-5 w-5" />, isSoon: true },
    { title: "Academic Progress", href: "/progress", icon: <BarChart className="h-5 w-5" /> },
    {
      title: "Tests & Results",
      href: "/test-results",
      icon: <FileQuestion className="h-5 w-5" />,
      isSoon: true,
    },
    {
      title: "Teacher Meetings",
      href: "/meetings",
      icon: <Video className="h-5 w-5" />,
      isSoon: true,
    },
    { title: "Messages", href: "/messages", icon: <MessageSquare className="h-5 w-5" /> },
    { title: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" />, isSoon: true },
  ];

  let items = teacherNavItems;
  if (user?.role === "student") items = studentNavItems;
  else if (user?.role === "teacher") items = teacherNavItems;
  else if (user?.role === "principal") items = principalNavItems;
  else if (user?.role === "school_admin") items = schoolAdminNavItems;
  else if (user?.role === "admin") items = adminNavItems;
  else if (user?.role === "parent") items = parentNavItems;

  const MobileMenuButton = () => (
    <Button
      variant="ghost"
      className="h-9 w-9 rounded-full p-0 md:hidden"
      onClick={toggleMobileMenu}
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle menu</span>
    </Button>
  );

  return (
    <>
      {/* Mobile menu overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={closeMobileMenu} />
      )}

      {/* Mobile menu button */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <MobileMenuButton />
      </div>

      {/* Sidebar */}
      <div
        className={cn(
          "fixed bottom-0 left-0 top-0 z-50 flex h-screen flex-col border-r border-border bg-muted/30 transition-all duration-300 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "w-16 md:w-16" : "w-64 md:w-64",
          className
        )}
      >
        {/* Collapse toggle button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-20 flex hidden h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-soft transition-colors hover:bg-muted hover:text-foreground md:flex"
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>

        {/* Logo and title */}
        <div className="flex items-center px-6 py-6">
          {!isCollapsed && (
            <div className="flex flex-col">
              <h1 className="font-display text-2xl leading-tight text-foreground">EduAI</h1>
              <p className="mt-0.5 font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                Learning Platform
              </p>
            </div>
          )}
          {isCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft font-display text-xl text-accent">
              E
            </div>
          )}
        </div>

        {/* User info */}
        <div className={cn("mb-6 mt-2 px-3", isCollapsed && "flex justify-center")}>
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
                <p className="text-xs text-muted-foreground">
                  {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className={cn("flex-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
          {!isCollapsed && (
            <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Main Menu
            </div>
          )}
          <nav className="space-y-0.5">
            {items.map((item) => {
              const isActive = location === item.href;
              return (
                <div key={item.href} className="block">
                  <Link
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={cn(
                      "group relative flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-accent-soft font-semibold text-accent"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      isCollapsed ? "justify-center px-2" : "px-3"
                    )}
                    title={isCollapsed ? item.title : undefined}
                  >
                    {isActive && !isCollapsed && (
                      <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                    )}
                    <span
                      className={cn(
                        "flex h-5 w-5 flex-shrink-0 items-center justify-center transition-colors",
                        isActive
                          ? "text-accent"
                          : "text-muted-foreground group-hover:text-foreground",
                        !isCollapsed && "mr-3"
                      )}
                    >
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {item.isSoon && (
                          <span className="ml-2 flex-shrink-0 rounded-full border border-accent/10 bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent">
                            Soon
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                </div>
              );
            })}
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
