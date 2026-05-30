import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, User, BookOpen, Clock } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { format } from "date-fns";

export function StudentDetail() {
  const { t } = useTranslation();
  const [, params] = useRoute("/admin/students/:id");
  const id = params?.id;

  const { data: student, isLoading } = useQuery<any>({
    queryKey: [`/api/admin/students/${id}`],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!student) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <h2 className="text-xl font-bold">Student not found</h2>
          <Link href="/admin/students">
            <Button variant="outline">Back to Students</Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/students">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{student.name}</h1>
            <p className="text-muted-foreground">
              {t("admin.studentProfile", "Student Profile")}
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.status", "Status")}</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={student.status === "active" ? "default" : "outline"} className="mb-2">
                {student.status}
              </Badge>
              <div className="text-sm text-muted-foreground mt-2">
                Last active: {format(new Date(student.lastActive), "PP p")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.class", "Class")}</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{student.class}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("admin.overallProgress", "Overall Progress")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{student.progressPct}%</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
