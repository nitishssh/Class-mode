import { storage } from "../storage";
import { logger } from "../lib/logger";
import type { Notification as AppNotification, FcmToken } from "@shared/schema";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts";

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message?: string; details?: { error?: string } };

type ExpoReceipt =
  | { status: "ok" }
  | { status: "error"; message?: string; details?: { error?: string } };

export function isExpoPushToken(token: string): boolean {
  return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
}

function notificationData(notification: AppNotification): Record<string, unknown> {
  let meta: unknown = null;
  if (notification.meta) {
    try {
      meta = JSON.parse(notification.meta);
    } catch {
      meta = notification.meta;
    }
  }
  return {
    notificationId: notification.id,
    type: notification.type,
    meta,
  };
}

export function buildExpoMessages(notification: AppNotification, tokens: FcmToken[]) {
  return tokens
    .filter((token) => isExpoPushToken(token.token))
    .map((token) => ({
      to: token.token,
      sound: "default",
      title: notification.title,
      body: notification.body,
      data: notificationData(notification),
    }));
}

async function postExpo<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Expo Push API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function pruneDeadTokensFromTickets(tokens: FcmToken[], tickets: ExpoTicket[]) {
  await Promise.all(
    tickets.map(async (ticket, index) => {
      if (ticket.status !== "error") return;
      if (ticket.details?.error !== "DeviceNotRegistered") return;
      const token = tokens[index]?.token;
      if (token) await storage.removeFcmToken(token);
    })
  );
}

async function pruneDeadTokensFromReceipts(receiptIds: string[], ticketTokens: string[]) {
  if (!receiptIds.length) return;
  const receiptRes = await postExpo<{ data?: Record<string, ExpoReceipt> }>(EXPO_RECEIPT_URL, {
    ids: receiptIds,
  });
  const receipts = receiptRes.data ?? {};
  await Promise.all(
    receiptIds.map(async (id, index) => {
      const receipt = receipts[id];
      if (receipt?.status !== "error") return;
      if (receipt.details?.error !== "DeviceNotRegistered") return;
      await storage.removeFcmToken(ticketTokens[index]);
    })
  );
}

export async function sendPendingExpoPushNotifications(limit = 50): Promise<{
  scanned: number;
  sent: number;
  failed: number;
}> {
  if (process.env.EXPO_PUSH_ENABLED !== "true") {
    return { scanned: 0, sent: 0, failed: 0 };
  }

  const notifications = await storage.getPendingPushNotifications(limit);
  let sent = 0;
  let failed = 0;

  for (const notification of notifications) {
    const tokens = await storage.getFcmTokensByUser(notification.userId);
    const validTokens = tokens.filter((token) => isExpoPushToken(token.token));
    const messages = buildExpoMessages(notification, validTokens);

    if (!messages.length) {
      await storage.markNotificationPushAttempt(notification.id, "failed", {
        reason: "no_expo_tokens",
      });
      failed += 1;
      continue;
    }

    try {
      const ticketRes = await postExpo<{ data?: ExpoTicket[] }>(EXPO_PUSH_URL, messages);
      const tickets = ticketRes.data ?? [];
      await pruneDeadTokensFromTickets(validTokens, tickets);

      const okTickets = tickets
        .map((ticket, index) => ({ ticket, token: validTokens[index]?.token }))
        .filter((entry): entry is { ticket: { status: "ok"; id: string }; token: string } => {
          return entry.ticket.status === "ok" && Boolean(entry.token);
        });
      await pruneDeadTokensFromReceipts(
        okTickets.map((entry) => entry.ticket.id),
        okTickets.map((entry) => entry.token)
      );

      if (!okTickets.length) {
        await storage.markNotificationPushAttempt(notification.id, "failed", {
          reason: "all_tickets_failed",
          attempted: messages.length,
          tickets: tickets.length,
        });
        failed += 1;
        continue;
      }

      await storage.markNotificationPushAttempt(notification.id, "sent", {
        attempted: messages.length,
        tickets: tickets.length,
      });
      sent += 1;
    } catch (err) {
      logger.warn("[expo-push] send failed", { err: String(err), notificationId: notification.id });
      await storage.markNotificationPushAttempt(notification.id, "failed", {
        reason: "send_error",
        error: String(err),
      });
      failed += 1;
    }
  }

  return { scanned: notifications.length, sent, failed };
}

export function startExpoPushSender(): boolean {
  if (process.env.EXPO_PUSH_ENABLED !== "true") return false;
  const intervalMs = Number(process.env.EXPO_PUSH_INTERVAL_MS ?? 30_000);
  const tick = () => {
    sendPendingExpoPushNotifications().catch((err) =>
      logger.warn("[expo-push] polling tick failed", { err: String(err) })
    );
  };
  tick();
  setInterval(tick, Number.isFinite(intervalMs) && intervalMs >= 5_000 ? intervalMs : 30_000);
  return true;
}
