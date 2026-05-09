const { test, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { PassThrough } = require("node:stream");

// Stub HTTPS before requiring gateway so LLM calls never hit the network.
const https = require("node:https");
https.request = (_opts, cb) => {
  const res = new PassThrough();
  res.statusCode = 200;
  setImmediate(() => {
    res.end(JSON.stringify({
      choices:    [{ message: { content: "stub response" } }],
      candidates: [{ content: { parts: [{ text: "stub response" }] } }],
      content:    [{ text: "stub response" }],
    }));
  });
  if (cb) cb(res);
  return { write() {}, end() {}, on() { return this; }, destroy() {} };
};

// Set env before the server boots.
process.env.BRIDGE_SECRET   = "test-secret";
process.env.INICLAW_PORT    = "17071";
process.env.OPENAI_API_KEY  = "stub-key";

// Boot the gateway in-process.
const { server } = require("./gateway");

const PORT   = 17071;
const SECRET = "test-secret";

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Wait for the server to bind.
before(() => new Promise(r => setTimeout(r, 300)));

// Close the server so the port is freed for future runs.
after(() => new Promise(r => server.close(r)));

test("Health check returns ok", async () => {
  const { status, body } = await request({ port: PORT, path: "/health", method: "GET" });
  assert.strictEqual(status, 200);
  const json = JSON.parse(body);
  assert.strictEqual(json.status, "ok");
  assert.ok(json.version);
  assert.strictEqual(json.service, "iniclaw-gateway");
});

test("Missing auth → 401", async () => {
  const { status } = await request({
    port: PORT, path: "/tutor/chat", method: "POST",
    headers: { "Content-Type": "application/json" },
  }, { message: "hi" });
  assert.strictEqual(status, 401);
});

test("Wrong auth → 401", async () => {
  const { status } = await request({
    port: PORT, path: "/tutor/chat", method: "POST",
    headers: { Authorization: "Bearer wrong", "Content-Type": "application/json" },
  }, { message: "hi" });
  assert.strictEqual(status, 401);
});

test("Missing message → 400", async () => {
  const { status, body } = await request({
    port: PORT, path: "/tutor/chat", method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  }, {});
  assert.strictEqual(status, 400);
  assert.ok(JSON.parse(body).error.includes("Missing"));
});

test("Unknown route → 404", async () => {
  const { status } = await request({
    port: PORT, path: "/unknown", method: "GET",
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  assert.strictEqual(status, 404);
});

test("POST /tutor/chat returns response + sessionId", async () => {
  const { status, body } = await request({
    port: PORT, path: "/tutor/chat", method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  }, { message: "explain photosynthesis", sessionId: "test-1" });
  assert.strictEqual(status, 200);
  const json = JSON.parse(body);
  assert.ok(json.response);
  assert.strictEqual(json.sessionId, "test-1");
});

test("POST /classroom/quiz returns response", async () => {
  const { status, body } = await request({
    port: PORT, path: "/classroom/quiz", method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  }, { message: "quiz on World War II", systemPrompt: "You are a quiz generator." });
  assert.strictEqual(status, 200);
  assert.ok(JSON.parse(body).response);
});

test("POST /classroom/generate returns response", async () => {
  const { status, body } = await request({
    port: PORT, path: "/classroom/generate", method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
  }, { message: "teach me about black holes" });
  assert.strictEqual(status, 200);
  assert.ok(JSON.parse(body).response);
});
