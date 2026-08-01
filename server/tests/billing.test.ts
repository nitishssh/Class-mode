import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import billingRouter from "../routes/billing";

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 1 };
    next();
  },
}));

vi.mock("../lib/db/pg-queries", () => ({
  pgFindSubscriptionByUser: vi.fn(),
  pgUpsertSubscription: vi.fn(),
  pgUpdateSubscriptionByStripeCustomer: vi.fn(),
  pgGetAIUsage: vi.fn(),
  pgFindUserById: vi.fn(),
}));

vi.mock("../lib/integrations/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
  PLANS: {
    free: { aiClassroomLimit: 10, aiTutorLimit: 10 },
    pro: { aiClassroomLimit: 100, aiTutorLimit: 100 },
  },
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  createStripeCustomer: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
app.use((req: any, res, next) => {
  req.session.userId = 1;
  next();
});
app.use("/api/billing", billingRouter);

describe("Billing Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  describe("GET /api/billing/plans", () => {
    it("returns available plans", async () => {
      const res = await request(app).get("/api/billing/plans");
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });
  });

  describe("GET /api/billing/subscription", () => {
    it("returns free tier if no subscription found", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockResolvedValueOnce(null);

      const res = await request(app).get("/api/billing/subscription");
      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("free");
    });

    it("returns subscription if found", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockResolvedValueOnce({ tier: "pro", status: "active" });

      const res = await request(app).get("/api/billing/subscription");
      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("pro");
    });

    it("returns 500 on error", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockRejectedValueOnce(new Error("DB Error"));

      const res = await request(app).get("/api/billing/subscription");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/billing/checkout", () => {
    it("returns 400 if priceId is missing", async () => {
      const res = await request(app).post("/api/billing/checkout").send({ tier: "pro" });
      expect(res.status).toBe(400);
    });

    it("returns 404 if user not found", async () => {
      const { pgFindUserById } = await import("../lib/db/pg-queries");
      (pgFindUserById as any).mockResolvedValueOnce(null);
      const res = await request(app)
        .post("/api/billing/checkout")
        .send({ priceId: "price_123", tier: "pro" });
      expect(res.status).toBe(404);
    });

    it("creates customer and session if no subscription exists", async () => {
      const { pgFindUserById, pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      const { createStripeCustomer, createCheckoutSession } =
        await import("../lib/integrations/stripe");

      (pgFindUserById as any).mockResolvedValueOnce({
        id: 1,
        email: "test@test.com",
        name: "Test",
      });
      (pgFindSubscriptionByUser as any).mockResolvedValueOnce(null);
      (createStripeCustomer as any).mockResolvedValueOnce({ id: "cus_123" });
      (createCheckoutSession as any).mockResolvedValueOnce({ url: "http://checkout" });

      const res = await request(app)
        .post("/api/billing/checkout")
        .send({ priceId: "price_123", tier: "pro" });
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("http://checkout");
    });

    it("returns 500 on error", async () => {
      const { pgFindUserById } = await import("../lib/db/pg-queries");
      (pgFindUserById as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app)
        .post("/api/billing/checkout")
        .send({ priceId: "price_123", tier: "pro" });
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/billing/portal", () => {
    it("returns 400 if no active subscription", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockResolvedValueOnce(null);
      const res = await request(app).post("/api/billing/portal");
      expect(res.status).toBe(400);
    });

    it("returns portal url on success", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      const { createPortalSession } = await import("../lib/integrations/stripe");

      (pgFindSubscriptionByUser as any).mockResolvedValueOnce({ stripeCustomerId: "cus_123" });
      (createPortalSession as any).mockResolvedValueOnce({ url: "http://portal" });

      const res = await request(app).post("/api/billing/portal");
      expect(res.status).toBe(200);
      expect(res.body.url).toBe("http://portal");
    });

    it("returns 500 on error", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app).post("/api/billing/portal");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/billing/usage", () => {
    it("returns usage stats", async () => {
      const { pgFindSubscriptionByUser, pgGetAIUsage } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockResolvedValueOnce({ tier: "pro" });
      (pgGetAIUsage as any).mockResolvedValueOnce(5).mockResolvedValueOnce(3); // classroom, tutor

      const res = await request(app).get("/api/billing/usage");
      expect(res.status).toBe(200);
      expect(res.body.tier).toBe("pro");
      expect(res.body.usage.aiClassroom).toBe(5);
    });

    it("returns 500 on error", async () => {
      const { pgFindSubscriptionByUser } = await import("../lib/db/pg-queries");
      (pgFindSubscriptionByUser as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app).get("/api/billing/usage");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/billing/webhook", () => {
    it("returns 400 if signature missing", async () => {
      const res = await request(app).post("/api/billing/webhook").send({});
      expect(res.status).toBe(400);
      expect(res.text).toContain("signature missing");
    });

    it("returns 400 on verification fail", async () => {
      const { stripe } = await import("../lib/integrations/stripe");
      (stripe.webhooks.constructEvent as any).mockImplementation(() => {
        throw new Error("Invalid sig");
      });
      const res = await request(app)
        .post("/api/billing/webhook")
        .set("stripe-signature", "sig")
        .send({});
      expect(res.status).toBe(400);
    });

    it("processes checkout.session.completed", async () => {
      const { stripe } = await import("../lib/integrations/stripe");
      const { pgUpsertSubscription } = await import("../lib/db/pg-queries");

      (stripe.webhooks.constructEvent as any).mockReturnValue({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: { userId: "1", tier: "pro" },
            customer: "cus_123",
            subscription: "sub_123",
          },
        },
      });
      (stripe.subscriptions.retrieve as any).mockResolvedValueOnce({
        current_period_start: 1000,
        current_period_end: 2000,
      });

      const res = await request(app)
        .post("/api/billing/webhook")
        .set("stripe-signature", "sig")
        .send({});
      expect(res.status).toBe(200);
      expect(pgUpsertSubscription).toHaveBeenCalled();
    });

    it("processes customer.subscription.updated", async () => {
      const { stripe } = await import("../lib/integrations/stripe");
      const { pgUpdateSubscriptionByStripeCustomer } = await import("../lib/db/pg-queries");

      (stripe.webhooks.constructEvent as any).mockReturnValue({
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_123",
            status: "active",
            current_period_start: 1000,
            current_period_end: 2000,
            cancel_at_period_end: false,
          },
        },
      });

      const res = await request(app)
        .post("/api/billing/webhook")
        .set("stripe-signature", "sig")
        .send({});
      expect(res.status).toBe(200);
      expect(pgUpdateSubscriptionByStripeCustomer).toHaveBeenCalled();
    });

    it("returns 500 on unhandled processing error", async () => {
      const { stripe } = await import("../lib/integrations/stripe");
      (stripe.webhooks.constructEvent as any).mockReturnValue({
        type: "checkout.session.completed",
        data: { object: { metadata: { userId: "1" } } },
      });
      (stripe.subscriptions.retrieve as any).mockRejectedValueOnce(new Error("API Error"));

      const res = await request(app)
        .post("/api/billing/webhook")
        .set("stripe-signature", "sig")
        .send({});
      expect(res.status).toBe(500);
    });
  });
});
