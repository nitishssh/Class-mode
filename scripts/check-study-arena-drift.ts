/**
 * Study Arena upstream-drift check.
 *
 * `server/services/study-arena/` is a HAND PORT of OpenMAIC (MIT) — see
 * docs/OpenMAIC-ATTRIBUTION.md. Unlike `shared/` -> `classmode-mobile/src/shared/`,
 * it is NOT a generated copy, so a byte-diff between the two trees is
 * meaningless: the port was deliberately simplified and re-pedagogised.
 *
 * What this script detects instead is UPSTREAM MOVEMENT: has the OpenMAIC file
 * a given port was derived from changed since we last reviewed it? That is the
 * question a silent fork can't otherwise answer. Without it, upstream fixes and
 * re-architectures land invisibly — which is exactly what happened between the
 * May port and today (upstream rewrote the director topology and extracted
 * lib/generation/ into packages/@openmaic/generation/).
 *
 * A CHANGED file is not automatically a bug. It is a prompt to read the upstream
 * diff and decide: port it, or record that we deliberately diverge. Either way,
 * re-baseline with --update so the next run is quiet again.
 *
 *   npm run check:study-arena-drift              check against the pinned ref
 *   npm run check:study-arena-drift -- --update  re-baseline after reviewing
 *
 * Source resolution (first match wins):
 *   1. $OPENMAIC_REPO         — a local OpenMAIC checkout
 *   2. .openmaic-repo         — gitignored, one line, this machine's path
 *   3. raw.githubusercontent.com at the lockfile's `ref` (needs network)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LOCK_PATH = path.join(ROOT, "server/services/study-arena/UPSTREAM.lock.json");

interface TrackedFile {
  sha256: string;
  /** Class-mode file(s) derived from this upstream source. */
  portedTo: string[];
}

interface Lockfile {
  upstream: string;
  ref: string;
  reviewedAt: string;
  note: string;
  files: Record<string, TrackedFile>;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Resolve a local OpenMAIC checkout, or null to fall back to the network. */
function resolveLocalRepo(): { dir: string; source: string } | null {
  let candidate: string | undefined;
  let source: string;

  if (process.env.OPENMAIC_REPO) {
    candidate = process.env.OPENMAIC_REPO;
    source = "$OPENMAIC_REPO";
  } else {
    const pointer = path.join(ROOT, ".openmaic-repo");
    if (!fs.existsSync(pointer)) return null;
    candidate = fs
      .readFileSync(pointer, "utf8")
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim())
      .find((line) => line.length > 0);
    source = ".openmaic-repo";
  }

  if (!candidate) return null;
  const dir = candidate.startsWith("~")
    ? path.join(process.env.HOME ?? "", candidate.slice(1))
    : candidate;

  if (!fs.existsSync(dir)) {
    throw new Error(`OpenMAIC repo not found at ${dir} (from ${source})`);
  }
  // A stale or partial directory can sit at this path and look correct.
  // lib/orchestration/ is the tree this check exists to watch.
  if (!fs.existsSync(path.join(dir, "lib/orchestration"))) {
    throw new Error(
      `${dir} (from ${source}) has no lib/orchestration/ — that is not an OpenMAIC checkout.`
    );
  }
  return { dir, source };
}

type Fetcher = (relPath: string) => Promise<string | null>;

function localFetcher(dir: string): Fetcher {
  return async (relPath) => {
    const full = path.join(dir, relPath);
    return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
  };
}

function remoteFetcher(upstream: string, ref: string): Fetcher {
  const slug = new URL(upstream).pathname.replace(/^\/|\/$/g, "");
  return async (relPath) => {
    const url = `https://raw.githubusercontent.com/${slug}/${ref}/${relPath}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
    return res.text();
  };
}

async function main() {
  const update = process.argv.includes("--update");

  if (!fs.existsSync(LOCK_PATH)) {
    console.error(`error: lockfile not found at ${path.relative(ROOT, LOCK_PATH)}`);
    process.exit(1);
  }
  const lock: Lockfile = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8"));

  // Every portedTo target must still exist. Without this the lockfile rots
  // silently in the one direction nobody watches: when a port is DELETED here,
  // its upstream entries stay behind and keep reporting on a file we no longer
  // carry. That is what happened to the eight entries pointing at
  // study-arena/generator.ts — deleted in 08c13e5, still watched for weeks,
  // until upstream touched one and the check asked for a port into a file that
  // was not there. Drift in the tracked files is news; a target that has
  // vanished is a bookkeeping error, so it fails separately and says so.
  const orphaned = Object.entries(lock.files).flatMap(([relPath, entry]) =>
    entry.portedTo
      .filter((target) => !fs.existsSync(path.join(ROOT, target)))
      .map((target) => `  ${relPath}\n    -> ${target}`)
  );
  if (orphaned.length > 0) {
    console.error(
      `::error::${orphaned.length} lockfile entr${orphaned.length === 1 ? "y names a portedTo target" : "ies name portedTo targets"} that no longer exist:`
    );
    console.error(orphaned.join("\n"));
    console.error(
      `\nThe port was moved or retired without updating the lockfile. Repoint the\n` +
        `entry at its successor, or drop it if this repo no longer carries the port.`
    );
    process.exit(1);
  }

  let fetcher: Fetcher;
  let sourceLabel: string;
  const local = resolveLocalRepo();
  if (local) {
    fetcher = localFetcher(local.dir);
    sourceLabel = `${local.dir} (from ${local.source})`;
  } else {
    fetcher = remoteFetcher(lock.upstream, lock.ref);
    sourceLabel = `${lock.upstream} @ ${lock.ref}`;
  }

  console.log(`Study Arena upstream check`);
  console.log(`  source:     ${sourceLabel}`);
  console.log(`  baseline:   ${lock.reviewedAt} (${Object.keys(lock.files).length} files)\n`);

  const changed: string[] = [];
  const missing: string[] = [];
  const unchanged: string[] = [];

  for (const [relPath, entry] of Object.entries(lock.files)) {
    const content = await fetcher(relPath);
    if (content === null) {
      missing.push(relPath);
      continue;
    }
    const digest = sha256(content);
    if (digest === entry.sha256) {
      unchanged.push(relPath);
    } else {
      changed.push(relPath);
      if (update) entry.sha256 = digest;
    }
  }

  for (const relPath of unchanged) console.log(`  ok       ${relPath}`);
  for (const relPath of changed) {
    console.log(`  CHANGED  ${relPath}`);
    for (const target of lock.files[relPath].portedTo) console.log(`             -> ${target}`);
  }
  for (const relPath of missing) {
    console.log(`  MISSING  ${relPath}  (moved or deleted upstream)`);
    for (const target of lock.files[relPath].portedTo) console.log(`             -> ${target}`);
  }

  if (update) {
    lock.reviewedAt = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
    console.log(`\nRe-baselined ${changed.length} file(s); reviewedAt = ${lock.reviewedAt}.`);
    if (missing.length > 0) {
      console.log(
        `${missing.length} file(s) are still MISSING — fix their paths in the lockfile by hand.`
      );
    }
    return;
  }

  console.log("");
  if (changed.length === 0 && missing.length === 0) {
    console.log(`No upstream movement since ${lock.reviewedAt}.`);
    return;
  }

  console.error(
    `::error::Study Arena upstream has moved: ${changed.length} changed, ${missing.length} missing.`
  );
  console.error(
    `Review the upstream diff, port or consciously reject each change, then re-baseline:\n` +
      `  npm run check:study-arena-drift -- --update`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
