import { Router, type Request, type Response } from "express";
import { authenticateToken } from "../middleware";
import {
  stripe,
  PLANS,
  createCheckoutSession,
  createPortalSession,
  createStripeCustomer,
} from "../lib/stripe";
import {
  pgFindSubscriptionByUser,
  pgUpsertSubscription,
  pgUpdateSubscriptionByStripeCustomer,
  pgGetAIUsage,
  pgFindUserById,
} from "../lib/pg-queries";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/billing/plans — List available plans
router.get("/plans", (req: Request, res: Response) => {
  res.json(Object.values(PLANS));
});

// GET /api/billing/subscription — Get current user's subscription
router.get("/subscription", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await pgFindSubscriptionByUser(userId);

    if (!sub) {
      return res.json({ tier: "free", status: "active" });
    }

    res.json(sub);
  } catch (error) {
    logger.error("[billing/subscription] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to fetch subscription" });
  }
});

// POST /api/billing/checkout — Create a Stripe checkout session
router.post("/checkout", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { priceId, tier } = req.body;

    if (!priceId) {
      return res.status(400).json({ message: "priceId is required" });
    }

    const user = await pgFindUserById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let sub = await pgFindSubscriptionByUser(userId);
    let customerId = sub?.stripeCustomerId;

    if (!customerId) {
      const customer = await createStripeCustomer(user.email, user.name, { userId });
      customerId = customer.id;
      // Store customerId immediately
      await pgUpsertSubscription(userId, {
        stripeCustomerId: customerId,
        tier: "free",
        status: "active",
      });
    }

    const origin = req.headers.origin || "http://localhost:5001";
    const session = await createCheckoutSession(
      customerId,
      priceId,
      `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      `${origin}/billing/cancel`,
      { userId, tier }
    );

    res.json({ url: session.url });
  } catch (error) {
    logger.error("[billing/checkout] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to create checkout session" });
  }
});

// POST /api/billing/portal — Create a Stripe customer portal session
router.post("/portal", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await pgFindSubscriptionByUser(userId);

    if (!sub?.stripeCustomerId) {
      return res.status(400).json({ message: "No active subscription found" });
    }

    const origin = req.headers.origin || "http://localhost:5001";
    const session = await createPortalSession(sub.stripeCustomerId, `${origin}/dashboard/settings`);

    res.json({ url: session.url });
  } catch (error) {
    logger.error("[billing/portal] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to create portal session" });
  }
});

// GET /api/billing/usage — Get AI usage stats
router.get("/usage", authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sub = await pgFindSubscriptionByUser(userId);
    const tier = sub?.tier || "free";
    const limits = PLANS[tier as keyof typeof PLANS] || PLANS.free;

    const [classroomUsage, tutorUsage] = await Promise.all([
      pgGetAIUsage(userId, "ai_classroom"),
      pgGetAIUsage(userId, "ai_tutor"),
    ]);

    res.json({
      tier,
      limits: {
        aiClassroom: limits.aiClassroomLimit,
        aiTutor: limits.aiTutorLimit,
      },
      usage: {
        aiClassroom: classroomUsage,
        aiTutor: tutorUsage,
      },
    });
  } catch (error) {
    logger.error("[billing/usage] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to fetch usage stats" });
  }
});

// POST /api/billing/webhook — Handle Stripe webhooks
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).send("Webhook signature missing or secret not configured");
  }

  // express.json() in server/index.ts stashes the untouched request body on
  // req.rawBody for this route. Stripe signature verification must run against
  // those exact bytes, not the parsed JSON object.
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    logger.error("[Stripe Webhook] Raw body unavailable for signature verification");
    return res.status(400).send("Webhook Error: raw body unavailable");
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    logger.error("[Stripe Webhook] Verification failed", { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as any;
        const userId = parseInt(session.metadata.userId);
        const tier = session.metadata.tier;
        const stripeCustomerId = session.customer as string;
        const stripeSubscriptionId = session.subscription as string;

        if (userId) {
          const subscription = (await stripe.subscriptions.retrieve(stripeSubscriptionId)) as any;
          await pgUpsertSubscription(userId, {
            tier,
            stripeCustomerId,
            stripeSubscriptionId,
            status: "active",
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          });
          logger.info("[Stripe Webhook] Subscription completed", { userId, tier });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as any;
        const stripeCustomerId = subscription.customer as string;
        const status =
          subscription.status === "active"
            ? "active"
            : subscription.status === "canceled"
              ? "canceled"
              : "past_due";

        await pgUpdateSubscriptionByStripeCustomer(stripeCustomerId, {
          status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        logger.info("[Stripe Webhook] Subscription updated", { stripeCustomerId, status });
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error("[Stripe Webhook] Error processing event", {
      error: String(error),
      type: event.type,
    });
    res.status(500).json({ message: "Webhook processing failed" });
  }
});

export default router;
