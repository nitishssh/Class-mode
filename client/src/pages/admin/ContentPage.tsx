import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";

export function ContentPage() {
  const { t } = useTranslation();

  const { data: content, isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/content"],
  });

  const toggleContentMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await apiRequest("PUT", `/api/admin/content/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content"] });
    },
  });

  const handleToggle = (id: string, currentStatus: boolean) => {
    toggleContentMutation.mutate({ id, enabled: !currentStatus });
  };

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("admin.contentVisibilityTitle", "Content Visibility")}</h1>
          <p className="text-muted-foreground">
            {t("admin.contentVisibilityDesc", "Manage which subjects and content are available to your school.")}
          </p>
        </div>

        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.subject", "Subject")}</TableHead>
                <TableHead>{t("admin.topicsIncluded", "Topics Included")}</TableHead>
                <TableHead className="text-right">{t("admin.enabled", "Enabled")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : content?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">
                    {t("admin.noContentFound", "No content found.")}
                  </TableCell>
                </TableRow>
              ) : (
                content?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.topics.join(", ")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <Switch
                          checked={item.enabledForSchool}
                          onCheckedChange={() => handleToggle(item.id, item.enabledForSchool)}
                          disabled={toggleContentMutation.isPending}
                        />
                      </div>
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
