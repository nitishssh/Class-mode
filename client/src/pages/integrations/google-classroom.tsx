import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Users,
  Download,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StatusResponse {
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
}

interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  enrollmentCode?: string;
  courseState?: string;
}

interface ImportResult {
  courseId: string;
  workspaceId: number;
  totalStudents: number;
  created: number;
  existing: number;
  skipped: number;
  failures: Array<{ email: string | null; reason: string }>;
}

export default function GoogleClassroomIntegration() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [location] = useLocation();
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);

  // Show a toast if we just came back from the OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      toast({ title: "Connected", description: "Google Classroom linked successfully." });
      // Clean up the URL so a refresh doesn't re-fire the toast
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("error")) {
      toast({
        title: "Connection failed",
        description: "We couldn't link Google Classroom. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location, toast]);

  const status = useQuery<StatusResponse>({
    queryKey: ["/api/lms/google/status"],
  });

  const courses = useQuery<{ courses: ClassroomCourse[] }>({
    queryKey: ["/api/lms/google/courses"],
    enabled: !!status.data?.connected,
    retry: false,
  });

  const importMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const res = await apiRequest("POST", `/api/lms/google/courses/${courseId}/import`);
      return (await res.json()) as ImportResult;
    },
    onSuccess: (result) => {
      setLastImport(result);
      toast({
        title: "Roster imported",
        description: `${result.created} new + ${result.existing} existing students linked to your workspace.`,
      });
      qc.invalidateQueries({ queryKey: ["/api/educator/students"] });
    },
    onError: (err: any) => {
      toast({
        title: "Import failed",
        description: err?.message ?? "Could not import the roster.",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    // Server-side OAuth: redirect the browser so the session cookie is on the call.
    window.location.href = "/api/lms/google/auth";
  };

  // ── States ────────────────────────────────────────────────────────────────

  if (status.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status.data?.configured) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Google Classroom"
          subtitle="Import your existing classes and rosters from Google Classroom."
        />
        <div className="mx-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <AlertCircle className="h-5 w-5" /> Integration not configured
          </h3>
          <p className="mt-2 text-sm">
            The server doesn't have Google Classroom OAuth credentials. Set{" "}
            <code className="rounded bg-amber-100 px-1">GOOGLE_CLASSROOM_CLIENT_ID</code> and{" "}
            <code className="rounded bg-amber-100 px-1">GOOGLE_CLASSROOM_CLIENT_SECRET</code> in the
            server environment and restart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Classroom"
        subtitle="Import your existing classes and rosters in one click."
      >
        {status.data.connected ? (
          <Button variant="outline" onClick={handleConnect}>
            <RefreshCw className="mr-2 h-4 w-4" /> Re-connect
          </Button>
        ) : (
          <Button onClick={handleConnect}>
            <ExternalLink className="mr-2 h-4 w-4" /> Connect Google Classroom
          </Button>
        )}
      </PageHeader>

      {!status.data.connected ? (
        <div className="mx-4 rounded-lg border bg-card p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-lg font-semibold">Connect your Google account</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            We'll list your active Google Classroom courses so you can import students into Class
            Mode without sending invite links.
          </p>
          <Button className="mt-5" onClick={handleConnect}>
            <ExternalLink className="mr-2 h-4 w-4" /> Connect Google Classroom
          </Button>
        </div>
      ) : (
        <div className="space-y-4 px-4">
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            Connected
            {status.data.connectedAt && (
              <span className="text-muted-foreground">
                · linked {new Date(status.data.connectedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {courses.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading your Classroom courses…
            </div>
          )}

          {courses.isError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              Could not load courses. Try re-connecting.
            </div>
          )}

          {courses.data?.courses?.length === 0 && (
            <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              No active Google Classroom courses on this account.
            </div>
          )}

          <div className="space-y-2">
            {courses.data?.courses?.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.section && <div className="text-xs text-muted-foreground">{c.section}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {c.courseState && <Badge variant="outline">{c.courseState}</Badge>}
                  <Button
                    size="sm"
                    disabled={importMutation.isPending}
                    onClick={() => importMutation.mutate(c.id)}
                  >
                    {importMutation.isPending && importMutation.variables === c.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing…
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" /> Import roster
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {lastImport && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <div className="font-semibold">Last import</div>
              <ul className="mt-1 list-inside list-disc">
                <li>Total students: {lastImport.totalStudents}</li>
                <li>New accounts created: {lastImport.created}</li>
                <li>Already in your workspace: {lastImport.existing}</li>
                {lastImport.skipped > 0 && (
                  <li>Skipped (no email on profile): {lastImport.skipped}</li>
                )}
                {lastImport.failures.length > 0 && <li>Failed: {lastImport.failures.length}</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
