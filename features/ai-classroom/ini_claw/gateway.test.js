const { test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");

const PORT = 7070;
const SECRET = "changeme_replace_with_output_of_openssl_rand_hex_16";

async function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test("Health check shape", async (t) => {
  const { status, body } = await request({ port: PORT, path: "/health", method: "GET" });
  assert.strictEqual(status, 200);
  const json = JSON.parse(body);
  assert.strictEqual(json.status, "ok");
  assert.ok(json.version);
});

test("Auth failure - wrong secret", async (t) => {
  const { status } = await request({
    port: PORT,
    path: "/sandbox/status",
    method: "GET",
    headers: { Authorization: "Bearer wrong" },
  });
  assert.strictEqual(status, 401);
});

test("Auth failure - missing secret", async (t) => {
  const { status } = await request({ port: PORT, path: "/sandbox/status", method: "GET" });
  assert.strictEqual(status, 401);
});

test("POST /agent - missing message", async (t) => {
  const { status, body } = await request(
    {
      port: PORT,
      path: "/agent",
      method: "POST",
      headers: {
        Authorization: `Bearer ${SECRET}`,
        "Content-Type": "application/json",
      },
    },
    {}
  );
  assert.strictEqual(status, 400);
  assert.ok(JSON.parse(body).error.includes("Missing"));
});

test("404 on unknown route", async (t) => {
  const { status } = await request({
    port: PORT,
    path: "/unknown",
    method: "GET",
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  assert.strictEqual(status, 404);
});
