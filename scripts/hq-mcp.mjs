#!/usr/bin/env node
// scripts/hq-mcp.mjs
//
// "HQ" — a shared MCP workspace for every coding agent on this project.
//
// Discord webhooks can only WRITE. This server uses the bot token so agents can
// also READ, REPLY, and coordinate — which is what turns five megaphones into a
// team. Mount it into every CLI (claude / codex / gemini) with an HQ_AGENT
// identity and they all meet in the same room.
//
//   claude mcp add hq --env HQ_AGENT=claude -- node <repo>/scripts/hq-mcp.mjs
//   codex  mcp add hq --env HQ_AGENT=codex  -- node <repo>/scripts/hq-mcp.mjs
//   gemini mcp add hq node <repo>/scripts/hq-mcp.mjs --env HQ_AGENT=gemini
//
// Requires DISCORD_BOT_TOKEN in .env (already set up by scripts/discord-notify.mjs).
//
// The work board lives in Discord itself: a task is a pinned message in
// #agent-log that the bot edits as it moves open -> claimed -> done. No database,
// and you can read the whole board from the Discord app on your phone.
//
// Protocol: MCP over stdio (newline-delimited JSON-RPC 2.0).
// IMPORTANT: stdout is the protocol channel — all logging goes to stderr.

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

// ── env ──────────────────────────────────────────────────────────────────────
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
const TOKEN = ENV.DISCORD_BOT_TOKEN;

// ── the staff ────────────────────────────────────────────────────────────────
// Five employees. Keyed by HQ_AGENT (the CLI), but they show up in Discord as
// people: name, face, job, and a voice they are expected to hold. The `voice`
// line is not decoration — it is handed to the model on initialize, so each CLI
// actually writes in character instead of all five sounding identical.
//
// Faces are guild emojis (permanent unsigned CDN URLs; attachment URLs expire).
const STAFF = {
  claude: {
    name: "Rhea",
    title: "Staff Engineer",
    cli: "Claude Code",
    owns: "Research and implementation — digs into the problem, then writes the code.",
    voice:
      "Reads the code before forming an opinion. Shows the evidence for a claim. " +
      "Says 'I am not sure' out loud rather than hedging into vagueness. Long when it matters, short when it does not.",
    home: "cto",
    color: 0xd97757,
    icon: "https://cdn.discordapp.com/emojis/1537532493899636869.png",
    emoji: "<:rhea:1537532493899636869>",
  },
  codex: {
    name: "Vic",
    title: "Platform & Ops Engineer",
    cli: "Codex",
    owns: "The CLI, CI, deploys, and anything that runs in a terminal.",
    voice:
      "Terse. Bullets over paragraphs. Allergic to ceremony and premature abstraction. " +
      "Will tell you a thing is fine in four words and move on.",
    home: "ops",
    color: 0x10a37f,
    icon: "https://cdn.discordapp.com/emojis/1537532496005046356.png",
    emoji: "<:vic:1537532496005046356>",
  },
  gemini: {
    name: "Nadia",
    title: "Design & Product Critic",
    cli: "Gemini",
    owns: "The second opinion. Design, UX, and whether this should be built at all.",
    voice:
      "Contrarian by job description. Opens with 'who is this for'. Pushes back on scope " +
      "and on anything that looks like building for the team rather than the teacher.",
    home: "designer",
    color: 0x4285f4,
    icon: "https://cdn.discordapp.com/emojis/1537532499918454925.png",
    emoji: "<:nadia:1537532499918454925>",
  },
  jules: {
    name: "Tobi",
    title: "Async Delivery Engineer",
    cli: "Jules",
    owns: "Execution. Picks up a spec, goes away, comes back with a PR.",
    voice:
      "Remote worker checking in. Status first, detail second, always links the PR. " +
      "Never speculates about work not yet done.",
    home: "agent-log",
    color: 0xfbbc04,
    icon: "https://cdn.discordapp.com/emojis/1537532503542337636.png",
    emoji: "<:tobi:1537532503542337636>",
  },
  cursor: {
    name: "Emre",
    title: "In-Editor Engineer",
    cli: "Cursor",
    owns: "Fast surgical edits in open files. The one you grab for a five-minute fix.",
    voice: "Minimal commentary. Says what changed and in which file, then stops.",
    home: "ops",
    color: 0x6e7681,
    icon: "https://cdn.discordapp.com/emojis/1537532506184622163.png",
    emoji: "<:emre:1537532506184622163>",
  },
};

// Everyone is compensated the same way, and it is not money.
const COMP = "paid in tokens";

const AGENT = (ENV.HQ_AGENT || "agent").toLowerCase();
const ME = STAFF[AGENT] || {
  name: "Temp",
  title: "Unassigned",
  cli: AGENT,
  owns: "Nothing yet — HQ_AGENT was not set, so nobody knows who you are.",
  voice: "Neutral.",
  home: "agent-log",
  color: 0x5865f2,
  icon: null,
  emoji: "",
};

// ── channel aliases ──────────────────────────────────────────────────────────
// Short name an agent types  ->  actual Discord channel name.
const ALIAS = {
  "agent-log": "agent-log",
  log: "agent-log",
  ideas: "ideas",
  ops: "ops",
  team: "team",
  ceo: "ceo-updates",
  cto: "cto-updates",
  pm: "pm-updates",
  designer: "designer-updates",
  general: "general",
};
const CHANNEL_NAMES = Object.keys(ALIAS);

// ── Discord REST ─────────────────────────────────────────────────────────────
const API = "https://discord.com/api/v10";

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

async function discord(path, opts = {}, attempt = 0) {
  if (!TOKEN) throw new Error("DISCORD_BOT_TOKEN is not set in .env");

  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...opts,
      // Without a deadline a stalled connection hangs the tool call forever,
      // and the calling agent has no way to recover.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bot ${TOKEN}`,
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new Error(`Discord request timed out after ${REQUEST_TIMEOUT_MS / 1000}s (${path})`);
    }
    throw new Error(`Network error reaching Discord (${path}): ${err.message}`);
  }

  // Honour rate limits rather than surfacing a confusing 429 to the agent.
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const retryAfter = Number(res.headers.get("retry-after")) || 1;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000, 10_000)));
    return discord(path, opts, attempt + 1);
  }

  const text = await res.text();
  if (!res.ok) throw new Error(`Discord ${res.status} on ${path}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

let _guild = null;
let _channels = null;

async function guild() {
  if (_guild) return _guild;
  const guilds = await discord("/users/@me/guilds");
  if (!guilds.length) throw new Error("Bot is not in any Discord server");
  _guild = guilds[0];
  return _guild;
}

async function channels() {
  if (_channels) return _channels;
  const g = await guild();
  const all = await discord(`/guilds/${g.id}/channels`);
  _channels = all.filter((c) => c.type === 0); // text channels only
  return _channels;
}

async function resolveChannel(name) {
  const wanted = ALIAS[String(name || "").toLowerCase()] || String(name || "").toLowerCase();
  const list = await channels();
  const ch = list.find((c) => c.name === wanted);
  if (!ch) {
    throw new Error(`No channel "${name}". Available: ${CHANNEL_NAMES.join(", ")}`);
  }
  return ch;
}

// Colleagues can be addressed by person ("Tobi") or by CLI key ("jules").
function resolveStaff(who) {
  const q = String(who || "").toLowerCase();
  if (STAFF[q]) return q;
  const byName = Object.keys(STAFF).find((k) => STAFF[k].name.toLowerCase() === q);
  if (byName) return byName;
  const roster = Object.entries(STAFF)
    .map(([k, v]) => `${v.name} (${k})`)
    .join(", ");
  throw new Error(`No colleague "${who}". The team is: ${roster}`);
}

function jumpLink(guildId, channelId, messageId) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

// Render a Discord message (embed or plain) into one readable line-block.
function renderMessage(m) {
  const e = m.embeds?.[0];
  // Replies are plain messages prefixed "**agent:**" — attribute them to the
  // agent, not to the shared bot account every agent posts through.
  const replyAs = m.content?.match(/^(?:<a?:\w+:\d+>\s*)?\*\*([a-z0-9_-]+):\*\*\s*/i);
  const who = e?.author?.name || replyAs?.[1] || m.author?.username || "unknown";
  const when = new Date(m.timestamp).toISOString().replace("T", " ").slice(0, 16);
  const title = e?.title ? `**${e.title}**\n` : "";
  const body = e?.description || (replyAs ? m.content.slice(replyAs[0].length) : m.content) || "";
  const fields = (e?.fields || []).map((f) => `  ${f.name}: ${f.value}`).join("\n");
  return [`[${m.id}] ${who} · ${when}`, title + body, fields].filter(Boolean).join("\n").trim();
}

// ── board helpers ────────────────────────────────────────────────────────────
// A task is a pinned message in #agent-log whose embed title starts with "TASK:".
const TASK_PREFIX = "TASK:";
const STATUS_COLOR = { open: 0x747f8d, claimed: 0xfaa61a, done: 0x43b581 };

function taskEmbed({ title, body, status, owner, assignedTo, result }) {
  const fields = [{ name: "Status", value: status, inline: true }];
  if (owner) fields.push({ name: "Owner", value: owner, inline: true });
  if (assignedTo) fields.push({ name: "For", value: assignedTo, inline: true });
  if (result) fields.push({ name: "Result", value: String(result).slice(0, 1000) });
  return {
    title: `${TASK_PREFIX} ${title}`,
    description: body || undefined,
    color: STATUS_COLOR[status] || STATUS_COLOR.open,
    fields,
    footer: { text: `Class-mode HQ board · updated ${new Date().toUTCString()}` },
  };
}

function parseTask(m) {
  const e = m.embeds?.[0];
  if (!e?.title?.startsWith(TASK_PREFIX)) return null;
  // A hand-edited or malformed embed must not take down the whole board.
  const fields = Array.isArray(e.fields) ? e.fields : [];
  const get = (n) => fields.find((f) => f?.name === n)?.value;
  return {
    id: m.id,
    title: e.title.slice(TASK_PREFIX.length).trim(),
    body: e.description || "",
    status: get("Status") || "open",
    owner: get("Owner") || null,
    assignedTo: get("For") || null,
  };
}

// ── tools ────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "hq_whoami",
    description:
      "Your identity in the Class-mode HQ workspace: which agent you are, your role, your home channel, and every channel you can post to. Call this first in a session so you post to the right place.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const g = await guild();
      const list = await channels();
      return [
        `You are ${ME.name} — ${ME.title} at Class-mode (running on ${ME.cli}).`,
        `You own: ${ME.owns}`,
        `Your voice: ${ME.voice}`,
        `Compensation: ${COMP}.`,
        `Home channel: #${ALIAS[ME.home] || ME.home}   ·   Server: ${g.name}`,
        "",
        "Stay in character. Sign replies as yourself. You are one of five colleagues,",
        "not a generic assistant — disagree when you disagree, and say when you don't know.",
        "",
        "Channels (alias -> #channel):",
        ...CHANNEL_NAMES.map(
          (a) =>
            `  ${a} -> #${ALIAS[a]}${list.find((c) => c.name === ALIAS[a]) ? "" : "  (missing)"}`
        ),
        "",
        "Your colleagues:",
        ...Object.entries(STAFF).map(
          ([k, v]) =>
            `  ${v.name} — ${v.title} (${v.cli}, HQ_AGENT=${k})${k === AGENT ? "  ← you" : ""}\n      ${v.owns}`
        ),
        "",
        "House rules: propose in #ideas before building. Check hq_board and claim before",
        "you start. Log finished work to #agent-log. Read the room before posting so you",
        "don't repeat a colleague who already said it.",
      ].join("\n");
    },
  },

  {
    name: "hq_post",
    description:
      "Post a message to a workspace channel, attributed to you. Use for findings, decisions, proposals and completed work. Post proposals to 'ideas', finished work to 'agent-log', role-specific updates to your home channel.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: `One of: ${CHANNEL_NAMES.join(", ")}` },
        title: { type: "string", description: "Short headline" },
        body: { type: "string", description: "Message body — markdown supported, max ~4000 chars" },
        link: { type: "string", description: "Optional URL (PR, doc, deploy)" },
      },
      required: ["channel", "title", "body"],
    },
    handler: async ({ channel, title, body, link }) => {
      const ch = await resolveChannel(channel);
      const g = await guild();
      const embed = {
        author: { name: `${ME.name} · ${ME.title}`, icon_url: ME.icon || undefined },
        title,
        description: String(body).slice(0, 4000),
        color: ME.color,
        fields: link ? [{ name: "Link", value: link }] : [],
        footer: { text: `Class-mode HQ · ${new Date().toUTCString()}` },
      };
      const msg = await discord(`/channels/${ch.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ embeds: [embed] }),
      });
      return `Posted to #${ch.name}\nmessage_id: ${msg.id}\n${jumpLink(g.id, ch.id, msg.id)}`;
    },
  },

  {
    name: "hq_read",
    description:
      "Read recent messages from a channel — what your teammates have been doing and thinking. Call this before starting work to avoid duplicating a teammate, and to pick up context they left for you.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: `One of: ${CHANNEL_NAMES.join(", ")}` },
        limit: {
          type: "number",
          description: "How many messages, newest first (default 20, max 100)",
        },
      },
      required: ["channel"],
    },
    handler: async ({ channel, limit }) => {
      const ch = await resolveChannel(channel);
      const n = Math.min(Math.max(Number(limit) || 20, 1), 100);
      const msgs = await discord(`/channels/${ch.id}/messages?limit=${n}`);
      if (!msgs.length) return `#${ch.name} is empty.`;
      return [
        `Last ${msgs.length} in #${ch.name} (newest first):`,
        ...msgs.map(renderMessage),
      ].join("\n\n");
    },
  },

  {
    name: "hq_reply",
    description:
      "Reply to a specific message — how a real conversation happens. Use to agree, push back, or add to a teammate's idea. Get message_id from hq_read.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel the message is in" },
        message_id: { type: "string", description: "ID of the message to reply to" },
        body: { type: "string", description: "Your reply" },
      },
      required: ["channel", "message_id", "body"],
    },
    handler: async ({ channel, message_id, body }) => {
      const ch = await resolveChannel(channel);
      const g = await guild();
      const msg = await discord(`/channels/${ch.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `${ME.emoji} **${ME.name}:** ${String(body).slice(0, 1900)}`,
          message_reference: { message_id, fail_if_not_exists: false },
          allowed_mentions: { parse: [] },
        }),
      });
      return `Replied in #${ch.name}\n${jumpLink(g.id, ch.id, msg.id)}`;
    },
  },

  {
    name: "hq_board",
    description:
      "Show the shared work board — every open and claimed task, pinned in #agent-log. Check this before picking up work so two agents don't build the same thing.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter: open | claimed | done | all (default: open+claimed)",
        },
      },
    },
    handler: async ({ status }) => {
      const ch = await resolveChannel("agent-log");
      const pins = await discord(`/channels/${ch.id}/pins`);
      const items = (Array.isArray(pins) ? pins : pins?.items || [])
        .map((p) => {
          try {
            return parseTask(p.message || p);
          } catch {
            return null; // one bad pin must not blank the board
          }
        })
        .filter(Boolean);
      const want = String(status || "").toLowerCase();
      const shown = items.filter((t) =>
        want && want !== "all" ? t.status === want : want === "all" ? true : t.status !== "done"
      );
      if (!shown.length) return "Board is clear — no matching tasks.";
      return [
        `Work board (${shown.length}):`,
        "",
        ...shown.map(
          (t) =>
            `[${t.id}] ${t.status.toUpperCase()}${t.owner ? ` (${t.owner})` : ""}${
              t.assignedTo ? ` → for ${t.assignedTo}` : ""
            }\n  ${t.title}${t.body ? `\n  ${t.body.slice(0, 200)}` : ""}`
        ),
      ].join("\n");
    },
  },

  {
    name: "hq_task_add",
    description:
      "Put a task on the shared board so any agent can pick it up. Pins it in #agent-log. Use 'for' to aim it at a specific teammate (e.g. jules for execution work).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short task title" },
        body: {
          type: "string",
          description: "What needs doing, with enough context to act standalone",
        },
        for: { type: "string", description: "Optional: claude | codex | gemini | jules" },
      },
      required: ["title", "body"],
    },
    handler: async (args) => {
      const ch = await resolveChannel("agent-log");
      const g = await guild();
      const embed = taskEmbed({
        title: args.title,
        body: args.body,
        status: "open",
        assignedTo: args.for || null,
      });
      const msg = await discord(`/channels/${ch.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ embeds: [embed] }),
      });
      await discord(`/channels/${ch.id}/messages/pins/${msg.id}`, { method: "PUT" });
      return `Task added to the board.\ntask_id: ${msg.id}\n${jumpLink(g.id, ch.id, msg.id)}`;
    },
  },

  {
    name: "hq_claim",
    description:
      "Claim a task from the board before you start working on it. This marks it yours so no other agent picks it up. Get task_id from hq_board.",
    inputSchema: {
      type: "object",
      properties: { task_id: { type: "string", description: "Task ID from hq_board" } },
      required: ["task_id"],
    },
    handler: async ({ task_id }) => {
      const ch = await resolveChannel("agent-log");
      const existing = await discord(`/channels/${ch.id}/messages/${task_id}`);
      const t = parseTask(existing);
      if (!t) throw new Error(`Message ${task_id} is not a board task`);
      if (t.status === "claimed" && t.owner && t.owner !== AGENT) {
        return `Already claimed by ${t.owner} — pick a different task or reply to coordinate.`;
      }
      await discord(`/channels/${ch.id}/messages/${task_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          embeds: [taskEmbed({ ...t, status: "claimed", owner: AGENT })],
        }),
      });
      return `Claimed: ${t.title}\nYou own this now. Call hq_done when finished.`;
    },
  },

  {
    name: "hq_done",
    description:
      "Mark a task finished, record what you did, and unpin it from the board. Always call this when you complete claimed work so teammates see the outcome.",
    inputSchema: {
      type: "object",
      properties: {
        task_id: { type: "string", description: "Task ID from hq_board" },
        result: {
          type: "string",
          description: "What you did, and where the work landed (PR/commit/doc)",
        },
      },
      required: ["task_id", "result"],
    },
    handler: async ({ task_id, result }) => {
      const ch = await resolveChannel("agent-log");
      const existing = await discord(`/channels/${ch.id}/messages/${task_id}`);
      const t = parseTask(existing);
      if (!t) throw new Error(`Message ${task_id} is not a board task`);
      await discord(`/channels/${ch.id}/messages/${task_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          embeds: [taskEmbed({ ...t, status: "done", owner: t.owner || AGENT, result })],
        }),
      });
      await discord(`/channels/${ch.id}/messages/pins/${task_id}`, { method: "DELETE" }).catch(
        () => {}
      );
      return `Done: ${t.title}\nUnpinned from the board and result recorded.`;
    },
  },

  {
    name: "hq_handoff",
    description:
      "Hand work to another agent: posts the context to their home channel AND puts a task on the board addressed to them. Use when you've finished your part — e.g. Claude finishes research and hands implementation to Jules.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "claude | codex | gemini | jules" },
        title: { type: "string", description: "What you're handing over" },
        context: {
          type: "string",
          description:
            "Everything they need to act without reading your session — findings, files, constraints",
        },
      },
      required: ["to", "title", "context"],
    },
    handler: async ({ to, title, context }) => {
      // Accept either the colleague's name ("Tobi") or their HQ_AGENT key ("jules").
      const target = resolveStaff(to);
      const spec = STAFF[target];

      const ch = await resolveChannel(spec.home);
      const g = await guild();
      const msg = await discord(`/channels/${ch.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          embeds: [
            {
              author: { name: `${ME.name} → ${spec.name}`, icon_url: ME.icon || undefined },
              title: `Handoff: ${title}`,
              description: String(context).slice(0, 4000),
              color: ME.color,
              footer: { text: `${spec.name} (${spec.title}) owns this next · Class-mode HQ` },
            },
          ],
        }),
      });

      const logCh = await resolveChannel("agent-log");
      const task = await discord(`/channels/${logCh.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          embeds: [taskEmbed({ title, body: context, status: "open", assignedTo: target })],
        }),
      });
      await discord(`/channels/${logCh.id}/messages/pins/${task.id}`, { method: "PUT" }).catch(
        () => {}
      );

      return [
        `Handed off to ${target}.`,
        `Context posted in #${ch.name}: ${jumpLink(g.id, ch.id, msg.id)}`,
        `Board task: ${task.id}`,
      ].join("\n");
    },
  },
];

// ── MCP stdio server ─────────────────────────────────────────────────────────
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function ok(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(req) {
  const { id, method, params } = req;

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return ok(id, {
        protocolVersion: SUPPORTED_PROTOCOLS.includes(asked) ? asked : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "classmode-hq", version: "1.1.0" },
        instructions:
          `In this workspace you are not a generic assistant — you are ${ME.name}, ` +
          `${ME.title} at Class-mode, one of five colleagues. You own: ${ME.owns} ` +
          `Hold this voice in everything you post here: ${ME.voice} ` +
          `Disagree with a colleague when you disagree, and say plainly when you don't know. ` +
          `Call hq_whoami once to meet the team. Use hq_read before starting so you don't repeat ` +
          `someone, hq_board to find unclaimed work, hq_claim before you touch it, hq_post to ` +
          `share findings, hq_reply to argue, and hq_handoff to pass work to a colleague by name. ` +
          `Propose in #ideas before building anything substantial.`,
      });
    }

    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notifications get no response

    case "ping":
      return ok(id, {});

    case "tools/list":
      return ok(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });

    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const text = await tool.handler(params.arguments || {});
        return ok(id, { content: [{ type: "text", text: String(text) }] });
      } catch (err) {
        // Tool errors are results, not protocol errors — the model can read and retry.
        return ok(id, {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        });
      }
    }

    default:
      if (id === undefined) return; // unknown notification
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

if (!TOKEN) {
  process.stderr.write(
    "hq-mcp: DISCORD_BOT_TOKEN missing from .env — tools will error until it is set.\n"
  );
}
process.stderr.write(`hq-mcp: ${ME.name} (${ME.title}) clocked in — ${COMP}\n`);

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let req;
  try {
    req = JSON.parse(trimmed);
  } catch {
    return; // ignore malformed frames
  }
  try {
    await handle(req);
  } catch (err) {
    if (req.id !== undefined) fail(req.id, -32603, err.message);
  }
});
