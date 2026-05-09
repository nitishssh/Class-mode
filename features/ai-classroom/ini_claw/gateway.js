#!/usr/bin/env node
// IniClaw Gateway — lightweight LLM proxy for PersonalLearningPro Study Arena
// Zero npm dependencies; uses only Node.js built-in modules.

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT             = process.env.INICLAW_PORT           || 7070;
const BRIDGE_SECRET    = process.env.BRIDGE_SECRET;
const MAX_CONCURRENT   = parseInt(process.env.INICLAW_MAX_CONCURRENT  || "3",  10);
const MAX_BODY_BYTES   = parseInt(process.env.INICLAW_MAX_BODY_MB      || "4",  10) * 1024 * 1024;
const MAX_OUTPUT_BYTES = parseInt(process.env.INICLAW_MAX_OUTPUT_MB    || "32", 10) * 1024 * 1024;
const AUDIT_MAX_BYTES  = parseInt(process.env.INICLAW_AUDIT_MAX_MB     || "10", 10) * 1024 * 1024;

const ALLOWED_ORIGINS = new Set(
  (process.env.INICLAW_ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5001,http://localhost:5173")
    .split(",").map(o => o.trim()).filter(Boolean)
);

if (!BRIDGE_SECRET) {
  console.error("ERROR: BRIDGE_SECRET environment variable is required");
  process.exit(1);
}

const VERSION   = "1.0.0";
const CACHE_DIR = path.join(__dirname, ".classroom-cache");
const AUDIT_LOG = path.join(CACHE_DIR, "audit.jsonl");

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// ── Route table ───────────────────────────────────────────────────────────────

const ROUTE_MAP = {
  "/classroom/generate": { timeout: 300_000, logType: "classroom_generate" },
  "/classroom/quiz":     { timeout: 120_000, logType: "classroom_quiz"     },
  "/classroom/slides":   { timeout: 120_000, logType: "classroom_slides"   },
  "/tutor/chat":         { timeout:  60_000, logType: "tutor_chat"         },
};

// ── Audit log ─────────────────────────────────────────────────────────────────

function auditLog(requestId, data) {
  try {
    if (fs.existsSync(AUDIT_LOG) && fs.statSync(AUDIT_LOG).size > AUDIT_MAX_BYTES) {
      fs.renameSync(AUDIT_LOG, `${AUDIT_LOG}.${Date.now()}.bak`);
      const backups = fs.readdirSync(CACHE_DIR)
        .filter(f => f.startsWith("audit.jsonl.") && f.endsWith(".bak"))
        .sort().slice(0, -3);
      for (const f of backups) { try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch (_) {} }
    }
    fs.appendFileSync(AUDIT_LOG, JSON.stringify({ timestamp: new Date().toISOString(), requestId, ...data }) + "\n");
  } catch (_) {}
}

// ── LLM providers ─────────────────────────────────────────────────────────────

function httpsPost(hostname, pathname, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname, path: pathname, method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
    }, (res) => {
      let raw = "";
      let bytes = 0;
      res.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > MAX_OUTPUT_BYTES) { req.destroy(); reject(new Error("LLM response too large")); return; }
        raw += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 400) reject(Object.assign(new Error(`LLM API error ${res.statusCode}`), { body: json }));
          else resolve(json);
        } catch (e) { reject(new Error(`Failed to parse LLM response: ${e.message}`)); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function callOpenAI(system, user) {
  const json = await httpsPost("api.openai.com", "/v1/chat/completions", {
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
  }, { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` });
  return json.choices[0].message.content;
}

async function callGemini(system, user) {
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const json = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_API_KEY}`,
    {
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
    },
    {}
  );
  return json.candidates[0].content.parts[0].text;
}

async function callAnthropic(system, user) {
  const json = await httpsPost("api.anthropic.com", "/v1/messages", {
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: user }],
  }, { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" });
  return json.content[0].text;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`LLM call timed out after ${ms}ms`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// Tries Gemini → OpenAI → Anthropic in order of availability.
async function callLLM(system, user, timeoutMs) {
  const hasGemini    = !!process.env.GOOGLE_API_KEY;
  const hasOpenAI    = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

  if (!hasGemini && !hasOpenAI && !hasAnthropic)
    throw new Error("No LLM provider configured. Set GOOGLE_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY.");

  if (hasGemini) {
    try { return await withTimeout(callGemini(system, user), timeoutMs); }
    catch (err) {
      console.warn(`[iniclaw] Gemini failed (${err.message}), trying next provider`);
      if (!hasOpenAI && !hasAnthropic) throw err;
    }
  }
  if (hasOpenAI) {
    try { return await withTimeout(callOpenAI(system, user), timeoutMs); }
    catch (err) {
      console.warn(`[iniclaw] OpenAI failed (${err.message}), trying next provider`);
      if (!hasAnthropic) throw err;
    }
  }
  return withTimeout(callAnthropic(system, user), timeoutMs);
}

// ── CORS ──────────────────────────────────────────────────────────────────────

function setCorsHeaders(res, origin) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── HTTP server ───────────────────────────────────────────────────────────────

let activeCalls = 0;

const server = http.createServer((req, res) => {
  const { method, url } = req;
  const requestId = Math.random().toString(36).slice(2, 9);
  let body = "";
  let bodyBytes = 0;
  let bodyRejected = false;

  req.on("data", chunk => {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_BODY_BYTES) {
      if (!bodyRejected) {
        bodyRejected = true;
        res.writeHead(413, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Request body too large" }));
        req.destroy();
      }
      return;
    }
    body += chunk;
  });

  req.on("end", async () => {
    if (bodyRejected) return;
    console.log(`${new Date().toISOString()} [${requestId}] ${method} ${url}`);

    setCorsHeaders(res, req.headers.origin);

    if (method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (url === "/health" && method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: VERSION, service: "iniclaw-gateway", activeCalls, capacity: MAX_CONCURRENT }));
      return;
    }

    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${BRIDGE_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    const route = ROUTE_MAP[url];
    if (route && method === "POST") {
      if (activeCalls >= MAX_CONCURRENT) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too Many Requests" }));
        return;
      }

      let data;
      try { data = JSON.parse(body); }
      catch { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "Invalid JSON" })); return; }

      const { message, prompt, sessionId = "default", systemPrompt = "You are a helpful AI tutor." } = data;
      const msg = message || prompt;

      if (!msg) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing message or prompt" }));
        return;
      }

      activeCalls++;
      auditLog(requestId, { type: route.logType, sessionId, promptLength: msg.length });

      try {
        const response = await callLLM(systemPrompt, msg, route.timeout);
        auditLog(requestId, { status: "success" });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ response, sessionId }));
      } catch (err) {
        auditLog(requestId, { status: "error", error: err.message });
        console.error(`[${requestId}] LLM error:`, err.message);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "LLM call failed", message: err.message }));
      } finally {
        activeCalls--;
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  });
});

server.listen(PORT, () => {
  console.log(`IniClaw Gateway listening on port ${PORT} (max concurrent: ${MAX_CONCURRENT})`);
});

module.exports = { server };
