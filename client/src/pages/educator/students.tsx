import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { isPermissionError } from "@/lib/queryClient";
import { PermissionDenied } from "@/components/ui/permission-denied";

export default function EducatorStudents() {
  const { data, isError, error } = useQuery({
    queryKey: ["/api/educator/students"],
  });
  const students = (data as any) || [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Student Roster" subtitle="Manage students in your classes">
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </PageHeader>
      {isPermissionError(error) ? (
        <div className="p-4">
          <PermissionDenied message="You don't have permission to view this student roster." />
        </div>
      ) : isError ? (
        <p className="p-4 text-muted-foreground">Failed to load students. Please try again.</p>
      ) : (
        <div className="space-y-2 p-4">
          {students.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {s.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {s.email} • {s.class} • {s.grade}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{s.grade}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
