import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function InviteStudents() {
  const [form, setForm] = useState({ studentName: "", parentEmail: "", grade: "", classId: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const csvRef = useRef<HTMLInputElement>(null);

  const { data: classes = [] } = useQuery<any[]>({ queryKey: ["/api/classes/mine"] });
  const { data: invites = [] } = useQuery<any[]>({
    queryKey: ["/api/invite/student/list", form.classId],
    queryFn: () =>
      fetch(`/api/invite/student/list${form.classId ? `?classId=${form.classId}` : ""}`, {
        credentials: "include",
      }).then((r) => r.json()),
    enabled: true,
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/invite/student", form),
    onSuccess: () => {
      toast({ title: "Invite sent!" });
      setForm((f) => ({ ...f, studentName: "", parentEmail: "" }));
      qc.invalidateQueries({ queryKey: ["/api/invite/student/list"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/invite/resend/${id}`),
    onSuccess: () => toast({ title: "Invite resent" }),
  });

  // CSV bulk invite
  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.trim().split("\n").slice(1); // skip header
    let sent = 0;
    for (const row of rows) {
      const [studentName, parentEmail, grade, className] = row.split(",").map((s) => s.trim());
      const cls = (classes as any[]).find((c: any) => c.name === className);
      if (!cls) continue;
      try {
        await apiRequest("POST", "/api/invite/student", {
          studentName,
          parentEmail,
          grade,
          classId: cls._id,
        });
        sent++;
      } catch {}
    }
    toast({ title: `${sent} invites sent from CSV` });
    qc.invalidateQueries({ queryKey: ["/api/invite/student/list"] });
    if (csvRef.current) csvRef.current.value = "";
  };

  const selectedClass = (classes as any[]).find((c: any) => c._id === form.classId);
  const canSend = form.studentName && form.parentEmail && form.grade && form.classId;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Invite Students</h1>
        <p className="mt-1 text-muted-foreground">
          Invite emails are sent to the parent's address.
        </p>
      </div>

      {/* Class selector */}
      <div className="flex flex-wrap gap-2">
        {(classes as any[]).map((cls: any) => (
          <button
            key={cls._id}
            type="button"
            onClick={() => setForm((f) => ({ ...f, classId: cls._id, grade: cls.grade }))}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${form.classId === cls._id ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
          >
            {cls.name}
          </button>
        ))}
      </div>

      {/* Invite form */}
      <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Student name *</Label>
            <Input
              value={form.studentName}
              onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))}
              placeholder="Riya Gupta"
            />
          </div>
          <div className="space-y-1">
            <Label>Parent email *</Label>
            <Input
              type="email"
              value={form.parentEmail}
              onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value }))}
              placeholder="parent@email.com"
            />
          </div>
        </div>
        <Button
          onClick={() => sendMutation.mutate()}
          disabled={!canSend || sendMutation.isPending}
          className="w-full"
        >
          {sendMutation.isPending ? "Sending…" : "Send Invite"}
        </Button>
      </div>

      {/* CSV upload */}
      <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-4">
        <p className="text-sm font-medium">Bulk invite via CSV</p>
        <p className="text-xs text-muted-foreground">
          Columns: studentName, parentEmail, grade, class
        </p>
        <Input ref={csvRef} type="file" accept=".csv" onChange={handleCSV} />
      </div>

      {/* Invite list */}
      {invites.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            {selectedClass ? `Students in ${selectedClass.name}` : "All Invited Students"}
          </h2>
          {(invites as any[]).map((inv: any) => (
            <div
              key={inv._id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium">{inv.name}</p>
                <p className="text-sm text-muted-foreground">{inv.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={inv.status === "accepted" ? "default" : "outline"}>
                  {inv.status === "accepted" ? "Enrolled" : "Invited"}
                </Badge>
                {inv.status === "pending" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resendMutation.mutate(inv._id)}
                  >
                    Resend
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
