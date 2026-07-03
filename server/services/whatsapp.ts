import { logger } from "../lib/logger";

export interface WhatsAppMessage {
  to: string;
  body: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** True when no credentials were configured and the send was simulated. */
  simulated?: boolean;
}

const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

/**
 * Sends WhatsApp messages via the Meta WhatsApp Business Cloud API.
 *
 * Configure with env vars:
 *   WHATSAPP_ACCESS_TOKEN     — permanent/system-user access token
 *   WHATSAPP_PHONE_NUMBER_ID  — the Cloud API phone number id
 *   WHATSAPP_API_VERSION      — optional, defaults to v21.0
 *
 * If credentials are absent (dev/test/CI), sends are SIMULATED (logged) so the
 * rest of the app keeps working without live Meta access.
 */
export class WhatsAppService {
  private get accessToken(): string | undefined {
    return process.env.WHATSAPP_ACCESS_TOKEN;
  }
  private get phoneNumberId(): string | undefined {
    return process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  /** Whether live Meta Graph API credentials are configured. */
  isConfigured(): boolean {
    return !!this.accessToken && !!this.phoneNumberId;
  }

  async sendMessage(msg: WhatsAppMessage): Promise<WhatsAppSendResult> {
    try {
      if (!msg.to || !msg.body) {
        throw new Error("Missing recipient or message body");
      }

      // Meta expects E.164 digits without a leading '+' or separators.
      const cleanTo = msg.to.replace(/[^0-9]/g, "");
      if (!cleanTo) throw new Error("Invalid recipient phone number");

      if (!this.isConfigured()) {
        // Fail loud in production: a missing-credential send used to return
        // success:true (simulated), so a misconfigured prod deploy looked
        // healthy while every parent alert silently went nowhere. Outside
        // production, simulation stays so dev/test/CI keep working offline.
        if (process.env.NODE_ENV === "production") {
          logger.error(
            `[WhatsApp] BLOCKED send to ${cleanTo} — no credentials configured in production. ` +
              `Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.`
          );
          return { success: false, error: "WhatsApp not configured" };
        }
        logger.warn(
          `[WhatsApp] No credentials configured — simulating send to ${cleanTo}: ${msg.body.substring(0, 50)}...`
        );
        return { success: true, simulated: true, messageId: `wa_sim_${Date.now()}` };
      }

      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: cleanTo,
          type: "text",
          text: { preview_url: false, body: msg.body },
        }),
      });

      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        const apiErr = data?.error?.message || `HTTP ${res.status}`;
        logger.error("[WhatsApp] Graph API send failed", { status: res.status, error: apiErr });
        return { success: false, error: apiErr };
      }

      const messageId: string | undefined = data?.messages?.[0]?.id;
      logger.info(`[WhatsApp] Sent to ${cleanTo} (id=${messageId ?? "unknown"})`);
      return { success: true, messageId };
    } catch (error) {
      logger.error("[WhatsApp] Send failed", { error: String(error) });
      return { success: false, error: String(error) };
    }
  }
}

export const whatsappService = new WhatsAppService();
