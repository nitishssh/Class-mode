import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

export default function EducatorStudents() {
  const { data } = useQuery({
    queryKey: ["/api/educator/students"],
    queryFn: async () => {
      const res = await fetch("/api/educator/students");
      return res.json();
    },
  });
  const students = (data as any)?.data || [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Student Roster" subtitle="Manage students in your classes">
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Student
        </Button>
      </PageHeader>
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
    </div>
  );
}
