import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * A single KPI stat shown in the dashboard stat grid.
 *
 * `gradient` is a Tailwind gradient stop pair, e.g. "from-blue-500 to-indigo-600".
 */
export interface StatCardItem {
  label: string;
  value?: string | number;
  icon: ReactNode;
  trend?: string;
  gradient: string;
  isLoading?: boolean;
}

/**
 * Shared KPI stat-card grid used across the role dashboards (principal, and
 * incrementally the school-admin / admin consoles). Extracted so the gradient
 * card markup lives in one place instead of being copy-pasted per dashboard
 * (see #264).
 */
export function StatCardGrid({ stats }: { stats: StatCardItem[] }) {
  return (
    <section className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={stat.label}
          className="animate-fade-in-up overflow-hidden transition-shadow hover:shadow-md"
          style={{ animationDelay: `${index * 75}ms` }}
        >
          <CardContent className="relative p-5">
            <div
              className={`absolute right-0 top-0 h-20 w-20 bg-gradient-to-br ${stat.gradient} rounded-bl-full opacity-5`}
            />
            <div
              className={`rounded-xl bg-gradient-to-br p-2.5 ${stat.gradient} mb-3 w-fit text-white shadow-sm`}
            >
              {stat.icon}
            </div>
            <div className="text-2xl font-bold tracking-tight">
              {stat.isLoading ? (
                <Skeleton className="h-7 w-16" />
              ) : stat.value === "Error" ? (
                <span className="text-sm text-red-500">Error</span>
              ) : (
                stat.value || "0"
              )}
            </div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            {stat.trend ? (
              <div className="mt-1 text-xs font-medium text-primary/70">{stat.trend}</div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
