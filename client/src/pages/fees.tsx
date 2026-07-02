import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, IndianRupee, Loader2, MessageCircle, Plus, Receipt } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type FeeStatus = "pending" | "paid" | "waived";

interface Fee {
  id: number;
  studentId: number;
  studentName: string;
  description: string;
  amountCents: number;
  currency: string;
  status: FeeStatus;
  dueDate: string | null;
  paidAt: string | null;
}

interface FeeSummary {
  pendingCents: number;
  paidCents: number;
  pendingCount: number;
  paidCount: number;
}

interface StudentOption {
  id: number;
  name: string;
}

function money(cents: number, currency = "INR"): string {
  const amount = (cents / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return currency === "INR" ? `₹${amount}` : `${currency} ${amount}`;
}

const STATUS_BADGE: Record<FeeStatus, "warning" | "success" | "outline"> = {
  pending: "warning",
  paid: "success",
  waived: "outline",
};

export default function FeesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | FeeStatus>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [remindFee, setRemindFee] = useState<Fee | null>(null);
  const [phone, setPhone] = useState("");

  // Create-form state
  const [studentId, setStudentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amountRupees, setAmountRupees] = useState("");
  const [dueDate, setDueDate] = useState("");

  const feesUrl = statusFilter === "all" ? "/api/fees" : `/api/fees?status=${statusFilter}`;
  const { data: fees = [], isLoading } = useQuery<Fee[]>({ queryKey: [feesUrl] });
  const { data: summary } = useQuery<FeeSummary>({ queryKey: ["/api/fees/summary"] });
  const { data: students = [] } = useQuery<StudentOption[]>({
    queryKey: ["/api/users?role=student"],
    enabled: createOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [feesUrl] });
    queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
    queryClient.invalidateQueries({ queryKey: ["/api/fees/summary"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fees", {
        studentId: parseInt(studentId, 10),
        description,
        amountCents: Math.round(parseFloat(amountRupees) * 100),
        ...(dueDate ? { dueDate } : {}),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Fee created" });
      setCreateOpen(false);
      setStudentId("");
      setDescription("");
      setAmountRupees("");
      setDueDate("");
      invalidate();
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create fee", description: err.message, variant: "destructive" }),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/fees/${id}/mark-paid`),
    onSuccess: () => {
      toast({ title: "Marked paid" });
      invalidate();
    },
    onError: (err: Error) =>
      toast({ title: "Failed to mark paid", description: err.message, variant: "destructive" }),
  });

  const remindMutation = useMutation({
    mutationFn: async ({ id, to }: { id: number; to: string }) => {
      const res = await apiRequest("POST", `/api/fees/${id}/remind`, { phone: to });
      return res.json();
    },
    onSuccess: (data: { simulated: boolean }) => {
      toast({
        title: data.simulated ? "Reminder simulated" : "Reminder sent",
        description: data.simulated
          ? "WhatsApp credentials are not configured — the message was logged, not delivered."
          : "WhatsApp fee reminder delivered.",
      });
      setRemindFee(null);
      setPhone("");
    },
    onError: (err: Error) =>
      toast({ title: "Failed to send reminder", description: err.message, variant: "destructive" }),
  });

  const createValid = useMemo(
    () =>
      !!studentId &&
      description.trim().length > 0 &&
      !isNaN(parseFloat(amountRupees)) &&
      parseFloat(amountRupees) >= 0,
    [studentId, description, amountRupees]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader title="Fees" subtitle="Track, collect, and remind — the school's fee register.">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-fee">
              <Plus className="mr-1 h-4 w-4" /> New fee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create fee</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Student</label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <Input
                  placeholder="e.g. Term 2 tuition fee"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Amount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="5000"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium">Due date (optional)</label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!createValid || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <IndianRupee className="h-4 w-4" /> Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{money(summary?.pendingCents ?? 0)}</p>
            <p className="text-sm text-muted-foreground">
              {summary?.pendingCount ?? 0} fees outstanding
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" /> Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{money(summary?.paidCents ?? 0)}</p>
            <p className="text-sm text-muted-foreground">{summary?.paidCount ?? 0} fees paid</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5" /> Fee records
          </CardTitle>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading fees…
            </div>
          ) : fees.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">
              No fees yet. Create the first one with “New fee”.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {fees.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <div className="min-w-44 flex-1">
                    <p className="font-medium">{f.studentName}</p>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                  </div>
                  <div className="w-28 text-right font-medium">
                    {money(f.amountCents, f.currency)}
                  </div>
                  <div className="w-28 text-center text-sm text-muted-foreground">
                    {f.dueDate ? String(f.dueDate).slice(0, 10) : "—"}
                  </div>
                  <Badge variant={STATUS_BADGE[f.status]}>{f.status}</Badge>
                  <div className="flex gap-1">
                    {f.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPaidMutation.mutate(f.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          Mark paid
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRemindFee(f)}>
                          <MessageCircle className="mr-1 h-4 w-4" /> Remind
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!remindFee} onOpenChange={(open) => !open && setRemindFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send WhatsApp fee reminder</DialogTitle>
          </DialogHeader>
          {remindFee && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {remindFee.studentName} — {remindFee.description} (
                {money(remindFee.amountCents, remindFee.currency)})
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium">Parent's WhatsApp number</label>
                <Input
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => remindFee && remindMutation.mutate({ id: remindFee.id, to: phone })}
              disabled={!phone.trim() || remindMutation.isPending}
            >
              {remindMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
