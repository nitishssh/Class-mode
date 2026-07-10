import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mockGetPendingPushNotifications: vi.fn(),
  mockGetFcmTokensByUser: vi.fn(),
  mockMarkNotificationPushAttempt: vi.fn(),
  mockRemoveFcmToken: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getPendingPushNotifications: h.mockGetPendingPushNotifications,
    getFcmTokensByUser: h.mockGetFcmTokensByUser,
    markNotificationPushAttempt: h.mockMarkNotificationPushAttempt,
    removeFcmToken: h.mockRemoveFcmToken,
  },
}));

import {
  buildExpoMessages,
  isExpoPushToken,
  sendPendingExpoPushNotifications,
} from "../services/expo-push-sender";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

const notification = {
  id: 9,
  userId: 42,
  type: "reminder" as const,
  title: "Fee due",
  body: "Term 1 is due.",
  isRead: false,
  meta: JSON.stringify({ studentId: 7 }),
  createdAt: new Date("2026-07-10T00:00:00.000Z"),
};

describe("Expo push sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    process.env.EXPO_PUSH_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.EXPO_PUSH_ENABLED;
  });

  it("validates Expo push token formats", () => {
    expect(isExpoPushToken("ExponentPushToken[abc]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[abc]")).toBe(true);
    expect(isExpoPushToken("fcm-token")).toBe(false);
  });

  it("builds Expo messages and skips non-Expo tokens", () => {
    const messages = buildExpoMessages(notification, [
      {
        id: 1,
        userId: 42,
        token: "ExponentPushToken[abc]",
        deviceType: "ios",
        updatedAt: new Date(),
      },
      { id: 2, userId: 42, token: "raw-fcm-token", deviceType: "android", updatedAt: new Date() },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[abc]",
      title: "Fee due",
      body: "Term 1 is due.",
    });
    expect(messages[0].data).toMatchObject({ notificationId: 9, type: "reminder" });
  });

  it("does nothing when the sender env flag is off", async () => {
    process.env.EXPO_PUSH_ENABLED = "false";

    const result = await sendPendingExpoPushNotifications();

    expect(result).toEqual({ scanned: 0, sent: 0, failed: 0 });
    expect(h.mockGetPendingPushNotifications).not.toHaveBeenCalled();
  });

  it("sends pending notifications and marks them sent", async () => {
    h.mockGetPendingPushNotifications.mockResolvedValue([notification]);
    h.mockGetFcmTokensByUser.mockResolvedValue([
      {
        id: 1,
        userId: 42,
        token: "ExponentPushToken[abc]",
        deviceType: "ios",
        updatedAt: new Date(),
      },
    ]);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ status: "ok", id: "receipt-1" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { "receipt-1": { status: "ok" } } }),
      });

    const result = await sendPendingExpoPushNotifications();

    expect(result).toEqual({ scanned: 1, sent: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(h.mockMarkNotificationPushAttempt).toHaveBeenCalledWith(
      9,
      "sent",
      expect.objectContaining({ attempted: 1, tickets: 1 })
    );
  });

  it("prunes dead tokens from Expo ticket errors and leaves the notification retryable", async () => {
    h.mockGetPendingPushNotifications.mockResolvedValue([notification]);
    h.mockGetFcmTokensByUser.mockResolvedValue([
      {
        id: 1,
        userId: 42,
        token: "ExponentPushToken[dead]",
        deviceType: "ios",
        updatedAt: new Date(),
      },
    ]);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ status: "error", details: { error: "DeviceNotRegistered" } }],
      }),
    });

    const result = await sendPendingExpoPushNotifications();

    expect(result).toEqual({ scanned: 1, sent: 0, failed: 1 });
    expect(h.mockRemoveFcmToken).toHaveBeenCalledWith("ExponentPushToken[dead]");
    expect(h.mockMarkNotificationPushAttempt).toHaveBeenCalledWith(
      9,
      "failed",
      expect.objectContaining({ reason: "all_tickets_failed", attempted: 1, tickets: 1 })
    );
  });

  it("marks a notification failed when the user has no Expo tokens", async () => {
    h.mockGetPendingPushNotifications.mockResolvedValue([notification]);
    h.mockGetFcmTokensByUser.mockResolvedValue([
      { id: 2, userId: 42, token: "raw-fcm-token", deviceType: "android", updatedAt: new Date() },
    ]);

    const result = await sendPendingExpoPushNotifications();

    expect(result).toEqual({ scanned: 1, sent: 0, failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(h.mockMarkNotificationPushAttempt).toHaveBeenCalledWith(
      9,
      "failed",
      expect.objectContaining({ reason: "no_expo_tokens" })
    );
  });
});
