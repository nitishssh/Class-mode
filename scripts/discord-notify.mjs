#!/usr/bin/env node
// scripts/discord-notify.mjs
//
// Fire-and-forget posting to the Class-mode HQ Discord server, for callers that
// cannot mount the `hq` MCP server: CI, shell scripts, and Jules (remote).
// Called automatically by scripts/jules.mjs after session creation.
//
// Transport: prefers DISCORD_BOT_TOKEN, falls back to a channel webhook URL.
// Use the bot token wherever possible — Discord hides the content and embeds of
// WEBHOOK-authored messages from bots, so a webhook post lands in the channel
// but reads back BLANK to any agent calling hq_read. Bot posts are readable.
//
// Setup: put DISCORD_BOT_TOKEN in .env (see .env.example). Webhook URLs are
// only needed as a fallback: Edit Channel → Integrations → Webhooks → New Webhook.
//
// Usage:
//   node scripts/discord-notify.mjs --channel cto --title "Auth bug fixed" --body "..." [--pr URL] [--session ID] [--agent Jules|Claude]
//   node scripts/discord-notify.mjs --channel ops --title "Deploy done" --body "v1.9.5 is live"
//
// Exit codes: 0 = success, 1 = no transport configured, 2 = Discord API error

import { readFileSync } from "node:fs";

// ── env loading ──────────────────────────────────────────────────────────────
function loadEnv() {
  const env = { ...process.env };
  try {
    const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env */
  }
  return env;
}

const ENV = loadEnv();

// ── channel → env var mapping ────────────────────────────────────────────────
const CHANNEL_MAP = {
  "agent-log": "DISCORD_WEBHOOK_AGENT_LOG",
  ceo: "DISCORD_WEBHOOK_CEO",
  cto: "DISCORD_WEBHOOK_CTO",
  pm: "DISCORD_WEBHOOK_PM",
  designer: "DISCORD_WEBHOOK_DESIGNER",
  ideas: "DISCORD_WEBHOOK_IDEAS",
  ops: "DISCORD_WEBHOOK_OPS",
  team: "DISCORD_WEBHOOK_TEAM",
};

// ── staff faces ──────────────────────────────────────────────────────────────
// Guild-emoji CDN URLs (permanent, unsigned). Keyed by both the person's name
// and their CLI, so --agent Tobi and --agent Jules both get the right face.
// Source of truth for the roster is STAFF in scripts/hq-mcp.mjs.
const FACE = {
  rhea: "1537532493899636869",
  claude: "1537532493899636869",
  vic: "1537532496005046356",
  codex: "1537532496005046356",
  nadia: "1537532499918454925",
  gemini: "1537532499918454925",
  tobi: "1537532503542337636",
  jules: "1537532503542337636",
  emre: "1537532506184622163",
  cursor: "1537532506184622163",
};

const faceUrl = (who) => {
  const id = FACE[String(who || "").toLowerCase()];
  return id ? `https://cdn.discordapp.com/emojis/${id}.png` : undefined;
};

// ── role colours (Discord embed sidebar) ────────────────────────────────────
const ROLE_COLOR = {
  "agent-log": 0x5865f2, // Discord blurple
  ceo: 0xfb4c2f, // red
  cto: 0x4a86e8, // blue
  pm: 0x16a766, // green
  designer: 0xa479e2, // purple
  ideas: 0xe9b44c, // amber
  ops: 0x10a37f, // teal
  team: 0x5865f2, // blurple
};

// ── arg parsing ──────────────────────────────────────────────────────────────
function flag(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const next = args[i + 1];
  if (next === undefined || next.startsWith("--")) return true;
  return next;
}

const args = process.argv.slice(2);

if (!args.length || args.includes("--help") || args.includes("-h")) {
  console.log(
    `
Discord notifier — posts agent updates to Class-mode HQ Discord.

Usage:
  node scripts/discord-notify.mjs \\
    --channel <agent-log|ideas|ops|ceo|cto|pm|designer> \\
    --title   "<short title>" \\
    --body    "<message body>" \\
    [--pr     "<PR URL>"] \\
    [--session "<Jules session ID>"] \\
    [--agent  "<Jules|Claude|CI>"]

Env vars (add to .env):
  DISCORD_BOT_TOKEN          preferred — posts are readable by other agents
  DISCORD_WEBHOOK_AGENT_LOG  fallback only (webhook posts read back blank)
  DISCORD_WEBHOOK_IDEAS / _OPS / _CEO / _CTO / _PM / _DESIGNER
`.trim()
  );
  process.exit(0);
}

const channel = flag(args, "--channel");
const title = flag(args, "--title") || "Agent update";
const body = flag(args, "--body") || "";
const pr = flag(args, "--pr");
const session = flag(args, "--session");
const agent = flag(args, "--agent") || "Agent";

if (!channel || !CHANNEL_MAP[channel]) {
  console.error(`✗ --channel must be one of: ${Object.keys(CHANNEL_MAP).join(", ")}`);
  process.exit(1);
}

// Role channels are named "<role>-updates"; shared channels use their bare name.
const SHARED = new Set(["agent-log", "ideas", "ops", "team"]);
const channelName = SHARED.has(channel) ? channel : `${channel}-updates`;

const webhookUrl = ENV[CHANNEL_MAP[channel]];
const botToken = ENV.DISCORD_BOT_TOKEN;

if (!webhookUrl && !botToken) {
  console.error(
    `✗ No way to post. Set DISCORD_BOT_TOKEN (preferred) or ${CHANNEL_MAP[channel]} in .env`
  );
  process.exit(1);
}

// ── build Discord embed ──────────────────────────────────────────────────────
const fields = [];

if (session) {
  fields.push({ name: "Jules session", value: `\`${session}\``, inline: true });
}
if (pr) {
  fields.push({ name: "Pull request", value: `[View PR](${pr})`, inline: true });
}

const embed = {
  // Attribution lives in the embed, not the account, so it survives either
  // transport. hq-mcp.mjs reads this field to name the author.
  author: { name: agent, icon_url: faceUrl(agent) },
  title,
  description: body || undefined,
  color: ROLE_COLOR[channel],
  fields,
  footer: {
    text: `${agent} · Class-mode HQ · ${new Date().toUTCString()}`,
  },
};

// ── post ─────────────────────────────────────────────────────────────────────
// Prefer the bot token. Discord hides message content and embeds of
// WEBHOOK-authored messages from bots, so anything posted via webhook is
// invisible to agents calling hq_read — it would land in the channel and be
// unreadable by the team. Bot-authored messages are fully readable.
async function postAsBot() {
  const h = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };
  const guilds = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: h }).then(
    (r) => r.json()
  );
  if (!guilds?.length) throw new Error("bot is not in any server");
  const channels = await fetch(`https://discord.com/api/v10/guilds/${guilds[0].id}/channels`, {
    headers: h,
  }).then((r) => r.json());
  const ch = channels.find((c) => c.name === channelName && c.type === 0);
  if (!ch) throw new Error(`channel #${channelName} not found`);

  const res = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "bot";
}

async function postAsWebhook() {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `${agent} 🤖`, embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "webhook";
}

try {
  let via;
  if (botToken) {
    try {
      via = await postAsBot();
    } catch (err) {
      if (!webhookUrl) throw err;
      console.error(`! Bot post failed (${err.message}) — falling back to webhook.`);
      via = await postAsWebhook();
    }
  } else {
    via = await postAsWebhook();
  }

  console.log(`✓ Posted to #${channelName} via ${via}`);
  if (via === "webhook") {
    console.error("! Webhook posts are not readable by agents (hq_read). Set DISCORD_BOT_TOKEN.");
  }
} catch (err) {
  console.error(`✗ ${err.message}`);
  process.exit(2);
}
