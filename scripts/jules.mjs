#!/usr/bin/env node
// scripts/jules.mjs
//
// Thin CLI over the Jules REST API (https://jules.googleapis.com/v1alpha).
// Lets you kick off and monitor Jules sessions for this repo from the terminal.
//
// Setup:
//   1. Install the Jules GitHub app and connect this repo via https://jules.google
//   2. Create an API key: Jules web app → Settings → API (max 3 keys)
//   3. export JULES_API_KEY=...   (or add it to .env — see .env.example)
//
// Usage:
//   node scripts/jules.mjs sources
//   node scripts/jules.mjs create "Fix the flaky onboarding redirect" [--branch main] [--pr] [--approve-plan] [--title "..."] [--source sources/github/owner/repo]
//   node scripts/jules.mjs list [--limit 20]
//   node scripts/jules.mjs activities <SESSION_ID>
//   node scripts/jules.mjs message <SESSION_ID> "Now make it corgi themed"
//   node scripts/jules.mjs approve <SESSION_ID>
//
// --source defaults to the GitHub remote of this repo (sources/github/<owner>/<repo>).
// --branch defaults to the current git branch.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const BASE = "https://jules.googleapis.com/v1alpha";

function loadApiKey() {
  if (process.env.JULES_API_KEY) return process.env.JULES_API_KEY;
  // Fall back to a JULES_API_KEY line in .env (not committed).
  try {
    const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
    const m = env.match(/^JULES_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    /* no .env — fine */
  }
  return null;
}

const firstArg = process.argv[2];
const NEEDS_KEY = firstArg && !["--help", "-h", "help"].includes(firstArg);

const API_KEY = loadApiKey();
if (NEEDS_KEY && !API_KEY) {
  console.error(
    "✗ JULES_API_KEY is not set. Create a key in the Jules web app (Settings → API)\n" +
      "  then: export JULES_API_KEY=...  (or add JULES_API_KEY=... to .env)",
  );
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      "X-Goog-Api-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(`✗ ${method} ${path} → ${res.status}`);
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

function defaultSource() {
  // Derive sources/github/<owner>/<repo> from the origin remote.
  let url;
  try {
    url = git("config --get remote.origin.url");
  } catch {
    return null;
  }
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
  return m ? `sources/github/${m[1]}/${m[2]}` : null;
}

function defaultBranch() {
  try {
    return git("rev-parse --abbrev-ref HEAD");
  } catch {
    return "main";
  }
}

function flag(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  // Boolean flag if next token is another flag or missing.
  const next = args[i + 1];
  if (next === undefined || next.startsWith("--")) return true;
  return next;
}

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "sources": {
    const data = await api("GET", "sources");
    const sources = data.sources ?? [];
    if (!sources.length) {
      console.log("No connected sources. Install the Jules GitHub app and connect this repo.");
      break;
    }
    for (const s of sources) console.log(s.name ?? JSON.stringify(s));
    break;
  }

  case "create": {
    const prompt = rest.find((a) => !a.startsWith("--"));
    if (!prompt) {
      console.error('✗ Provide a prompt: node scripts/jules.mjs create "Do the thing"');
      process.exit(1);
    }
    const source = flag(rest, "--source") || defaultSource();
    if (!source) {
      console.error("✗ Could not derive --source from git remote. Pass --source sources/github/owner/repo");
      process.exit(1);
    }
    const branch = flag(rest, "--branch") || defaultBranch();
    const body = {
      prompt,
      sourceContext: { source, githubRepoContext: { startingBranch: branch } },
    };
    if (flag(rest, "--pr")) body.automationMode = "AUTO_CREATE_PR";
    if (flag(rest, "--approve-plan")) body.requirePlanApproval = true;
    const title = flag(rest, "--title");
    if (typeof title === "string") body.title = title;

    const session = await api("POST", "sessions", body);
    console.log(`✓ Session created on ${source} @ ${branch}`);
    console.log(`  name:  ${session.name ?? "(unknown)"}`);
    if (session.id) console.log(`  id:    ${session.id}`);
    console.log("  Track: node scripts/jules.mjs activities " + (session.id ?? "<SESSION_ID>"));
    break;
  }

  case "list": {
    const limit = flag(rest, "--limit");
    const q = limit ? `?pageSize=${limit}` : "";
    const data = await api("GET", `sessions${q}`);
    const sessions = data.sessions ?? [];
    if (!sessions.length) {
      console.log("No sessions yet.");
      break;
    }
    for (const s of sessions) {
      console.log(`${s.id ?? s.name}  ${s.title ?? ""}  ${s.state ?? s.status ?? ""}`.trim());
    }
    break;
  }

  case "activities": {
    const id = rest[0];
    if (!id) {
      console.error("✗ Provide a session id: node scripts/jules.mjs activities <SESSION_ID>");
      process.exit(1);
    }
    const data = await api("GET", `sessions/${id}/activities`);
    console.log(JSON.stringify(data.activities ?? data, null, 2));
    break;
  }

  case "message": {
    const id = rest[0];
    const prompt = rest.slice(1).find((a) => !a.startsWith("--"));
    if (!id || !prompt) {
      console.error('✗ Usage: node scripts/jules.mjs message <SESSION_ID> "your message"');
      process.exit(1);
    }
    await api("POST", `sessions/${id}:sendMessage`, { prompt });
    console.log("✓ Message sent.");
    break;
  }

  case "approve": {
    const id = rest[0];
    if (!id) {
      console.error("✗ Provide a session id: node scripts/jules.mjs approve <SESSION_ID>");
      process.exit(1);
    }
    await api("POST", `sessions/${id}:approvePlan`, {});
    console.log("✓ Plan approved.");
    break;
  }

  default:
    console.log(
      [
        "Jules CLI — wraps the Jules REST API for this repo.",
        "",
        "Commands:",
        "  sources                      List connected GitHub sources",
        '  create "<prompt>" [opts]     Start a session (defaults to current repo + branch)',
        "      --branch <name>            Starting branch (default: current)",
        "      --source <sources/...>     Override source (default: git origin)",
        "      --pr                       Auto-create a PR (automationMode=AUTO_CREATE_PR)",
        "      --approve-plan             Require manual plan approval before work",
        '      --title "<text>"           Session title',
        "  list [--limit N]             List sessions",
        "  activities <SESSION_ID>      Show a session's activity log",
        '  message <SESSION_ID> "<txt>" Send a follow-up message',
        "  approve <SESSION_ID>         Approve a pending plan",
        "",
        "Auth: set JULES_API_KEY (env or .env).",
      ].join("\n"),
    );
}
