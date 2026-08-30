import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  ClassModeAIError,
  cancelGenerationJob,
  createGenerationJob,
  fetchClassModeAIHealth,
  fetchGenerationJob,
  isTerminal,
} from "./classmode-ai";

const fetchMock = vi.fn();

function res(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const validJob = { id: "job_1", status: "running", progress: 42 };

describe("classmode-ai client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("posts a generation job to the proxy and returns the parsed job", async () => {
    fetchMock.mockResolvedValue(res(202, { job: validJob }));

    const job = await createGenerationJob({ requirement: "Teach photosynthesis" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/classmode-ai/generation-jobs");
    expect(init.method).toBe("POST");
    // Cookie-based session must be sent — the proxy scopes on the session.
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({ requirement: "Teach photosynthesis" });
    expect(job).toEqual(validJob);
  });

  it("url-encodes the job id so a crafted id cannot escape the path", async () => {
    fetchMock.mockResolvedValue(res(200, { job: validJob }));

    await fetchGenerationJob("../../admin");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/classmode-ai/generation-jobs/..%2F..%2Fadmin"
    );
  });

  it("cancels via DELETE", async () => {
    fetchMock.mockResolvedValue(res(200, { job: { ...validJob, status: "cancelled" } }));

    const job = await cancelGenerationJob("job_1");

    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    expect(job.status).toBe("cancelled");
  });

  it("flags a missing workspace as blocked rather than a generic failure", async () => {
    fetchMock.mockResolvedValue(res(409, { message: "No active workspace" }));

    const err = await createGenerationJob({ requirement: "x" }).catch((e) => e);

    expect(err).toBeInstanceOf(ClassModeAIError);
    expect(err.isWorkspaceBlocked).toBe(true);
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("No active workspace");
  });

  it("preserves the structured error envelope from the proxy", async () => {
    fetchMock.mockResolvedValue(
      res(503, {
        message: "ClassMode AI is not configured",
        code: "SERVICE_UNAVAILABLE",
        requestId: "req_9",
        retryable: true,
      })
    );

    const err = await fetchGenerationJob("job_1").catch((e) => e);

    expect(err.code).toBe("SERVICE_UNAVAILABLE");
    expect(err.requestId).toBe("req_9");
    expect(err.retryable).toBe(true);
    expect(err.isWorkspaceBlocked).toBe(false);
  });

  it("does not throw a SyntaxError when the body is an HTML error page", async () => {
    fetchMock.mockResolvedValue(res(502, "<html>Bad Gateway</html>"));

    const err = await fetchGenerationJob("job_1").catch((e) => e);

    expect(err).toBeInstanceOf(ClassModeAIError);
    expect(err.status).toBe(502);
  });

  it("rejects a job whose shape violates the shared contract", async () => {
    // progress is required by classModeAIJobSchema; a drifted server omitting it
    // must fail loudly at the boundary, not surface as undefined in a render.
    fetchMock.mockResolvedValue(res(200, { job: { id: "j", status: "running" } }));

    const err = await fetchGenerationJob("j").catch((e) => e);

    expect(err).toBeInstanceOf(ClassModeAIError);
    expect(err.message).toMatch(/unexpected shape/);
  });

  it("reports unavailable instead of throwing when the route is not deployed", async () => {
    fetchMock.mockResolvedValue(res(404, { message: "API route not found" }));

    await expect(fetchClassModeAIHealth()).resolves.toEqual({
      service: "classmode-ai",
      available: false,
    });
  });

  it("treats done and terminal statuses as final", () => {
    expect(isTerminal({ id: "a", status: "running", progress: 10 })).toBe(false);
    expect(isTerminal({ id: "a", status: "succeeded", progress: 100 })).toBe(true);
    expect(isTerminal({ id: "a", status: "cancelled", progress: 5 })).toBe(true);
    // `done` wins even if the status has not caught up.
    expect(isTerminal({ id: "a", status: "running", progress: 99, done: true })).toBe(true);
  });
});
