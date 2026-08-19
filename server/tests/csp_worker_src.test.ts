import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

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
 * the default `useWorker: true`. These fail loudly if either happens.
 */

const SERVER_INDEX = path.resolve(process.cwd(), "server/index.ts");
const CLIENT_SRC = path.resolve(process.cwd(), "client/src");
const WRAPPER = path.join(CLIENT_SRC, "lib/confetti.ts");

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
  it("declares worker-src explicitly", () => {
    const src = readFileSync(SERVER_INDEX, "utf8");
    expect(src).toMatch(/workerSrc:\s*\[/);
  });

  it("never allows blob: as a worker source", () => {
    const src = readFileSync(SERVER_INDEX, "utf8");
    const directive = /workerSrc:\s*\[([^\]]*)\]/.exec(src);
    expect(directive, "workerSrc directive not found in server/index.ts").not.toBeNull();
    expect(
      directive![1],
      "blob: in worker-src lets an XSS run attacker-supplied code in a worker — see client/src/lib/confetti.ts"
    ).not.toContain("blob:");
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
