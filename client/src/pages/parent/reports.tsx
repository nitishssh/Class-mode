import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

export default function ParentReports() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/parent/reports"],
    queryFn: async () => {
      const res = await fetch("/api/parent/reports");
      return res.json();
    },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  const reports = data?.data || [];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Progress Reports" subtitle="View your child's academic progress">
        <Button variant="outline"><Download className="h-4 w-4 mr-2" /> Export PDF</Button>
      </PageHeader>
      <div className="p-4 space-y-4">
        {reports.map((r: any) => (
          <Card key={r.studentId}>
            <CardHeader><CardTitle>{r.name}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-sm text-muted-foreground">Total Graded</p><p className="text-2xl font-bold">{r.totalGraded}</p></div>
                <div><p className="text-sm text-muted-foreground">Average Score</p><p className="text-2xl font-bold">{r.averageScore}%</p></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
