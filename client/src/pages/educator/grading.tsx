import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { isPermissionError } from "@/lib/queryClient";
import { PermissionDenied } from "@/components/ui/permission-denied";

export default function EducatorGrading() {
  const { data, refetch, isError, error } = useQuery<any[]>({
    queryKey: ["/api/educator/grading/pending"],
  });
  const pending = data || [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Pending Grading" subtitle="Review and grade student submissions">
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </PageHeader>
      {isPermissionError(error) ? (
        <div className="p-4">
          <PermissionDenied message="You don't have permission to view grading submissions." />
        </div>
      ) : isError ? (
        <p className="p-4 text-muted-foreground">Failed to load grading queue. Please try again.</p>
      ) : (
        <div className="space-y-2 p-4">
          {pending.length === 0 && <p className="text-muted-foreground">No pending grading.</p>}
          {pending.map((g: any) => (
            <div
              key={g.submissionId}
              className="flex items-center justify-between rounded border p-4"
            >
              <div>
                <p className="font-medium">Submission {g.submissionId?.slice(0, 8)}</p>
                <p className="text-sm text-muted-foreground">
                  Student: {g.studentId} • {g.contentType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{g.status}</Badge>
                <Button size="sm">Review</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
