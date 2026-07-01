import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Meta WhatsApp Business Cloud API webhook.
 *
 * GET  /api/whatsapp/webhook — verification handshake. Meta calls this once
 *      with hub.verify_token; echo hub.challenge back when the token matches
 *      WHATSAPP_VERIFY_TOKEN.
 * POST /api/whatsapp/webhook — inbound message / delivery-status receiver.
 *      Must ack 200 fast; heavy work should be queued.
 *
 * Public (no auth) — Meta's servers call it. Configure WHATSAPP_VERIFY_TOKEN
 * to match the value set in the Meta App dashboard.
 */

// GET verification handshake.
router.get("/webhook", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    logger.info("[WhatsApp] Webhook verified");
    return res.status(200).send(String(challenge ?? ""));
  }
  logger.warn("[WhatsApp] Webhook verification failed");
  return res.sendStatus(403);
});

// POST inbound events (messages + statuses).
router.post("/webhook", (req: Request, res: Response) => {
  try {
    const value = req.body?.entry?.[0]?.changes?.[0]?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    if (Array.isArray(messages)) {
      for (const m of messages) {
        logger.info("[WhatsApp] Inbound message", {
          from: m?.from,
          type: m?.type,
          text: m?.text?.body?.slice(0, 120),
        });
      }
    }
    if (Array.isArray(statuses)) {
      for (const s of statuses) {
        logger.info("[WhatsApp] Delivery status", { id: s?.id, status: s?.status });
      }
    }
  } catch (err) {
    // Never fail the webhook — Meta retries on non-200 and will disable it on
    // repeated failures. Log and ack.
    logger.error("[WhatsApp] Webhook processing error", { err: String(err) });
  }
  // Always ack quickly.
  return res.sendStatus(200);
});

export default router;
