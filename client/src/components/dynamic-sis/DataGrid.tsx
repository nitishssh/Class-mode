import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DynamicField, DynamicRecord, InsertDynamicField, InsertDynamicRecord } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  MoreHorizontal, 
  Loader2, 
  Type, 
  Hash, 
  Calendar, 
  CheckSquare, 
  List, 
  Cpu, 
  MessageSquare, 
  Globe,
  Calculator,
  Send,
  Upload,
  FileSpreadsheet
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";

interface DataGridProps {
  tableId: number;
}

const FIELD_ICONS: Record<string, any> = {
  text: Type,
  number: Hash,
  date: Calendar,
  checkbox: CheckSquare,
  select: List,
  multiselect: List,
  formula: Calculator,
  ai_enrichment: Cpu,
  whatsapp_action: MessageSquare,
  api_fetch: Globe,
};

export default function DataGrid({ tableId }: DataGridProps) {
  const [isAddFieldOpen, setIsAddFieldOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<string>("text");
  const [aiPrompt, setAiPrompt] = useState("");
  const [formula, setFormula] = useState("");
  const [waPhoneField, setWaPhoneField] = useState("");
  const [waTemplate, setWaTemplate] = useState("");

  // Import State
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvDataHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: fields, isLoading: isFieldsLoading } = useQuery<DynamicField[]>({
    queryKey: [`/api/dynamic-sis/tables/${tableId}/fields`],
  });

  const { data: records, isLoading: isRecordsLoading } = useQuery<DynamicRecord[]>({
    queryKey: [`/api/dynamic-sis/tables/${tableId}/records`],
    refetchInterval: (query) => {
      const records = query.state.data as DynamicRecord[] | undefined;
      if (!records || !fields) return false;
      
      const enrichmentFields = fields.filter(f => ["ai_enrichment", "formula", "api_fetch"].includes(f.type));
      const hasPending = records.some(r => enrichmentFields.some(f => !r.data[f.name]));
      
      return hasPending ? 3000 : false;
    }
  });

  const createFieldMutation = useMutation({
    mutationFn: async (newField: InsertDynamicField) => {
      const res = await apiRequest("POST", `/api/dynamic-sis/tables/${tableId}/fields`, newField);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/tables/${tableId}/fields`] });
      setIsAddFieldOpen(false);
      setNewFieldName("");
      setAiPrompt("");
      setFormula("");
      setWaPhoneField("");
      setWaTemplate("");
    },
  });

  const createRecordMutation = useMutation({
    mutationFn: async (newRecord: InsertDynamicRecord) => {
      const res = await apiRequest("POST", `/api/dynamic-sis/tables/${tableId}/records`, newRecord);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/tables/${tableId}/records`] });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (records: any[]) => {
      const res = await apiRequest("POST", `/api/dynamic-sis/tables/${tableId}/bulk-records`, { records });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/tables/${tableId}/records`] });
      toast.success(data.message);
      setIsImportOpen(false);
      setCsvData([]);
      setMapping({});
    },
    onError: (err: any) => {
      toast.error(err.message || "Bulk import failed");
    }
  });

  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await apiRequest("PATCH", `/api/dynamic-sis/records/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/tables/${tableId}/records`] });
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async ({ recordId, fieldId }: { recordId: string, fieldId: number }) => {
      const res = await apiRequest("POST", `/api/dynamic-sis/records/${recordId}/whatsapp/${fieldId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/dynamic-sis/tables/${tableId}/records`] });
      toast.success("WhatsApp message sent successfully!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send WhatsApp");
    }
  });

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    
    let config = {};
    if (newFieldType === "ai_enrichment") config = { prompt: aiPrompt };
    else if (newFieldType === "formula") config = { formula };
    else if (newFieldType === "whatsapp_action") config = { phoneField: waPhoneField, template: waTemplate };

    createFieldMutation.mutate({
      tableId,
      name: newFieldName,
      type: newFieldType as any,
      ord: fields?.length || 0,
      config,
      isPrimary: (fields?.length || 0) === 0,
      isHidden: false,
    });
  };

  const handleAddRecord = () => {
    createRecordMutation.mutate({
      tableId,
      data: {},
    });
  };

  const handleCellBlur = (recordId: string, fieldName: string, value: string) => {
    updateRecordMutation.mutate({
      id: recordId,
      data: { [fieldName]: value },
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        if (results.meta.fields) {
          setCsvDataHeaders(results.meta.fields);
          // Auto-map based on name similarity
          const initialMapping: Record<string, string> = {};
          fields?.forEach(f => {
            const match = results.meta.fields?.find(h => h.toLowerCase() === f.name.toLowerCase());
            if (match) initialMapping[f.name] = match;
          });
          setMapping(initialMapping);
        }
      }
    });
  };

  const handleImport = () => {
    const recordsToImport = csvData.map(row => {
      const data: Record<string, any> = {};
      Object.entries(mapping).forEach(([fieldName, csvHeader]) => {
        data[fieldName] = row[csvHeader];
      });
      return data;
    });

    bulkCreateMutation.mutate(recordsToImport);
  };

  if (isFieldsLoading || isRecordsLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2 bg-background">
        <Button variant="outline" size="sm" onClick={handleAddRecord}>
          <Plus className="mr-2 h-4 w-4" />
          Add Record
        </Button>
        <div className="h-4 w-[1px] bg-border mx-2" />
        <Button variant="ghost" size="sm" onClick={() => setIsAddFieldOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Field
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsImportOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Bulk Import
        </Button>
      </div>

      {/* Grid Container */}
      <div className="flex-1 overflow-auto relative">
        <table className="w-full border-collapse text-sm table-fixed min-w-[1000px]">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-12 border-b border-r bg-muted/50 p-0 text-center sticky top-0 left-0 z-20">
                <div className="h-10 flex items-center justify-center">#</div>
              </th>
              {fields?.map((field) => {
                const Icon = FIELD_ICONS[field.type] || Type;
                return (
                  <th key={field.id} className="h-10 border-b border-r bg-muted/50 p-0 text-left font-medium sticky top-0 z-10 w-48">
                    <div className="flex items-center justify-between px-3 h-full group">
                      <div className="flex items-center gap-2 truncate">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate">{field.name}</span>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Field Settings</DropdownMenuLabel>
                          <DropdownMenuItem>Edit Field</DropdownMenuItem>
                          <DropdownMenuItem>Sort A-Z</DropdownMenuItem>
                          <DropdownMenuItem>Filter</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">Delete Field</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </th>
                );
              })}
              <th className="border-b bg-muted/50 sticky top-0 z-10"></th>
            </tr>
          </thead>
          <tbody>
            {records?.map((record, idx) => (
              <tr key={record.id} className="group hover:bg-muted/30">
                <td className="border-b border-r p-0 text-center text-xs text-muted-foreground sticky left-0 bg-background group-hover:bg-muted/30 z-10">
                  <div className="h-9 flex items-center justify-center">{idx + 1}</div>
                </td>
                {fields?.map((field) => (
                  <td key={field.id} className="border-b border-r p-0 h-9">
                    {field.type === "whatsapp_action" ? (
                      <div className="flex items-center justify-between h-full px-2 gap-2">
                        <span className="text-xs text-muted-foreground truncate">{record.data[field.name] || "Ready to send"}</span>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => sendWhatsAppMutation.mutate({ recordId: record.id, fieldId: field.id })}
                          disabled={sendWhatsAppMutation.isPending}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <input
                        className="w-full h-full px-3 py-1 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
                        defaultValue={record.data[field.name] || ""}
                        onBlur={(e) => handleCellBlur(record.id, field.name, e.target.value)}
                        disabled={["ai_enrichment", "formula", "api_fetch"].includes(field.type)}
                      />
                    )}
                  </td>
                ))}
                <td className="border-b"></td>
              </tr>
            ))}
            
            <tr className="hover:bg-muted/30 cursor-pointer" onClick={handleAddRecord}>
              <td className="border-b border-r p-0 h-9 sticky left-0 bg-background group-hover:bg-muted/30 z-10"></td>
              {fields?.map((field) => (
                <td key={field.id} className="border-b border-r p-0 h-9 bg-muted/5"></td>
              ))}
              <td className="border-b flex items-center px-4 h-9 text-muted-foreground italic text-xs">
                Click to add a new record...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Field Dialog */}
      <Dialog open={isAddFieldOpen} onOpenChange={setIsAddFieldOpen}>
        <DialogContent>
          <form onSubmit={handleAddField}>
            <DialogHeader>
              <DialogTitle>Add a New Field</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fieldName">Field Name</Label>
                <Input 
                  id="fieldName" 
                  placeholder="e.g. Total Fees" 
                  value={newFieldName} 
                  onChange={(e) => setNewFieldName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fieldType">Field Type</Label>
                <Select value={newFieldType} onValueChange={setNewFieldType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="select">Select (Single)</SelectItem>
                    <SelectItem value="multiselect">Select (Multi)</SelectItem>
                    <SelectItem value="formula">Formula (Excel-like)</SelectItem>
                    <SelectItem value="ai_enrichment">AI Enrichment (Clay)</SelectItem>
                    <SelectItem value="whatsapp_action">WhatsApp Action</SelectItem>
                    <SelectItem value="api_fetch">API Fetch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newFieldType === "ai_enrichment" && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <Label htmlFor="aiPrompt">AI Prompt Template</Label>
                  <Input 
                    id="aiPrompt" 
                    placeholder="e.g. Summarize the progress for {{Name}}" 
                    value={aiPrompt} 
                    onChange={(e) => setAiPrompt(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Use {"{{Field Name}}"} to insert row data into the prompt.
                  </p>
                </div>
              )}

              {newFieldType === "formula" && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <Label htmlFor="formula">Formula Template</Label>
                  <Input 
                    id="formula" 
                    placeholder="e.g. {{Fees}} + {{Fine}}" 
                    value={formula} 
                    onChange={(e) => setFormula(e.target.value)}
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Simple math or string concatenation. Use {"{{Field Name}}"}.
                  </p>
                </div>
              )}

              {newFieldType === "whatsapp_action" && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="waPhoneField">Phone Number Column</Label>
                    <Select value={waPhoneField} onValueChange={setWaPhoneField}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column with phone number" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields?.filter(f => f.type === "text" || f.type === "number").map(f => (
                          <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="waTemplate">Message Template</Label>
                    <Input 
                      id="waTemplate" 
                      placeholder="e.g. Dear parent, {{Name}} has a pending fee of {{Balance}}" 
                      value={waTemplate} 
                      onChange={(e) => setWaTemplate(e.target.value)}
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Use {"{{Field Name}}"} to insert row data.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createFieldMutation.isPending}>
                {createFieldMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Add Field
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file and map its columns to your table fields.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {!csvData.length ? (
              <div 
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-12 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{csvData.length} rows found in CSV</p>
                  <Button variant="ghost" size="sm" onClick={() => { setCsvData([]); setMapping({}); }}>
                    Change File
                  </Button>
                </div>
                
                <div className="grid gap-4 max-h-[300px] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground px-2">
                    <div>Table Field</div>
                    <div>CSV Column</div>
                  </div>
                  {fields?.filter(f => !["ai_enrichment", "formula", "whatsapp_action", "api_fetch"].includes(f.type)).map(field => (
                    <div key={field.id} className="grid grid-cols-2 gap-4 items-center bg-muted/30 p-2 rounded-lg">
                      <Label className="text-sm">{field.name}</Label>
                      <Select 
                        value={mapping[field.name] || ""} 
                        onValueChange={(val) => setMapping(prev => ({ ...prev, [field.name]: val }))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Skip field" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Skip field</SelectItem>
                          {csvHeaders.map(header => (
                            <SelectItem key={header} value={header}>{header}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button 
              disabled={!csvData.length || bulkCreateMutation.isPending} 
              onClick={handleImport}
            >
              {bulkCreateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Import Records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
