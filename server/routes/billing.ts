import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  pgFindSubscriptionByUser,
  pgUpsertSubscription, pgUpdateSubscriptionByStripeCustomer, pgFindUserById,
} from "../lib/pg-queries";
import { authenticateToken } from "../routes";
import { logger } from "../lib/logger";
import StripeImport from "stripe";

const router = Router();

// ─── Stripe Setup ─────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripeEnabled =
  STRIPE_SECRET_KEY.startsWith("sk_live_") || STRIPE_SECRET_KEY.startsWith("sk_test_");

let stripe: any = null;
if (stripeEnabled) {
  stripe = new StripeImport(STRIPE_SECRET_KEY, { apiVersion: "2024-11-20" as any });
} else {
  logger.info("[Billing] Stripe not configured — billing endpoints will return 503.");
}

// ─── Subscription Tier Config ──────────────────────────────────────

const TIER_CONFIG = {
  free: { priceId: "", limits: { aiTutor: 3, tasks: 10, storage: 100 * 1024 * 1024 } },
  pro: {
    priceId: process.env.STRIPE_PRICE_PRO_ID || "",
    limits: { aiTutor: -1, tasks: -1, storage: 5 * 1024 * 1024 * 1024 },
  },
  educator: {
    priceId: process.env.STRIPE_PRICE_EDUCATOR_ID || "",
    limits: { aiTutor: -1, tasks: -1, storage: 10 * 1024 * 1024 * 1024 },
  },
  institution: {
    priceId: process.env.STRIPE_PRICE_INSTITUTION_ID || "",
    limits: { aiTutor: -1, tasks: -1, storage: 100 * 1024 * 1024 * 1024 },
  },
};

// ─── Middleware: Require Active Subscription ─────────────────────

export async function requireSubscription(minTier: "pro" | "educator" | "institution") {
  const tierLevel: Record<string, number> = { free: 0, pro: 1, educator: 2, institution: 3 };
  return async (req: any, res: Response, next: any) => {
    const user = req.user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const sub = await pgFindSubscriptionByUser(user.id);
    const userTier = sub?.tier || "free";
    const requiredLevel = tierLevel[minTier] || 1;
    const userLevel = tierLevel[userTier] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: "Subscription required",
        requiredTier: minTier,
        currentTier: userTier,
        upgradeUrl: "/pricing",
      });
    }
    req.subscription = sub;
    next();
  };
}

// ─── Get Current Subscription ─────────────────────────────────────

router.get("/subscription", authenticateToken, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });
    if ((req as any).workspace && (req as any).workspaceRole !== "owner") {
      return res.status(403).json({ error: "Only workspace owners can manage billing" });
    }

    const sub = await pgFindSubscriptionByUser(user.id);

    const tier = sub?.tier || "free";
    const config = TIER_CONFIG[tier as keyof typeof TIER_CONFIG] || TIER_CONFIG.free;

    res.json({
      success: true,
      data: {
        tier,
        status: sub?.status || "active",
        currentPeriodEnd: sub?.currentPeriodEnd || null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
        limits: config.limits,
        stripeCustomerId: sub?.stripeCustomerId || null,
      },
    });
  } catch (error: any) {
    logger.error("Get subscription error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch subscription" });
  }
});

// ─── Create Checkout Session ──────────────────────────────────────

const CheckoutSchema = z.object({
  tier: z.enum(["pro", "educator", "institution"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

router.post("/checkout", authenticateToken, async (req: Request, res: Response) => {
  if (!stripeEnabled) return res.status(503).json({ error: "Billing not yet configured" });
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });
    if ((req as any).workspace && (req as any).workspaceRole !== "owner") {
      return res.status(403).json({ error: "Only workspace owners can manage billing" });
    }

    const { tier, successUrl, cancelUrl } = CheckoutSchema.parse(req.body);
    const config = TIER_CONFIG[tier];
    if (!config.priceId) {
      return res.status(400).json({ error: `No Stripe price configured for tier: ${tier}` });
    }

    // Get or create Stripe customer
    let sub = await pgFindSubscriptionByUser(user.id);
    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const userDoc = await pgFindUserById(user.id);
      const customer = await stripe.customers.create({
        email: userDoc?.email || undefined,
        name: userDoc?.name || undefined,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      sub = await pgUpsertSubscription(user.id, { tier: "free", stripeCustomerId: customerId, status: "active" });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: config.priceId, quantity: 1 }],
      success_url:
        successUrl || `${process.env.CLIENT_URL || "http://localhost:3000"}/billing/success`,
      cancel_url: cancelUrl || `${process.env.CLIENT_URL || "http://localhost:3000"}/pricing`,
      metadata: { userId: String(user.id), tier },
    });

    res.json({ success: true, checkoutUrl: session.url });
  } catch (error: any) {
    logger.error("Checkout session error:", error);
    res.status(500).json({ error: error.message || "Failed to create checkout session" });
  }
});

// ─── Customer Portal ───────────────────────────────────────────────

router.get("/portal", authenticateToken, async (req: Request, res: Response) => {
  if (!stripeEnabled) return res.status(503).json({ error: "Billing not yet configured" });
  try {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "Authentication required" });

    const sub = await pgFindSubscriptionByUser(user.id);
    if (!sub?.stripeCustomerId) {
      return res
        .status(400)
        .json({ error: "No Stripe customer found. Please create a subscription first." });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/billing`,
    });

    res.json({ success: true, portalUrl: portalSession.url });
  } catch (error: any) {
    logger.error("Customer portal error:", error);
    res.status(500).json({ error: error.message || "Failed to create portal session" });
  }
});

// ─── Stripe Webhook ─────────────────────────────────────────────

import { IncomingMessage } from "http";
async function buffer(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

router.post("/webhook", async (req: Request, res: Response) => {
  if (!stripeEnabled) return res.status(503).json({ error: "Billing not yet configured" });
  const sig = req.headers["stripe-signature"] as string;
  if (!sig) return res.status(400).send("Missing stripe-signature header");

  try {
    const buf = await buffer(req);
    const event = stripe.webhooks.constructEvent(buf, sig, STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;
        await pgUpdateSubscriptionByStripeCustomer(customerId, {
          tier: getTierFromPriceId(subscription.items.data[0]?.price?.id),
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        await pgUpdateSubscriptionByStripeCustomer(subscription.customer, {
          status: "canceled", tier: "free",
        });
        break;
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error("Webhook error:", error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

function getTierFromPriceId(priceId: string): "free" | "pro" | "educator" | "institution" {
  for (const [tier, config] of Object.entries(TIER_CONFIG)) {
    if (config.priceId === priceId) return tier as "free" | "pro" | "educator" | "institution";
  }
  return "free";
}

export default router;
