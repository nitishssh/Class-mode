/**
 * StudioGenerationPanel
 *
 * Generates a lesson through ClassMode Studio, via the `/api/classmode-ai`
 * proxy. This is a SEPARATE path from the legacy in-process generator on this
 * page (`/api/ai-classroom/create`), which keeps its own SSE flow — the two are
 * deliberately not merged, so neither can break the other.
 *
 * Honesty rules this component follows:
 *   - No workspace in scope → a blocked state and nothing else. Never content.
 *   - Studio unavailable → say so; do not offer a button that cannot work.
 *   - Progress shown is the job's own reported progress, never a fake animation.
 */

import { AlertCircle, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useClassModeAIGeneration, useClassModeAIHealth } from "@/hooks/use-classmode-ai";

export function StudioGenerationPanel() {
  const [requirement, setRequirement] = useState("");
  const health = useClassModeAIHealth();
  const generation = useClassModeAIGeneration();

  const { job } = generation;
  const available = health.data?.available === true;

  // Tenant isolation: without a workspace nothing may be fetched or rendered.
  if (generation.isWorkspaceBlocked) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Studio generation unavailable</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No active workspace</AlertTitle>
            <AlertDescription>
              Lesson generation is scoped to a school. Select a workspace to continue.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const submit = () => {
    const trimmed = requirement.trim();
    if (!trimmed) return;
    generation.start({ requirement: trimmed });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Generate with ClassMode Studio
        </CardTitle>
        <CardDescription>
          Describe the lesson. Studio builds the scenes, quizzes, and whiteboard content.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {health.isLoading ? (
          <p className="text-sm text-muted-foreground">Checking availability…</p>
        ) : !available ? (
          // Honest empty state — the integration is not configured or reachable.
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Studio is not connected</AlertTitle>
            <AlertDescription>
              This server has no ClassMode Studio backend configured, so lesson generation is
              unavailable here.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="e.g. Teach photosynthesis to grade 7, with a diagram and a short quiz."
              rows={4}
              disabled={generation.isRunning}
            />

            <div className="flex items-center gap-2">
              <Button onClick={submit} disabled={generation.isRunning || !requirement.trim()}>
                {generation.isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  "Generate lesson"
                )}
              </Button>

              {generation.isRunning && (
                <Button variant="outline" onClick={generation.cancel}>
                  Cancel
                </Button>
              )}

              {job && !generation.isRunning && (
                <Button variant="ghost" onClick={generation.reset}>
                  Start another
                </Button>
              )}
            </div>

            {job && (
              <div className="space-y-2">
                {/* The job's own progress value — not a simulated one. */}
                <Progress value={job.progress} />
                <p className="text-sm text-muted-foreground">
                  {job.status}
                  {job.step ? ` · ${job.step}` : ""}
                  {job.message ? ` · ${job.message}` : ""}
                  {typeof job.scenesGenerated === "number" && typeof job.totalScenes === "number"
                    ? ` · ${job.scenesGenerated}/${job.totalScenes} scenes`
                    : ""}
                </p>
              </div>
            )}

            {job?.status === "succeeded" && job.result && (
              <Alert>
                <AlertTitle>Lesson ready</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  {job.result.scenesCount} scenes generated.
                  <a
                    href={job.result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline"
                  >
                    Open lesson <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}

            {/* Studio reports failure through the job, not as a transport error. */}
            {job?.status === "failed" && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Generation failed</AlertTitle>
                <AlertDescription>{job.error || "Studio could not generate this lesson."}</AlertDescription>
              </Alert>
            )}

            {generation.error && !generation.isWorkspaceBlocked && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Request failed</AlertTitle>
                <AlertDescription>{generation.error.message}</AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
