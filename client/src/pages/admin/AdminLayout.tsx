import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, GraduationCap, BookOpen, BarChart3, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useTranslation } from "@/lib/i18n";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navigation = [
    { name: t("admin.dashboard", "Dashboard"), href: "/admin", icon: LayoutDashboard },
    { name: t("admin.students", "Students"), href: "/admin/students", icon: Users },
    { name: t("admin.teachers", "Teachers"), href: "/admin/teachers", icon: GraduationCap },
    { name: t("admin.content", "Content"), href: "/admin/content", icon: BookOpen },
    { name: t("admin.analytics", "Analytics"), href: "/admin/analytics", icon: BarChart3 },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col gap-2 p-4 w-full">
      <div className="mb-6 px-2">
        <h2 className="text-xl font-bold tracking-tight">{t("admin.title", "School Admin")}</h2>
        <p className="text-sm text-muted-foreground">{t("admin.subtitle", "Management Dashboard")}</p>
      </div>
      <nav className="flex flex-col gap-1">
        {navigation.map((item) => {
          const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      {/* Mobile Header with Hamburger */}
      <div className="md:hidden flex items-center p-4 border-b">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="mr-2">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <h1 className="font-semibold text-lg">{t("admin.title", "School Admin")}</h1>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col border-r bg-card min-h-screen h-full">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        {children}
      </div>
    </div>
  );
}
