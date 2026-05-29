import { logger } from "../lib/logger";

export interface WhatsAppMessage {
  to: string;
  body: string;
}

/**
 * Service to handle sending WhatsApp messages.
 * Currently simulates sending by logging.
 * In production, this would integrate with WhatsApp Business API, Twilio, or Meta Graph API.
 */
export class WhatsAppService {
  async sendMessage(msg: WhatsAppMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Basic validation
      if (!msg.to || !msg.body) {
        throw new Error("Missing recipient or message body");
      }

      // Format recipient: ensure it starts with + and has no spaces/dashes
      const cleanTo = msg.to.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
      
      logger.info(`[WhatsApp] Sending message to ${cleanTo}: ${msg.body.substring(0, 50)}...`);

      // TODO: Implement actual integration (e.g. Meta Graph API)
      // For now, we simulate a successful send.
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        messageId: `wa_sim_${Math.random().toString(36).substring(7)}`
      };
    } catch (error) {
      logger.error("[WhatsApp] Send failed", { error: String(error) });
      return {
        success: false,
        error: String(error)
      };
    }
  }
}

export const whatsappService = new WhatsAppService();
