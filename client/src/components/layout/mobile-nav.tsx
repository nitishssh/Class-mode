import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Home, BookOpen, FileText, BarChart2, MessageSquare, UserCircle } from "lucide-react";
import { useFirebaseAuth } from "@/contexts/firebase-auth-context";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [location] = useLocation();
  const { currentUser } = useFirebaseAuth();
  const userRole = currentUser?.profile?.role || "student";

  const teacherNavItems = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/create-test", label: "Tests", icon: FileText },
    { href: "/analytics", label: "Analytics", icon: BarChart2 },
    { href: "/ai-tutor", label: "AI Tutor", icon: BookOpen },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const studentNavItems = [
    { href: "/student-dashboard", label: "Dashboard", icon: Home },
    { href: "/tests", label: "Tests", icon: FileText },
    { href: "/ai-tutor", label: "AI Tutor", icon: BookOpen },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const principalNavItems = [
    { href: "/principal-dashboard", label: "Dashboard", icon: Home },
    { href: "/performance", label: "Performance", icon: BarChart2 },
    { href: "/staff", label: "Staff", icon: UserCircle },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const adminNavItems = [
    { href: "/admin-dashboard", label: "Dashboard", icon: Home },
    { href: "/users", label: "Users", icon: UserCircle },
    { href: "/settings", label: "Settings", icon: FileText },
    { href: "/profile", label: "Profile", icon: UserCircle },
  ];

  const navItems =
    userRole === "teacher"
      ? teacherNavItems
      : userRole === "principal"
        ? principalNavItems
        : userRole === "admin"
          ? adminNavItems
          : studentNavItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background md:hidden">
      <nav className="grid grid-cols-5 p-2">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground",
              location === item.href && "text-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
