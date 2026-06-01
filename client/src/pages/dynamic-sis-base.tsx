import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useTranslation } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DynamicBase, DynamicTable, InsertDynamicTable } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Database, ChevronLeft, Loader2, Table as TableIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataGrid from "@/components/dynamic-sis/DataGrid";

export default function DynamicSISBasePage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/dynamic-sis/base/:id");
  const baseId = parseInt(params?.id || "0");
  
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  const { data: base, isLoading: isBaseLoading } = useQuery<DynamicBase>({
    queryKey: [`/api/dynamic-sis/bases/${baseId}`],
    enabled: !!baseId,
  });

  const { data: tables, isLoading: isTablesLoading } = useQuery<DynamicTable[]>({
    queryKey: [`/api/dynamic-sis/bases/${baseId}/tables`],
    enabled: !!baseId,
  });

  useEffect(() => {
    if (tables && tables.length > 0 && !activeTableId) {
      setTimeout(() => setActiveTableId(tables[0].id.toString()), 0);
    }
  }, [tables, activeTableId]);

  const createTableMutation = useMutation({
    mutationFn: async (newTable: InsertDynamicTable) => {
      const res = await apiRequest("POST", `/api/dynamic-sis/bases/${baseId}/tables`, newTable);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/bases/${baseId}/tables`] });
      setIsCreateTableOpen(false);
      setNewTableName("");
      setActiveTableId(data.id.toString());
    },
  });

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !baseId) return;
    createTableMutation.mutate({
      baseId,
      name: newTableName,
      ord: tables?.length || 0,
    });
  };

  if (isBaseLoading || isTablesLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!base) return <div>Base not found</div>;

  return (
    <div className="flex h-[calc(100vh-120px)] flex-col space-y-4">
      <div className="flex items-center gap-4">
        <Link href="/dynamic-sis">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">{base.name}</h1>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
          <Tabs value={activeTableId || ""} onValueChange={setActiveTableId} className="w-full">
            <div className="flex items-center gap-2">
              <TabsList className="h-9">
                {tables?.map((table) => (
                  <TabsTrigger key={table.id} value={table.id.toString()} className="px-4 py-1.5">
                    <TableIcon className="mr-2 h-3.5 w-3.5" />
                    {table.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              <Dialog open={isCreateTableOpen} onOpenChange={setIsCreateTableOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleCreateTable}>
                    <DialogHeader>
                      <DialogTitle>{t("sis.newTableTitle", "Add a New Table")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="tableName">{t("sis.tableName", "Table Name")}</Label>
                        <Input 
                          id="tableName" 
                          placeholder="e.g. Student Fees" 
                          value={newTableName} 
                          onChange={(e) => setNewTableName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createTableMutation.isPending}>
                        {createTableMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t("common.add", "Add")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </Tabs>
        </div>

        <div className="flex-1 overflow-hidden">
          {activeTableId ? (
            <DataGrid tableId={parseInt(activeTableId)} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center space-y-4 p-12 text-center">
              <TableIcon className="h-12 w-12 text-muted-foreground/50" />
              <div className="space-y-1">
                <h3 className="text-lg font-medium">{t("sis.noTables", "No tables in this base")}</h3>
                <p className="text-sm text-muted-foreground">{t("sis.noTablesDesc", "Start by adding a table to manage your data.")}</p>
              </div>
              <Button onClick={() => setIsCreateTableOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("sis.addFirstTable", "Add First Table")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
