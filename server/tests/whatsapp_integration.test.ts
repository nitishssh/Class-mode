import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import whatsappRoutes from "../routes/whatsapp";
import { WhatsAppService } from "../services/whatsapp";

describe("WhatsAppService.sendMessage", () => {
  const OLD_ENV = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD_ENV };
    vi.restoreAllMocks();
  });

  it("simulates the send when credentials are not configured", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const svc = new WhatsAppService();
    const res = await svc.sendMessage({ to: "+1 (555) 123-4567", body: "hi" });
    expect(res.success).toBe(true);
    expect(res.simulated).toBe(true);
    expect(svc.isConfigured()).toBe(false);
  });

  it("fails loud instead of simulating when credentials are missing in production", async () => {
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    process.env.NODE_ENV = "production";
    const svc = new WhatsAppService();
    const res = await svc.sendMessage({ to: "+15551234567", body: "hi" });
    // A misconfigured prod deploy must not report a phantom success.
    expect(res.success).toBe(false);
    expect(res.simulated).toBeUndefined();
    expect(res.error).toMatch(/not configured/i);
  });

  it("rejects an empty recipient", async () => {
    const svc = new WhatsAppService();
    const res = await svc.sendMessage({ to: "", body: "hi" });
    expect(res.success).toBe(false);
  });

  it("calls the Meta Graph API when configured", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.ABC" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const svc = new WhatsAppService();
    const res = await svc.sendMessage({ to: "+15551234567", body: "hello" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/123456/messages");
    expect(opts.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(opts.body).to).toBe("15551234567"); // digits only, no '+'
    expect(res.success).toBe(true);
    expect(res.messageId).toBe("wamid.ABC");
  });

  it("surfaces a Graph API error", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid OAuth token" } }),
      })
    );
    const svc = new WhatsAppService();
    const res = await svc.sendMessage({ to: "+15551234567", body: "hello" });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Invalid OAuth token/);
  });
});

describe("WhatsApp webhook", () => {
  let app: express.Express;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/api/whatsapp", whatsappRoutes);
  });
  afterEach(() => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
  });

  it("echoes hub.challenge when the verify token matches", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "secret123";
    const res = await request(app).get("/api/whatsapp/webhook").query({
      "hub.mode": "subscribe",
      "hub.verify_token": "secret123",
      "hub.challenge": "42",
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe("42");
  });

  it("returns 403 when the verify token does not match", async () => {
    process.env.WHATSAPP_VERIFY_TOKEN = "secret123";
    const res = await request(app).get("/api/whatsapp/webhook").query({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "42",
    });
    expect(res.status).toBe(403);
  });

  it("acks inbound events with 200", async () => {
    const res = await request(app)
      .post("/api/whatsapp/webhook")
      .send({
        entry: [
          {
            changes: [
              {
                value: { messages: [{ from: "15551234567", type: "text", text: { body: "hi" } }] },
              },
            ],
          },
        ],
      });
    expect(res.status).toBe(200);
  });
});
