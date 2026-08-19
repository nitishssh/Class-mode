import { describe, it, expect } from "vitest";
import express from "express";
import helmet from "helmet";
import request from "supertest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { productionCspDirectives } from "../lib/security/csp";
import { CONFETTI_GLOBAL_OPTIONS } from "../../client/src/lib/confetti-options";

/**
 * Pins the #324.4 decision.
 *
 * The QA report proposed fixing the blocked confetti worker with
 * `worker-src 'self' blob:`. We deliberately did the opposite: keep the policy
 * tight and stop requesting the worker. A `blob:` worker source would let any
 * XSS execute attacker-supplied code in a worker — a real downgrade bought for
 * a decorative animation that already falls back to the main thread.
 *
 * Both halves can silently regress: someone adds `blob:` "to fix the console
 * warning", or a new component imports canvas-confetti directly and reinstates
 * the default `useWorker: true`.
 *
 * These assert the EMITTED header rather than the source text. A grep for
 * `workerSrc:` proves only that a literal appears — it cannot catch a key
 * helmet no longer honours, which would leave the directive silently absent
 * while the guard still passed.
 */

const CLIENT_SRC = path.resolve(process.cwd(), "client/src");
const WRAPPER = path.join(CLIENT_SRC, "lib/confetti.ts");

/** The CSP header production actually sends. */
async function cspHeader(): Promise<string> {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: { directives: { ...productionCspDirectives } } }));
  app.get("/", (_req, res) => res.status(200).send("ok"));
  const res = await request(app).get("/");
  return res.headers["content-security-policy"] ?? "";
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("#324.4 — worker policy stays tight", () => {
  it("emits a worker-src directive", async () => {
    expect(await cspHeader()).toMatch(/worker-src\s/);
  });

  it("never allows blob: as a worker source", async () => {
    const header = await cspHeader();
    const workerSrc = /worker-src ([^;]*)/.exec(header);
    expect(workerSrc, `no worker-src in emitted header: ${header}`).not.toBeNull();
    expect(
      workerSrc![1],
      "blob: in worker-src lets an XSS run attacker-supplied code in a worker — see client/src/lib/confetti.ts"
    ).not.toContain("blob:");
  });

  it("still declares every directive the policy had before the extraction", () => {
    // Asserted against OUR object, not the emitted header, and deliberately so.
    // helmet runs with useDefaults: true, so it backfills its own defaults for
    // anything we omit — a header-based check here passes even when our config
    // has dropped the key, which is false assurance. Verified: deleting
    // upgradeInsecureRequests from the module left the emitted header
    // unchanged. Only directives helmet has NO default for (worker-src) can be
    // meaningfully asserted from the header.
    expect(Object.keys(productionCspDirectives).sort()).toEqual(
      [
        "connectSrc",
        "defaultSrc",
        "fontSrc",
        "imgSrc",
        "objectSrc",
        "scriptSrc",
        "styleSrc",
        "upgradeInsecureRequests",
        "workerSrc",
      ].sort()
    );
  });

  it("keeps the data: font source that #324.5 added", () => {
    // Also asserted against our object: helmet's default font-src is
    // "'self' https: data:", so a header check here would pass on the default
    // even if we dropped data: ourselves.
    expect(productionCspDirectives.fontSrc).toContain("data:");
  });

  it("asks canvas-confetti for no worker", () => {
    // The import guard below proves nobody bypasses the wrapper. This proves
    // the wrapper itself still asks for the worker-free config — without it,
    // flipping useWorker back to true inside the wrapper passes every test and
    // silently restores the blocked-worker console error in production.
    expect(CONFETTI_GLOBAL_OPTIONS.useWorker).toBe(false);
  });

  it("routes every confetti caller through the worker-free wrapper", () => {
    const offenders = walk(CLIENT_SRC)
      .filter((file) => path.resolve(file) !== WRAPPER)
      .filter((file) => /from\s+["']canvas-confetti["']/.test(readFileSync(file, "utf8")))
      .map((file) => path.relative(process.cwd(), file));

    expect(
      offenders,
      `import from "@/lib/confetti" instead — a direct import restores canvas-confetti's ` +
        `default useWorker: true, which the CSP blocks. Offenders: ${offenders.join(", ")}`
    ).toEqual([]);
  });
});
