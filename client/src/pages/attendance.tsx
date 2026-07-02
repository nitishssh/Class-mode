import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, Loader2, Users, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type Status = "present" | "absent" | "late" | "excused";

interface RosterStudent {
  id: number;
  name: string;
}

interface AttendanceRow {
  studentId: number;
  studentName: string;
  status: Status;
}

const STATUS_OPTIONS: { value: Status; label: string; activeClass: string }[] = [
  {
    value: "present",
    label: "Present",
    activeClass: "bg-emerald-600 text-white hover:bg-emerald-600",
  },
  { value: "absent", label: "Absent", activeClass: "bg-red-600 text-white hover:bg-red-600" },
  { value: "late", label: "Late", activeClass: "bg-amber-500 text-white hover:bg-amber-500" },
  { value: "excused", label: "Excused", activeClass: "bg-sky-600 text-white hover:bg-sky-600" },
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AttendancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [className, setClassName] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [marks, setMarks] = useState<Record<number, Status>>({});

  const { data: classes = [], isLoading: classesLoading } = useQuery<string[]>({
    queryKey: ["/api/attendance/classes"],
  });

  // Default to the first class once the list loads.
  useEffect(() => {
    if (!className && classes.length > 0) setClassName(classes[0]);
  }, [classes, className]);

  const { data: roster = [], isLoading: rosterLoading } = useQuery<RosterStudent[]>({
    queryKey: [`/api/attendance/roster?className=${encodeURIComponent(className)}`],
    enabled: !!className,
  });

  const { data: existing = [] } = useQuery<AttendanceRow[]>({
    queryKey: [`/api/attendance?className=${encodeURIComponent(className)}&date=${date}`],
    enabled: !!className && !!date,
  });

  // Seed local marks from saved rows whenever class/date/roster changes.
  useEffect(() => {
    const seeded: Record<number, Status> = {};
    for (const row of existing) seeded[row.studentId] = row.status;
    setMarks(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [className, date, existing.length]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 };
    for (const s of roster) {
      const st = marks[s.id];
      if (st) c[st] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [roster, marks]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        className,
        date,
        marks: roster
          .filter((s) => marks[s.id])
          .map((s) => ({ studentId: s.id, status: marks[s.id] })),
      };
      const res = await apiRequest("POST", "/api/attendance", payload);
      return res.json();
    },
    onSuccess: (data: { written: number }) => {
      toast({ title: "Attendance saved", description: `${data.written} students marked.` });
      queryClient.invalidateQueries({
        queryKey: [`/api/attendance?className=${encodeURIComponent(className)}&date=${date}`],
      });
    },
    onError: (err: Error) =>
      toast({
        title: "Failed to save attendance",
        description: err.message,
        variant: "destructive",
      }),
  });

  const markAll = (status: Status) => {
    const next: Record<number, Status> = {};
    for (const s of roster) next[s.id] = status;
    setMarks(next);
  };

  const markedCount = roster.length - counts.unmarked;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Attendance"
        subtitle="Mark daily attendance for your class — the register lives here, not on paper."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck className="h-5 w-5" />
            Class register
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <label className="mb-1 block text-sm font-medium">Class</label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger data-testid="class-select">
                  <SelectValue placeholder={classesLoading ? "Loading…" : "Select class"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <label className="mb-1 block text-sm font-medium">Date</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAll("present")}
                disabled={roster.length === 0}
              >
                <Check className="mr-1 h-4 w-4" /> All present
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={markedCount === 0 || saveMutation.isPending}
                data-testid="save-attendance"
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save ({markedCount}/{roster.length})
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="success">{counts.present} present</Badge>
            <Badge variant="destructive">{counts.absent} absent</Badge>
            <Badge variant="warning">{counts.late} late</Badge>
            <Badge variant="accent">{counts.excused} excused</Badge>
            {counts.unmarked > 0 && <Badge variant="outline">{counts.unmarked} unmarked</Badge>}
          </div>

          {rosterLoading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading roster…
            </div>
          ) : roster.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p>
                {className
                  ? "No students found in this class."
                  : "Select a class to load its roster."}
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {roster.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="min-w-40 flex-1 font-medium">{s.name}</span>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-8 px-2 text-xs",
                          marks[s.id] === opt.value && opt.activeClass
                        )}
                        onClick={() => setMarks((m) => ({ ...m, [s.id]: opt.value }))}
                      >
                        {opt.label}
                      </Button>
                    ))}
                    {marks[s.id] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        title="Clear"
                        onClick={() =>
                          setMarks((m) => {
                            const next = { ...m };
                            delete next[s.id];
                            return next;
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
