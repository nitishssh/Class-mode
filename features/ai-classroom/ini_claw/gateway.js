const http = require("http");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = process.env.INICLAW_PORT || 7070;
const BRIDGE_SECRET = process.env.BRIDGE_SECRET;

if (!BRIDGE_SECRET) {
  console.error("ERROR: BRIDGE_SECRET environment variable is required");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

// Ensure audit log directory exists
const CACHE_DIR = path.join(__dirname, ".classroom-cache");
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
const AUDIT_LOG = path.join(CACHE_DIR, "audit.jsonl");

function auditLog(requestId, data) {
  const logEntry =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      ...data,
    }) + "\n";
  fs.appendFileSync(AUDIT_LOG, logEntry);
}

const server = http.createServer((req, res) => {
  const { method, url } = req;
  const requestId = Math.random().toString(36).substring(7);
  let body = "";

  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", async () => {
    console.log(`${new Date().toISOString()} [${requestId}] ${method} ${url}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check (no auth)
    if (url === "/health" && method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", version: pkg.version, service: "iniclaw-gateway" }));
      return;
    }

    // Auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${BRIDGE_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    try {
      if (url === "/sandbox/status" && method === "GET") {
        const sandboxName = req.headers["x-sandbox-name"] || "my-assistant";
        const output = execSync(`openshell sandbox get ${sandboxName} --json`, {
          encoding: "utf8",
        });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(output);
      } else if ((url === "/agent" || url === "/generate") && method === "POST") {
        const data = JSON.parse(body);
        const { message, prompt, sessionId, agentName, sandboxName = "my-assistant" } = data;
        const msg = message || prompt;

        if (!msg) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing message or prompt" }));
          return;
        }

        const agent = agentName || "main";
        const sid = sessionId || "default";
        const timeout = url === "/generate" ? 300000 : 60000;

        const cmd = `openshell sandbox exec ${sandboxName} -- openclaw agent --agent ${agent} --local -m "${msg.replace(/"/g, '\\"')}" --session-id ${sid} --json`;

        console.log(`[${requestId}] Executing: ${cmd}`);

        // Audit log PRE-execution
        auditLog(requestId, {
          type: url.substring(1),
          sandboxName,
          agent,
          sessionId: sid,
          prompt: msg,
        });

        const output = execSync(cmd, { encoding: "utf8", timeout });

        // Audit log POST-execution (success)
        auditLog(requestId, { status: "success" });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(output);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      }
    } catch (err) {
      console.error(err);
      // Audit log POST-execution (failure)
      auditLog(requestId, { status: "error", error: err.message });

      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Internal Server Error",
          message: err.message,
          stdout: err.stdout ? err.stdout.toString() : null,
          stderr: err.stderr ? err.stderr.toString() : null,
        })
      );
    }
  });
});

server.listen(PORT, () => {
  console.log(`IniClaw Gateway listening on port ${PORT}`);
});
