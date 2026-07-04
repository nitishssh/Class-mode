import { ShieldAlert } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface PermissionDeniedProps {
  message?: string;
  className?: string;
}

// Distinct from an empty-list state: a 403 means the account is not allowed
// to see this data (e.g. missing/mis-scoped schoolCode), not that there is
// genuinely nothing to show. Surfacing the two identically hides broken
// access control behind what looks like a benign empty state.
export function PermissionDenied({
  message = "You don't have permission to view this.",
  className,
}: PermissionDeniedProps) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-3 p-16 text-center">
        <div className="rounded-2xl bg-destructive/10 p-4">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <p className="font-semibold">Access restricted</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          If you believe this is a mistake, contact your school administrator.
        </p>
      </CardContent>
    </Card>
  );
}
