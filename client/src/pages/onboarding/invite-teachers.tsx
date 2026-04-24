import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const GRADES = ["Nursery", "LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)];

export default function InviteTeachers() {
  const [form, setForm] = useState({ name: "", email: "", grades: [] as string[] });
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: invites = [] } = useQuery<any[]>({ queryKey: ["/api/invite/teacher/list"] });

  const toggleGrade = (g: string) =>
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g],
    }));

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/invite/teacher", form),
    onSuccess: () => {
      toast({ title: "Invite sent!", description: `${form.email} will receive an email shortly.` });
      setForm({ name: "", email: "", grades: [] });
      qc.invalidateQueries({ queryKey: ["/api/invite/teacher/list"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/invite/resend/${id}`),
    onSuccess: () => {
      toast({ title: "Invite resent" });
      qc.invalidateQueries({ queryKey: ["/api/invite/teacher/list"] });
    },
  });

  const canSend = form.name && form.email && form.grades.length > 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Invite Teachers</h1>
          <p className="mt-1 text-muted-foreground">
            Teachers will receive an email to set up their account.
          </p>
        </div>

        {/* Invite form */}
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Teacher name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ms. Priya Nair"
              />
            </div>
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="teacher@school.edu"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Grades they teach *</Label>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${form.grades.includes(g) ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}
                >
                  {g}
                </button>
              ))}
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

        {/* Pending invites list */}
        {invites.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Sent Invites
            </h2>
            {invites.map((inv: any) => (
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
                    {inv.status === "accepted" ? "Accepted" : "Invited"}
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

        <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
          Go to Dashboard →
        </Button>
      </div>
    </div>
  );
}
