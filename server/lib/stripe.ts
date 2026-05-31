import Stripe from "stripe";
import { logger } from "./logger";

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn("STRIPE_SECRET_KEY is not set. Billing features will be disabled.");
}

// Fallback dummy key to prevent initialization error
const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_4eC39HqLyjWDarjtT1zdp7dc";

export const stripe = new Stripe(stripeKey, {
  apiVersion: "2023-10-16" as any,
});

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    priceId: "",
    aiClassroomLimit: 3,
    aiTutorLimit: 10,
  },
  pro: {
    id: "pro",
    name: "Pro Student",
    priceId: process.env.STRIPE_PRICE_PRO || "price_pro_default",
    aiClassroomLimit: 50,
    aiTutorLimit: -1, // Unlimited
  },
  educator: {
    id: "educator",
    name: "Educator",
    priceId: process.env.STRIPE_PRICE_EDUCATOR || "price_educator_default",
    aiClassroomLimit: 200,
    aiTutorLimit: -1,
  },
  institution: {
    id: "institution",
    name: "Institution",
    priceId: process.env.STRIPE_PRICE_INSTITUTION || "price_institution_default",
    aiClassroomLimit: -1,
    aiTutorLimit: -1,
  },
};

export async function createStripeCustomer(email: string, name: string, metadata?: any) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });
    return customer;
  } catch (error) {
    logger.error("[Stripe] Failed to create customer", { error: String(error), email });
    throw error;
  }
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: any
) {
  try {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });
    return session;
  } catch (error) {
    logger.error("[Stripe] Failed to create checkout session", { error: String(error) });
    throw error;
  }
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session;
  } catch (error) {
    logger.error("[Stripe] Failed to create portal session", { error: String(error) });
    throw error;
  }
}
