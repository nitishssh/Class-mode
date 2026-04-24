const http = require("http");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = process.env.INICLAW_PORT || 7070;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET;
const DEFAULT_SANDBOX = process.env.INICLAW_SANDBOX_NAME || "study-arena";
const MAX_CONCURRENT = parseInt(process.env.INICLAW_MAX_CONCURRENT || "3", 10);
const AUDIT_MAX_BYTES = parseInt(process.env.INICLAW_AUDIT_MAX_MB || "10", 10) * 1024 * 1024;
// Hard caps that prevent any single request from exhausting the heap.
const MAX_BODY_BYTES = parseInt(process.env.INICLAW_MAX_BODY_MB || "4", 10) * 1024 * 1024;
const MAX_OUTPUT_BYTES = parseInt(process.env.INICLAW_MAX_OUTPUT_MB || "32", 10) * 1024 * 1024;

// Comma-separated list of allowed CORS origins. Defaults cover local dev ports
// for the Study Arena engine (3000), Express backend (5001), and Vite frontend (5173).
const ALLOWED_ORIGINS = new Set(
  (
    process.env.INICLAW_ALLOWED_ORIGINS ||
    "http://localhost:3000,http://localhost:5001,http://localhost:5173"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

if (!BRIDGE_SECRET) {
  console.error("ERROR: BRIDGE_SECRET environment variable is required");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

const CACHE_DIR = path.join(__dirname, ".classroom-cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
const AUDIT_LOG = path.join(CACHE_DIR, "audit.jsonl");

function auditLog(requestId, data) {
  try {
    if (fs.existsSync(AUDIT_LOG) && fs.statSync(AUDIT_LOG).size > AUDIT_MAX_BYTES) {
      fs.renameSync(AUDIT_LOG, `${AUDIT_LOG}.${Date.now()}.bak`);
      // Keep only the 3 most recent backups so disk doesn't fill up.
      const backups = fs
        .readdirSync(CACHE_DIR)
        .filter((f) => f.startsWith("audit.jsonl.") && f.endsWith(".bak"))
        .sort()
        .slice(0, -3);
      for (const f of backups) {
        try { fs.unlinkSync(path.join(CACHE_DIR, f)); } catch (_) {}
      }
    }
    fs.appendFileSync(
      AUDIT_LOG,
      JSON.stringify({ timestamp: new Date().toISOString(), requestId, ...data }) + "\n"
    );
  } catch (_) {}
}

// ── Concurrency semaphore ─────────────────────────────────────────────────────

let activeSandboxCalls = 0;

function execSandbox(args, { timeout = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    if (activeSandboxCalls >= MAX_CONCURRENT) {
      return reject(Object.assign(new Error("Gateway at capacity"), { code: "CAPACITY" }));
    }
    activeSandboxCalls++;

    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    // settled prevents double-decrement: Node emits 'error' then 'close' on the
    // same process, which would make activeSandboxCalls go negative and break the
    // semaphore — letting unlimited concurrent calls pile up and OOM the process.
    let settled = false;

    const proc = spawn("openshell", args, { env: process.env });

    function finish(fn) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeSandboxCalls--;
      fn();
    }

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      finish(() => reject(new Error(`Sandbox exec timed out after ${timeout}ms`)));
    }, timeout);

    proc.stdout.on("data", (d) => {
      outputBytes += d.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        // Output exceeds cap — kill the process immediately to free resources.
        proc.kill("SIGTERM");
        finish(() =>
          reject(
            Object.assign(
              new Error(`Sandbox output exceeded ${MAX_OUTPUT_BYTES / 1024 / 1024} MB limit`),
              { code: "OUTPUT_TOO_LARGE" }
            )
          )
        );
        return;
      }
      stdout += d;
    });

    proc.stderr.on("data", (d) => { stderr += d.toString().slice(0, 4096); });

    proc.on("close", (code) => {
      finish(() => {
        if (code === 0) {
          resolve(stdout);
        } else {
          const err = new Error(`Sandbox exited with code ${code}`);
          err.stdout = stdout;
          err.stderr = stderr;
          reject(err);
        }
      });
    });

    proc.on("error", (err) => {
      finish(() => reject(err));
    });
  });
}

// ── Route table — maps each project use-case to its agent and timeout ─────────
//
// Project use-cases:
//   /classroom/generate — full interactive lesson (slides + quiz + simulation + PBL)
//   /classroom/quiz     — quiz-only generation
//   /classroom/slides   — slides-only generation
//   /tutor/chat         — real-time student tutor chat
//
// Legacy generic routes kept for backward compatibility with existing callers.

const ROUTE_MAP = {
  "/classroom/generate": {
    agent: process.env.CLASSROOM_AGENT || "main",
    timeout: 300000,
    logType: "classroom_generate",
  },
  "/classroom/quiz": {
    agent: process.env.QUIZ_AGENT || "main",
    timeout: 120000,
    logType: "classroom_quiz",
  },
  "/classroom/slides": {
    agent: process.env.SLIDES_AGENT || "main",
    timeout: 120000,
    logType: "classroom_slides",
  },
  "/tutor/chat": {
    agent: process.env.TUTOR_AGENT || "main",
    timeout: 60000,
    logType: "tutor_chat",
  },
  // Legacy
  "/generate": { agent: "main", timeout: 300000, logType: "generate" },
  "/agent":    { agent: "main", timeout: 60000,  logType: "agent" },
};

// ── CORS helper ───────────────────────────────────────────────────────────────

function setCorsHeaders(res, reqOrigin) {
  if (reqOrigin && ALLOWED_ORIGINS.has(reqOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", reqOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const { method, url } = req;
  const requestId = Math.random().toString(36).substring(7);
  let body = "";
  let bodyBytes = 0;
  let bodyRejected = false;

  req.on("data", (chunk) => {
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
    body += chunk.toString();
  });

  req.on("end", async () => {
    if (bodyRejected) return;
    console.log(`${new Date().toISOString()} [${requestId}] ${method} ${url}`);

    setCorsHeaders(res, req.headers.origin);

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url === "/health" && method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          version: pkg.version,
          service: "iniclaw-gateway",
          activeCalls: activeSandboxCalls,
          capacity: MAX_CONCURRENT,
        })
      );
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${BRIDGE_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      if (url === "/sandbox/status" && method === "GET") {
        const sandboxName = req.headers["x-sandbox-name"] || DEFAULT_SANDBOX;
        const output = await execSandbox(["sandbox", "get", sandboxName, "--json"], {
          timeout: 10000,
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(output);
        return;
      }

      const route = ROUTE_MAP[url];
      if (route && method === "POST") {
        const data = JSON.parse(body);
        const { message, prompt, sessionId, agentName, sandboxName = DEFAULT_SANDBOX } = data;
        const msg = message || prompt;

        if (!msg) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing message or prompt" }));
          return;
        }

        // Named project routes always use their designated agent.
        // Legacy /agent and /generate honour an agentName override from the caller.
        const isProjectRoute = url.startsWith("/classroom/") || url === "/tutor/chat";
        const agent = isProjectRoute ? route.agent : (agentName || route.agent);
        const sid = sessionId || "default";

        auditLog(requestId, {
          type: route.logType,
          sandboxName,
          agent,
          sessionId: sid,
          promptLength: msg.length,
        });

        const output = await execSandbox(
          [
            "sandbox", "exec", sandboxName, "--",
            "openclaw", "agent", "--agent", agent, "--local",
            "-m", msg, "--session-id", sid, "--json",
          ],
          { timeout: route.timeout }
        );

        auditLog(requestId, { status: "success" });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(output);
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    } catch (err) {
      console.error(`[${requestId}]`, err.message);
      auditLog(requestId, { status: "error", error: err.message });

      if (err.code === "CAPACITY") {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Too Many Requests", message: err.message }));
      } else if (err.code === "OUTPUT_TOO_LARGE") {
        res.writeHead(507, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Sandbox output too large", message: err.message }));
      } else {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: err.message,
            stdout: err.stdout ?? null,
            stderr: err.stderr ?? null,
          })
        );
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(
    `IniClaw Gateway listening on port ${PORT} (sandbox: ${DEFAULT_SANDBOX}, max concurrent: ${MAX_CONCURRENT})`
  );
});
