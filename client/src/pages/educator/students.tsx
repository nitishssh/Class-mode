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
        <Button><Plus className="h-4 w-4 mr-2" /> Add Student</Button>
      </PageHeader>
      <div className="p-4 space-y-2">
        {students.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-4 border rounded">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                {s.name?.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted-foreground">{s.email} • {s.class} • {s.grade}</p>
              </div>
            </div>
            <Badge variant="outline">{s.grade}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
