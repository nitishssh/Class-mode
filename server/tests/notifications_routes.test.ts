import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const h = vi.hoisted(() => ({
  currentUser: null as any,
  mockSavePushToken: vi.fn(),
  mockDeletePushToken: vi.fn(),
  mockGetNotificationsByUser: vi.fn(),
  mockMarkAllNotificationsRead: vi.fn(),
  mockMarkNotificationRead: vi.fn(),
  mockDismissNotification: vi.fn(),
}));

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = h.currentUser;
    next();
  },
}));

vi.mock("../storage", () => ({
  storage: {
    savePushToken: h.mockSavePushToken,
    deletePushToken: h.mockDeletePushToken,
    getNotificationsByUser: h.mockGetNotificationsByUser,
    markAllNotificationsRead: h.mockMarkAllNotificationsRead,
    markNotificationRead: h.mockMarkNotificationRead,
    dismissNotification: h.mockDismissNotification,
  },
}));

import notificationsRoutes from "../routes/notifications";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", notificationsRoutes);
  return app;
}

describe("mobile notification token routes", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    h.currentUser = { id: 42, role: "parent", emailVerified: true };
    app = makeApp();
  });

  it("registers a push token using the Bearer-authenticated mobile user", async () => {
    h.mockSavePushToken.mockResolvedValue({ id: 1 });

    const res = await request(app)
      .post("/api/tokens")
      .set("X-Client", "mobile")
      .send({ token: "ExponentPushToken[parent]", deviceType: "ios" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Push token registered successfully",
    });
    expect(h.mockSavePushToken).toHaveBeenCalledWith(42, "ExponentPushToken[parent]", "ios");
  });

  it("removes a push token using the Bearer-authenticated mobile user", async () => {
    h.mockDeletePushToken.mockResolvedValue(true);

    const res = await request(app)
      .delete("/api/tokens")
      .set("X-Client", "mobile")
      .send({ token: "ExponentPushToken[parent]" });

    expect(res.status).toBe(200);
    expect(h.mockDeletePushToken).toHaveBeenCalledWith(42, "ExponentPushToken[parent]");
  });

  it("rejects token registration when auth middleware did not attach a user", async () => {
    h.currentUser = null;

    const res = await request(app)
      .post("/api/tokens")
      .set("X-Client", "mobile")
      .send({ token: "ExponentPushToken[parent]" });

    expect(res.status).toBe(401);
    expect(h.mockSavePushToken).not.toHaveBeenCalled();
  });
});
