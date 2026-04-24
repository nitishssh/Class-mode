import { ReactNode } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  href: string;
  bgColor: string;
  iconColor: string;
}

export function QuickActionCard({
  title,
  description,
  icon,
  href,
  bgColor,
  iconColor,
}: QuickActionCardProps) {
  return (
    <Link href={href} className="group block h-full">
      <Card className="h-full border-border bg-card shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-card">
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div
              className={`shrink-0 rounded-xl p-2.5 transition-transform duration-200 group-hover:scale-110 ${bgColor} ${iconColor}`}
            >
              <div className="h-5 w-5">{icon}</div>
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-accent">
                {title}
              </h3>
              <p className="mt-0.5 truncate text-xs leading-snug text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
