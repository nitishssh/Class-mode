/**
 * Design-token drift check: this app's palette against ClassMode Studio's.
 *
 * `client/src/index.css` and Studio's `app/globals.css` are two hand-maintained
 * copies of one palette. DESIGN.md (in Studio) is the spec both answer to. There
 * was no mechanism connecting them, and by 2026-09-01 they had drifted far
 * enough that this app shipped two contrast failures Studio had already fixed
 * (dark `--progress` at 3.12:1, dark `--not-yet` at 3.61:1) and was missing
 * `--verified` / `--overdue` entirely — the two tokens DESIGN.md's Interaction
 * States table assigns to the registers, which exist only in this repo.
 *
 * Unlike `check-study-arena-drift.ts`, this is NOT a hash check. A byte-diff
 * between the two stylesheets is meaningless: they use different token names for
 * the same colour, and the divergence between them is partly DELIBERATE. So this
 * compares resolved token VALUES against a manifest that states which tokens
 * must match, which this app deliberately does not inherit, and why.
 *
 *   npm run check:design-tokens-drift
 *
 * Source resolution (first match wins):
 *   1. $CLASSMODE_STUDIO_REPO   — a local ClassMode Studio checkout
 *   2. .classmode-studio-repo   — gitignored, one line, this machine's path
 *   3. raw.githubusercontent.com at STUDIO_REF
 *
 * Unlike OpenMAIC, classmode-studio is PRIVATE, so route 3 needs credentials:
 * set $STUDIO_REPO_TOKEN to a token with read access to it. CI does this from a
 * repository secret. Without a token the fetch 404s — indistinguishable from a
 * deleted file — so this check says so plainly rather than reporting drift it
 * cannot actually see.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LOCAL_CSS = path.join(ROOT, "client/src/index.css");
const STUDIO_CSS = "app/globals.css";
const STUDIO_REPO = "https://github.com/NitishKumar-ai/classmode-studio";
const STUDIO_REF = "main";

/**
 * Tokens that MUST carry the same value in both stylesheets, in both themes.
 * `[here, there]` where the names differ: this app calls the terracotta
 * `--accent` (its shadcn hover background was renamed `--accent-base` to free
 * the name), while Studio calls it `--brand-accent` and keeps shadcn's
 * `--accent` as-is. Same colour, same meaning, different spelling — the single
 * most likely source of a silent mismatch, so it is stated rather than assumed.
 */
const MIRRORED: ReadonlyArray<readonly [string, string]> = [
  ["--cream-50", "--cream-50"],
  ["--cream-100", "--cream-100"],
  ["--cream-150", "--cream-150"],
  ["--cream-200", "--cream-200"],
  ["--cream-300", "--cream-300"],
  ["--cream-400", "--cream-400"],
  ["--ink-900", "--ink-900"],
  ["--ink-600", "--ink-600"],
  ["--ink-400", "--ink-400"],
  ["--accent", "--brand-accent"],
  ["--accent-hover", "--brand-accent-hover"],
  ["--accent-soft", "--brand-accent-soft"],
  ["--terracotta-ink", "--terracotta-ink"],
  ["--energy", "--energy"],
  ["--energy-soft", "--energy-soft"],
  ["--energy-dark", "--energy-dark"],
  ["--progress", "--progress"],
  ["--progress-soft", "--progress-soft"],
  ["--not-yet", "--not-yet"],
  ["--verified", "--verified"],
  ["--overdue", "--overdue"],
];

/**
 * Tokens this app deliberately does NOT inherit. DESIGN.md: "This app inherits
 * the paper, the margin rule and the mono numerals. It does NOT inherit Studio's
 * slate gate inversion. That reservation is what lets one system cover both an
 * authoring tool and an attendance register."
 *
 * Checked as an assertion, not a comment: a well-meaning future sync that copies
 * Studio's whole `:root` wholesale would quietly import the gate into a fees
 * register, and nothing else would catch it.
 */
const NOT_INHERITED = [
  "--gate-surface",
  "--gate-ink",
  "--gate-muted",
  "--gate-placeholder",
  "--gate-outline",
  "--slate",
];

type Theme = "light" | "dark";
type Tokens = Record<Theme, Map<string, string>>;

/**
 * Pull `--token: value;` declarations out of a stylesheet, split by theme.
 *
 * Deliberately a regex scan rather than a CSS parse: both files nest their token
 * blocks differently (this app wraps `:root` in `@layer base`, Studio does not),
 * and the check only needs flat declarations. Comments are stripped first, so a
 * value quoted inside a `/* ... *\/` explanation is not mistaken for a real one —
 * both files carry contrast measurements in prose next to the values they
 * describe.
 */
function extractTokens(css: string): Tokens {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const light = new Map<string, string>();
  const dark = new Map<string, string>();

  // Find each theme's block by its selector, then take declarations until the
  // brace depth returns to where it started.
  for (const [theme, selector] of [
    ["light", /(^|\})\s*:root\s*\{/gm],
    ["dark", /(^|\})\s*(?:\.dark|:root:is\(\.dark\))\s*\{/gm],
  ] as const) {
    const target = theme === "light" ? light : dark;
    for (const match of stripped.matchAll(selector)) {
      const start = match.index + match[0].length;
      let depth = 1;
      let i = start;
      while (i < stripped.length && depth > 0) {
        if (stripped[i] === "{") depth += 1;
        else if (stripped[i] === "}") depth -= 1;
        i += 1;
      }
      const body = stripped.slice(start, i - 1);
      for (const decl of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)[;}]/g)) {
        target.set(decl[1], decl[2].trim());
      }
    }
  }
  return { light, dark };
}

/**
 * Reduce a token value to a canonical `#rrggbb` so the two files can be compared
 * by COLOUR rather than by spelling. They deliberately store the same palette in
 * different formats: this app keeps bare RGB channels (`240 165 0`) because
 * Tailwind must inject an alpha into them, while Studio runs Tailwind v4 and
 * keeps whole hex values. Comparing the raw strings would report every token as
 * drifted, and the check would be useless.
 *
 * Returns the input lowercased when it is neither form, so an unexpected value
 * still surfaces as a mismatch instead of being silently normalised away.
 */
function canonical(value: string): string {
  const v = value.trim().toLowerCase();
  const long = /^#([0-9a-f]{6})$/.exec(v);
  if (long) return `#${long[1]}`;
  const short = /^#([0-9a-f]{3})$/.exec(v);
  if (short) return `#${[...short[1]].map((c) => c + c).join("")}`;
  const channels = /^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/.exec(v);
  if (channels) {
    const parts = channels.slice(1, 4).map(Number);
    if (parts.every((n) => n <= 255)) {
      return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
    }
  }
  return v;
}

/** Resolve `var(--x)` chains within one theme so the two files can be compared by colour. */
function resolve(
  tokens: Map<string, string>,
  name: string,
  seen = new Set<string>()
): string | undefined {
  const raw = tokens.get(name);
  if (raw === undefined || seen.has(name)) return raw;
  const via = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
  if (!via) return canonical(raw);
  seen.add(name);
  return resolve(tokens, via[1], seen);
}

/**
 * A dark block legitimately omits a token it does not override — the light value
 * still applies through the cascade. So a dark lookup falls back to light before
 * being called missing.
 */
function valueOf(tokens: Tokens, theme: Theme, name: string): string | undefined {
  return (
    resolve(tokens[theme], name) ?? (theme === "dark" ? resolve(tokens.light, name) : undefined)
  );
}

function resolveLocalRepo(): { dir: string; source: string } | null {
  let candidate: string | undefined;
  let source: string;

  if (process.env.CLASSMODE_STUDIO_REPO) {
    candidate = process.env.CLASSMODE_STUDIO_REPO;
    source = "$CLASSMODE_STUDIO_REPO";
  } else {
    const pointer = path.join(ROOT, ".classmode-studio-repo");
    if (!fs.existsSync(pointer)) return null;
    candidate = fs
      .readFileSync(pointer, "utf8")
      .split("\n")
      .map((line) => line.replace(/#.*/, "").trim())
      .find((line) => line.length > 0);
    source = ".classmode-studio-repo";
  }

  if (!candidate) return null;
  const dir = candidate.startsWith("~")
    ? path.join(process.env.HOME ?? "", candidate.slice(1))
    : candidate;

  if (!fs.existsSync(dir)) {
    throw new Error(`ClassMode Studio repo not found at ${dir} (from ${source})`);
  }
  // A stale or partial directory can sit at this path and look correct.
  if (!fs.existsSync(path.join(dir, STUDIO_CSS))) {
    throw new Error(
      `${dir} (from ${source}) has no ${STUDIO_CSS} — that is not a Studio checkout.`
    );
  }
  return { dir, source };
}

async function readStudioCss(): Promise<{ css: string; label: string }> {
  const local = resolveLocalRepo();
  if (local) {
    return {
      css: fs.readFileSync(path.join(local.dir, STUDIO_CSS), "utf8"),
      label: `${local.dir}/${STUDIO_CSS} (from ${local.source})`,
    };
  }
  const slug = new URL(STUDIO_REPO).pathname.replace(/^\/|\/$/g, "");
  const url = `https://raw.githubusercontent.com/${slug}/${STUDIO_REF}/${STUDIO_CSS}`;
  const token = process.env.STUDIO_REPO_TOKEN;
  const res = await fetch(
    url,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
  );

  if (res.status === 404) {
    // classmode-studio is private, so an unauthenticated read of a file that
    // certainly exists comes back 404, not 401. Reporting "missing upstream"
    // here would be a lie; say what is actually wrong.
    throw new Error(
      `cannot read ${STUDIO_CSS} from ${STUDIO_REPO} (404).\n` +
        (token
          ? `       $STUDIO_REPO_TOKEN is set but lacks read access to that repo, or ${STUDIO_REF} has no ${STUDIO_CSS}.`
          : `       That repo is private and no $STUDIO_REPO_TOKEN was given.\n` +
            `       Set one, or point at a local checkout: see .classmode-studio-repo.example.`)
    );
  }
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  return { css: await res.text(), label: `${url} @ ${STUDIO_REF}` };
}

async function main() {
  const { css: studioCss, label } = await readStudioCss();
  const here = extractTokens(fs.readFileSync(LOCAL_CSS, "utf8"));
  const there = extractTokens(studioCss);

  console.log(`Comparing client/src/index.css against ${label}\n`);

  const problems: string[] = [];
  let matched = 0;

  for (const [ours, theirs] of MIRRORED) {
    for (const theme of ["light", "dark"] as const) {
      const mine = valueOf(here, theme, ours);
      const yours = valueOf(there, theme, theirs);
      const name = ours === theirs ? ours : `${ours} (Studio: ${theirs})`;

      if (yours === undefined) {
        problems.push(
          `  ABSENT UPSTREAM  ${theme.padEnd(5)} ${name} — not in Studio; drop it here or add it there`
        );
      } else if (mine === undefined) {
        problems.push(
          `  MISSING          ${theme.padEnd(5)} ${name} — Studio has ${yours}, this file has no value`
        );
      } else if (mine !== yours) {
        problems.push(
          `  DRIFTED          ${theme.padEnd(5)} ${name} — here ${mine}, Studio ${yours}`
        );
      } else {
        matched += 1;
      }
    }
  }

  for (const token of NOT_INHERITED) {
    for (const theme of ["light", "dark"] as const) {
      if (here[theme].has(token)) {
        problems.push(
          `  NOT INHERITED    ${theme.padEnd(5)} ${token} — the gate inversion is Studio-only; this app must not carry it`
        );
      }
    }
  }

  if (problems.length === 0) {
    console.log(
      `${matched} token values match across both themes; the gate family is correctly absent.`
    );
    return;
  }

  for (const problem of problems) console.log(problem);
  console.log("");
  console.error(
    `::error::Design tokens have drifted from ClassMode Studio: ${problems.length} problem(s).`
  );
  console.error(
    `The spec is DESIGN.md in ${STUDIO_REPO}. Decide per token: adopt Studio's value here,\n` +
      `fix it there, or — if this app deliberately diverges — say so in scripts/check-design-tokens-drift.ts.`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
