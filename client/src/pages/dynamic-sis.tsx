import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DynamicBase, InsertDynamicBase } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Plus, Database, ArrowRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useWorkspace } from "@/contexts/workspace-context";

export default function DynamicSISPage() {
  const { t } = useTranslation();
  const { activeWorkspace } = useWorkspace();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newBaseName, setNewBaseName] = useState("");

  const workspaceId = activeWorkspace?.id;

  const { data: bases, isLoading } = useQuery<DynamicBase[]>({
    queryKey: [`/api/dynamic-sis/workspaces/${workspaceId}/bases`],
    enabled: !!workspaceId,
  });

  const createBaseMutation = useMutation({
    mutationFn: async (newBase: InsertDynamicBase) => {
      const res = await apiRequest("POST", `/api/dynamic-sis/workspaces/${workspaceId}/bases`, newBase);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/workspaces/${workspaceId}/bases`] });
      setIsCreateOpen(false);
      setNewBaseName("");
    },
  });

  const handleCreateBase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBaseName.trim() || !workspaceId) return;
    createBaseMutation.mutate({
      workspaceId,
      name: newBaseName,
      description: "Custom database for school operations",
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("sis.title", "No-Code SIS")}</h1>
          <p className="text-muted-foreground">
            {t("sis.description", "Build custom databases, fee trackers, and dynamic gradebooks.")}
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("sis.createBase", "Create Base")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateBase}>
              <DialogHeader>
                <DialogTitle>{t("sis.newBaseTitle", "Create a New Base")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("sis.baseName", "Base Name")}</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g. Fee Tracker 2026" 
                    value={newBaseName} 
                    onChange={(e) => setNewBaseName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createBaseMutation.isPending}>
                  {createBaseMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("common.create", "Create")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {bases?.map((base) => (
          <Link key={base.id} href={`/dynamic-sis/base/${base.id}`}>
            <Card className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Database className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{base.name}</CardTitle>
                  <CardDescription className="line-clamp-1">{base.description}</CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Created {new Date(base.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {bases?.length === 0 && (
          <Card className="col-span-full border-dashed p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{t("sis.noBases", "No bases yet")}</h3>
            <p className="mt-2 text-muted-foreground">
              {t("sis.noBasesDesc", "Create your first custom database to start tracking data.")}
            </p>
            <Button 
              variant="outline" 
              className="mt-6"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("sis.createFirstBase", "Create First Base")}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
