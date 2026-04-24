import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-muted-foreground",
        accent: "border-transparent bg-accent-soft text-accent",
        success: "border-transparent bg-green-50 text-green-700",
        warning: "border-transparent bg-amber-50 text-amber-700",
        destructive: "border-transparent bg-red-50 text-red-600",
        outline: "text-muted-foreground border-border",
        live: "border-transparent bg-red-50 text-red-600 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
