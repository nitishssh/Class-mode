/**
 * Generate the native-readable entry stylesheet from the web one.
 *
 * `client/src/index.css` is the source of truth and stays that way: this script
 * only reads it. `check-design-tokens-drift.ts` keeps comparing that same file
 * against Studio's `app/globals.css`, unchanged.
 *
 * WHY THIS EXISTS
 *
 * NativeWind v4 builds its token registry from `:root` and from
 * `@media (prefers-color-scheme: dark)`. It does NOT read a `.dark { }` class
 * block. This app sets `darkMode: ["class"]` (tailwind.config.ts) and puts the
 * whole dark palette in `.dark { }` (client/src/index.css), because on the web
 * the theme is a user choice rather than an OS setting.
 *
 * Measured 2026-11-17 by compiling the real stylesheet with the real
 * tailwind.config.ts and feeding the result to `cssToReactNativeRuntime`
 * (react-native-css-interop 0.1.22, the engine under NativeWind 4.1.23):
 *
 *   index.css as-is        34 tokens registered,  0 with a dark value
 *   .dark rewritten @media 34 tokens registered, 33 with a dark value
 *
 * The `dark:` utilities compile either way. `dark:bg-progress` produces a valid
 * rule that, in the first case, resolves `--progress` to its LIGHT value. No
 * error, no warning. On device that is light-mode terracotta and green on dark
 * paper, the contrast failure recorded in CLAUDE.md (dark `--progress` at
 * 3.12:1, dark `--not-yet` at 3.61:1).
 *
 * WHY THIS EMITS A WHOLE STYLESHEET AND NOT A TOKEN FILE
 *
 * The first version of this script extracted the 73 tokens into a standalone
 * file. NativeWind registered 2 of them. It keeps a root variable only when
 * something in the same stylesheet references it, so a token file with no
 * utilities gets tree-shaken to nothing; the two survivors were `--accent` and
 * `--progress`, kept only because `--terracotta-ink` and `--verified` point at
 * them with `var()`.
 *
 * So the tokens have to sit in the stylesheet Tailwind compiles together with
 * the utilities. This script therefore copies the entire source and rewrites
 * exactly one thing: the `.dark { }` wrapper. Every other byte, including
 * comments and blank lines, is passed through untouched, and the output stays
 * line-for-line aligned with the source so `diff` shows only the wrapper.
 *
 * A consequence worth knowing: which tokens register is content-driven, like
 * any Tailwind build. `--verified`, `--not-yet`, `--overdue` and
 * `--terracotta-ink` do not appear in the 34 above because nothing in the
 * current web client uses `bg-verified`, `bg-not-yet`, `bg-overdue` or
 * `text-terracotta-ink`, so Tailwind never emits those utilities. They will
 * register as soon as a component uses them. That is tree-shaking, not the bug.
 *
 *   npm run gen:native-tokens      # write client/src/index.native.css
 *   npm run check:native-tokens    # fail if it is stale (CI)
 *
 * The filename is deliberate: Metro resolves platform suffixes, so an import of
 * `index.css` from the universal app should pick `index.native.css` on native
 * and `index.css` on web. NOT yet verified on a device, because this machine has
 * no Android SDK and no Xcode. The runtime half of the spike is still open: in
 * particular whether the runtime follows `--verified` -> `var(--progress)` and
 * whether `hsl()` renders from `38 29% 94%` style channels on native.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "client/src/index.css");
const OUTPUT = path.join(ROOT, "client/src/index.native.css");

const SOURCE_REL = path.relative(ROOT, SOURCE);
const OUTPUT_REL = path.relative(ROOT, OUTPUT);

const BANNER = [
  "/* GENERATED FILE - do not edit by hand.",
  ` * Source:      ${SOURCE_REL}`,
  " * Regenerate:  npm run gen:native-tokens",
  " * Verify:      npm run check:native-tokens",
  " *",
  " * Identical to the source except that its `.dark { }` block is wrapped as",
  " * `@media (prefers-color-scheme: dark) { :root { ... } }`, which is the only",
  " * form NativeWind reads tokens from. Edit the source, then regenerate.",
  " */",
].join("\n");

/**
 * Replace every comment with equal-length whitespace. Offsets into the result
 * map 1:1 onto the original, so we can locate structure on comment-free text
 * and then splice the original.
 */
function blankComments(css: string): string {
  let out = "";
  for (let i = 0; i < css.length; ) {
    if (css[i] === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      for (let j = i; j < stop; j++) out += css[j] === "\n" ? "\n" : " ";
      i = stop;
    } else {
      out += css[i];
      i++;
    }
  }
  return out;
}

/** Offsets of the `{` and its matching `}` for the first `.dark` ruleset. */
function darkBlockBraces(clean: string): { open: number; close: number } | null {
  const m = /(^|[\s}])\.dark\s*\{/m.exec(clean);
  if (!m) return null;
  const open = clean.indexOf("{", m.index);
  let depth = 0;
  for (let i = open; i < clean.length; i++) {
    if (clean[i] === "{") depth++;
    else if (clean[i] === "}") {
      depth--;
      if (depth === 0) return { open, close: i };
    }
  }
  return null;
}

/** Count of custom-property declarations, used only as an integrity check. */
function countCustomProps(css: string): number {
  return (blankComments(css).match(/(^|[;{\s])--[A-Za-z0-9_-]+\s*:/g) ?? []).length;
}

function fail(message: string): never {
  console.error(`gen-native-tokens: ${message}`);
  process.exit(1);
}

function build(): { content: string; props: number } {
  if (!fs.existsSync(SOURCE)) fail(`${SOURCE_REL} not found. Nothing was written.`);

  const source = fs.readFileSync(SOURCE, "utf8");
  const clean = blankComments(source);

  const braces = darkBlockBraces(clean);
  if (!braces) {
    fail(
      `no '.dark { }' ruleset in ${SOURCE_REL}. If dark mode moved to a media query, ` +
        `the source may already be native-readable and this script is obsolete.`,
    );
  }

  // Find the start of the `.dark` selector itself so the whole selector, not
  // just its brace, is replaced.
  const selectorStart = clean.lastIndexOf(".dark", braces.open);
  if (selectorStart === -1) fail("located a '.dark' block but lost its selector. Aborting.");

  const head = source.slice(0, selectorStart);
  const body = source.slice(braces.open + 1, braces.close);
  const tail = source.slice(braces.close + 1);

  // Same line count as the source: the wrapper opens and closes on the lines the
  // selector and its brace already occupied, so the output diffs cleanly.
  const content = `${BANNER}\n${head}@media (prefers-color-scheme: dark) { :root {${body}} }${tail}`;

  const want = countCustomProps(source);
  const got = countCustomProps(content);
  if (got !== want) {
    fail(`rewrote ${SOURCE_REL} but custom-property count changed (${want} -> ${got}). Aborting.`);
  }
  if (!content.includes("@media (prefers-color-scheme: dark)")) {
    fail("output has no prefers-color-scheme block, which is the whole point. Aborting.");
  }
  if (/(^|[\s}])\.dark\s*\{/m.test(blankComments(content))) {
    fail("output still contains a '.dark { }' ruleset, so NativeWind would still miss it. Aborting.");
  }

  return { content, props: want };
}

const checkOnly = process.argv.includes("--check");
const { content, props } = build();
const summary = `${props} custom properties, dark block as @media`;

if (checkOnly) {
  if (!fs.existsSync(OUTPUT)) fail(`${OUTPUT_REL} is missing. Run: npm run gen:native-tokens`);
  const onDisk = fs.readFileSync(OUTPUT, "utf8");
  if (onDisk !== content) {
    const a = onDisk.split("\n");
    const b = content.split("\n");
    const at = a.findIndex((line, i) => line !== b[i]);
    console.error(`gen-native-tokens: ${OUTPUT_REL} is stale.`);
    console.error(`  first difference at line ${at + 1}`);
    console.error(`  on disk:   ${JSON.stringify(a[at] ?? "(end of file)")}`);
    console.error(`  should be: ${JSON.stringify(b[at] ?? "(end of file)")}`);
    console.error(`  fix: npm run gen:native-tokens`);
    process.exit(1);
  }
  console.log(`gen-native-tokens: ${OUTPUT_REL} is current (${summary}).`);
} else {
  const existed = fs.existsSync(OUTPUT);
  const unchanged = existed && fs.readFileSync(OUTPUT, "utf8") === content;
  fs.writeFileSync(OUTPUT, content, "utf8");
  console.log(
    `gen-native-tokens: ${!existed ? "created" : unchanged ? "unchanged" : "updated"} ${OUTPUT_REL} (${summary}).`,
  );
}
