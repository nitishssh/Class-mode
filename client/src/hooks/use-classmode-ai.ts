/**
 * client/src/hooks/use-classmode-ai.ts
 *
 * React bindings for the ClassMode AI generation API.
 *
 * Generation is a long job, and the proxy exposes it as poll-a-job (unlike the
 * legacy /api/ai-classroom path, which streams over SSE). So this hook owns the
 * polling lifecycle: start a job, poll until terminal, stop.
 */

import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  cancelGenerationJob,
  createGenerationJob,
  fetchClassModeAIHealth,
  fetchGenerationJob,
  isTerminal,
  ClassModeAIError,
  type ClassModeAIJob,
} from "@/lib/classmode-ai";

/** How often to poll a running job. Generation takes minutes, not seconds. */
const POLL_INTERVAL_MS = 2000;

/**
 * Availability of the ClassMode AI integration.
 *
 * Kept deliberately cheap and non-throwing: an unconfigured or undeployed
 * integration reports `available: false` so the UI can say so plainly instead
 * of offering a button that cannot work.
 */
export function useClassModeAIHealth() {
  return useQuery({
    queryKey: ["classmode-ai", "health"],
    queryFn: fetchClassModeAIHealth,
    staleTime: 60_000,
    retry: false,
  });
}

export interface UseClassModeAIGeneration {
  /** The job being tracked, or null before one is started. */
  job: ClassModeAIJob | null;
  /** True from submit until the job reaches a terminal state. */
  isRunning: boolean;
  /** Set when the workspace is missing — render a blocked state, show nothing. */
  isWorkspaceBlocked: boolean;
  error: ClassModeAIError | Error | null;
  start: (input: { requirement: string; sourceText?: string }) => void;
  cancel: () => void;
  reset: () => void;
}

export function useClassModeAIGeneration(): UseClassModeAIGeneration {
  const [jobId, setJobId] = useState<string | null>(null);
  // Seeded from the create response so the UI has a status to show during the
  // gap before the first poll returns.
  const [job, setJob] = useState<ClassModeAIJob | null>(null);

  const create = useMutation({
    mutationFn: createGenerationJob,
    onSuccess: (created) => {
      setJob(created);
      setJobId(created.id);
    },
  });

  const poll = useQuery({
    queryKey: ["classmode-ai", "generation-job", jobId],
    queryFn: () => fetchGenerationJob(jobId as string),
    // Only polls while a job is live and unfinished; `false` stops the timer.
    enabled: Boolean(jobId) && !(job && isTerminal(job)),
    refetchInterval: (query) => {
      const latest = query.state.data as ClassModeAIJob | undefined;
      return latest && isTerminal(latest) ? false : POLL_INTERVAL_MS;
    },
    retry: false,
  });

  // The polled job is newer than the seeded one once it arrives.
  const current = poll.data ?? job;

  const cancelMutation = useMutation({
    mutationFn: () => cancelGenerationJob(jobId as string),
    onSuccess: (cancelled) => setJob(cancelled),
  });

  const reset = useCallback(() => {
    setJobId(null);
    setJob(null);
    create.reset();
    cancelMutation.reset();
  }, [create, cancelMutation]);

  const error = (create.error ?? poll.error ?? cancelMutation.error ?? null) as
    ClassModeAIError | Error | null;

  return {
    job: current ?? null,
    isRunning: create.isPending || Boolean(current && !isTerminal(current)),
    isWorkspaceBlocked: error instanceof ClassModeAIError && error.isWorkspaceBlocked,
    error,
    start: create.mutate,
    cancel: () => {
      if (jobId) cancelMutation.mutate();
    },
    reset,
  };
}
