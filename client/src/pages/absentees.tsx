import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { todayISO } from "@/lib/dates";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Printer, Download } from "lucide-react";

interface AbsenteeRow {
  studentId: number;
  studentName: string;
  className: string | null;
  parentPhone: string | null;
  note: string | null;
}

interface AbsenteesResponse {
  date: string;
  count: number;
  absentees: AbsenteeRow[];
}

/**
 * The day's absentee call list: every student marked absent today, with the
 * parent phone number, grouped by class. This is the manual follow-up
 * artifact the pilot offer promises — the school calls parents from this
 * list; nothing is auto-sent.
 */
export default function AbsenteesPage() {
  const [date, setDate] = useState(todayISO());
  const { toast } = useToast();

  // Download via fetch (not a bare <a href>): anchors send only cookies, so a
  // token-auth session would silently save the 401 JSON error body as a .csv.
  // Any non-2xx becomes a visible toast instead of a corrupt file.
  const downloadCsv = async (path: string, filename: string) => {
    try {
      const res = await apiRequest("GET", path);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not download the file.",
        variant: "destructive",
      });
    }
  };

  // A call list must be live: teachers are still marking while the office
  // calls, so bypass the app-wide 5-minute staleTime for this query.
  const { data, isLoading, isError } = useQuery<AbsenteesResponse>({
    queryKey: [`/api/attendance/absentees?date=${date}`],
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const byClass = new Map<string, AbsenteeRow[]>();
  for (const row of data?.absentees ?? []) {
    const key = row.className || "No class";
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(row);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHeader
        title="Absentees"
        subtitle="Today's absent students with parent contact — for manual follow-up calls."
      />

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
          aria-label="Date"
        />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print list
        </Button>
        <Button
          variant="outline"
          onClick={() => downloadCsv("/api/export/attendance.csv", "attendance.csv")}
        >
          <Download className="mr-2 h-4 w-4" /> Attendance CSV
        </Button>
        <Button variant="outline" onClick={() => downloadCsv("/api/export/fees.csv", "fees.csv")}>
          <Download className="mr-2 h-4 w-4" /> Fees CSV
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {isError && (
        <p className="text-destructive">
          Couldn't load the absentee list. Check your connection and try again.
        </p>
      )}

      {data && data.count === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No students marked absent on {data.date}. If teachers are still marking, this list
            refreshes automatically every minute.
          </CardContent>
        </Card>
      )}

      {data && data.count > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.count} student{data.count === 1 ? "" : "s"} absent on {data.date}
          </p>
          {[...byClass.entries()].map(([className, rows]) => (
            <Card key={className}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {className} — {rows.length} absent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {rows.map((r) => (
                    <li key={r.studentId} className="flex items-center justify-between gap-3 py-2">
                      <div>
                        <span className="font-medium">{r.studentName}</span>
                        {r.note && (
                          <span className="ml-2 text-sm text-muted-foreground">({r.note})</span>
                        )}
                      </div>
                      {r.parentPhone ? (
                        <a
                          href={`tel:${r.parentPhone.replace(/[^+\d]/g, "")}`}
                          className="-my-1 flex min-h-11 items-center gap-1 rounded-md px-3 text-sm text-primary hover:bg-accent hover:underline"
                        >
                          <Phone className="h-4 w-4" /> {r.parentPhone}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">no phone on file</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
