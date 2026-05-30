import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

export function TeachersPage() {
  const { t } = useTranslation();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [classInput, setClassInput] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: teachers, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/teachers"],
  });

  const assignClassesMutation = useMutation({
    mutationFn: async ({ id, classIds }: { id: number; classIds: string[] }) => {
      await apiRequest("POST", `/api/admin/teachers/${id}/classes`, { classIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/teachers"] });
      setIsDialogOpen(false);
      setClassInput("");
    },
  });

  const handleAssignClasses = () => {
    if (!selectedTeacher) return;

    // Simple comma-separated parsing for the mock
    const classIds = classInput.split(",").map(c => c.trim()).filter(Boolean);
    assignClassesMutation.mutate({ id: selectedTeacher.id, classIds });
  };

  const openAssignModal = (teacher: any) => {
    setSelectedTeacher(teacher);
    setClassInput(teacher.classesAssigned.join(", "));
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.teachersTitle", "Teachers Management")}</h1>
          <p className="text-muted-foreground">
            {t("admin.teachersDesc", "Manage teaching staff and their assigned classes.")}
          </p>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.name", "Name")}</TableHead>
                <TableHead>{t("admin.classesAssigned", "Classes Assigned")}</TableHead>
                <TableHead>{t("admin.avgStudentProgress", "Avg Student Progress")}</TableHead>
                <TableHead className="text-right">{t("admin.action", "Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : teachers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    {t("admin.noTeachersFound", "No teachers found.")}
                  </TableCell>
                </TableRow>
              ) : (
                teachers?.map((teacher: any) => (
                  <TableRow key={teacher.id}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>
                      {teacher.classesAssigned.length > 0
                        ? teacher.classesAssigned.join(", ")
                        : <span className="text-muted-foreground italic">None assigned</span>}
                    </TableCell>
                    <TableCell>{teacher.avgStudentProgress}%</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openAssignModal(teacher)}>
                        {t("admin.assignClasses", "Assign Classes")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("admin.assignClassesFor", "Assign Classes for")} {selectedTeacher?.name}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">
                  {t("admin.commaSeparatedClasses", "Classes (Comma separated)")}
                </label>
                <Input
                  value={classInput}
                  onChange={(e) => setClassInput(e.target.value)}
                  placeholder="e.g. Grade 10-A, Grade 9-B"
                />
              </div>
              <Button
                onClick={handleAssignClasses}
                disabled={assignClassesMutation.isPending}
                className="w-full"
              >
                {assignClassesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t("admin.saveAssignments", "Save Assignments")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
