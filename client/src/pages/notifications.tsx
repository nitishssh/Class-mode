import type { ReactNode } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  BellRing,
  CheckCircle2,
  BookOpen,
  Trophy,
  AlertCircle,
  MessageSquare,
  Clock,
  X,
  CheckCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

type NotificationType = "test" | "result" | "announcement" | "message" | "achievement" | "reminder";

interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  meta?: string;
  createdAt: string;
}

const typeConfig: Record<
  NotificationType,
  { icon: ReactNode; color: string; bg: string; label: string }
> = {
  test: {
    icon: <BookOpen className="h-5 w-5" />,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Tests",
  },
  result: {
    icon: <CheckCircle2 className="h-5 w-5" />,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Results",
  },
  achievement: {
    icon: <Trophy className="h-5 w-5" />,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Achievements",
  },
  announcement: {
    icon: <AlertCircle className="h-5 w-5" />,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    label: "Announcements",
  },
  message: {
    icon: <MessageSquare className="h-5 w-5" />,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    label: "Messages",
  },
  reminder: {
    icon: <Clock className="h-5 w-5" />,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    label: "Reminders",
  },
};

type TabFilter = "all" | "unread" | NotificationType;

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  // ── Fetch ──────────────────────────────────────────────────────────────
  const {
    data: notifications = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AppNotification[]>({
    queryKey: ["/api/notifications"],
  });

  // ── Mark single read ───────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  // ── Dismiss ────────────────────────────────────────────────────────────
  const dismissMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  // ── Mark all read ──────────────────────────────────────────────────────
  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const tabs: { id: TabFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "test", label: "Tests" },
    { id: "achievement", label: "Achievements" },
    { id: "announcement", label: "Announcements" },
  ];

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.isRead;
    return n.type === activeTab;
  });

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <PageHeader
          title="Notifications"
          subtitle="Stay up to date with your tests, results, and announcements."
          className="animate-fade-in-up"
          breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Notifications" }]}
        />
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-4 p-4">
                <Skeleton className="h-10 w-10 flex-shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (isError) {
    return (
      <>
        <PageHeader
          title="Notifications"
          subtitle="Stay up to date with your tests, results, and announcements."
          className="animate-fade-in-up"
          breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Notifications" }]}
        />
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
            <div className="rounded-2xl bg-destructive/10 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="font-semibold">Failed to load notifications</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Something went wrong."}
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date with your tests, results, and announcements."
        className="animate-fade-in-up"
        breadcrumbs={[{ label: "Dashboard", href: "/" }, { label: "Notifications" }]}
      >
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="gap-2"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        )}
      </PageHeader>

      {/* Stats strip */}
      <div
        className="via-primary/8 animate-fade-in-up mb-6 flex items-center gap-4 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/5 to-violet-500/5 px-5 py-3"
        style={{ animationDelay: "50ms" }}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <BellRing className="h-4 w-4 text-primary" />
          <span className="font-bold text-foreground">{unreadCount}</span>
          <span className="text-muted-foreground">unread notifications</span>
        </span>
        <div className="ml-auto flex items-center gap-3">
          {unreadCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Zap className="h-3.5 w-3.5" />
              Action needed
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        className="scrollbar-hide animate-fade-in-up mb-5 flex gap-2 overflow-x-auto pb-2"
        style={{ animationDelay: "100ms" }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.id === "unread" && unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="animate-fade-in-up space-y-3" style={{ animationDelay: "150ms" }}>
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <div className="rounded-2xl bg-muted p-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-semibold">No notifications here</p>
              <p className="text-sm text-muted-foreground">
                {activeTab === "unread"
                  ? "You're all caught up!"
                  : "Nothing to show in this category."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((notification) => {
            const cfg = typeConfig[notification.type] ?? typeConfig["reminder"];
            return (
              <Card
                key={notification.id}
                className={cn(
                  "group cursor-pointer border transition-all duration-200 hover:shadow-md",
                  !notification.isRead
                    ? "bg-primary/3 border-primary/20 dark:bg-primary/5"
                    : "border-border/60 bg-card"
                )}
                onClick={() => !notification.isRead && markReadMutation.mutate(notification.id)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  {/* Unread dot */}
                  <div className="relative mt-1 flex-shrink-0">
                    <div className={cn("rounded-xl p-2.5", cfg.bg)}>
                      <span className={cfg.color}>{cfg.icon}</span>
                    </div>
                    {!notification.isRead && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p
                          className={cn(
                            "text-sm font-semibold leading-tight",
                            !notification.isRead ? "text-foreground" : "text-foreground/90"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                          {notification.body}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {notification.meta && (
                          <Badge
                            className={cn("border-0 text-[10px] font-bold", cfg.bg, cfg.color)}
                          >
                            {notification.meta}
                          </Badge>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissMutation.mutate(notification.id);
                          }}
                          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          cfg.bg,
                          cfg.color
                        )}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </span>
                      {!notification.isRead && (
                        <span className="text-xs font-semibold text-primary">• New</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          {filtered.length} notification{filtered.length !== 1 ? "s" : ""} shown
        </p>
      )}
    </>
  );
}
