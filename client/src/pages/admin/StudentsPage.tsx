import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Link } from "wouter";

export function StudentsPage() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: students, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/students"],
  });

  const filteredStudents = students?.filter((s: any) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.class.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("admin.studentsTitle", "Students Directory")}</h1>
            <p className="text-muted-foreground">
              {t("admin.studentsDesc", "Manage and view progress for all students.")}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("admin.searchStudents", "Search students...")}
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.name", "Name")}</TableHead>
                <TableHead>{t("admin.class", "Class")}</TableHead>
                <TableHead>{t("admin.progress", "Progress")}</TableHead>
                <TableHead>{t("admin.status", "Status")}</TableHead>
                <TableHead className="text-right">{t("admin.action", "Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredStudents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    {t("admin.noStudentsFound", "No students found.")}
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents?.map((student: any) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.class}</TableCell>
                    <TableCell>{student.progressPct}%</TableCell>
                    <TableCell>
                      <Badge variant={student.status === "active" ? "default" : "outline"}>
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/students/${student.id}`}>
                        <div className="text-primary hover:underline cursor-pointer text-sm font-medium">
                          {t("admin.viewProfile", "View Profile")}
                        </div>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
