import { Request, Response, NextFunction } from "express";
import { pgFindSubscriptionByUser, pgGetAIUsage } from "../lib/pg-queries";
import { PLANS } from "../lib/stripe";

export async function checkAIQuota(feature: "ai_classroom" | "ai_tutor" | "ocr") {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (process.env.NODE_ENV === "test") {
        return next();
      }

      const userId = req.session?.userId || (req as any).user?.id;
      if (!userId) {
        // Individual routes should have authenticateToken before this,
        // but if it's missing, we can't check quota.
        return next();
      }

      const sub = await pgFindSubscriptionByUser(userId);
      const tier = sub?.tier || "free";
      const limits = PLANS[tier as keyof typeof PLANS] || PLANS.free;

      let limit = -1;
      if (feature === "ai_classroom") limit = limits.aiClassroomLimit;
      if (feature === "ai_tutor") limit = limits.aiTutorLimit;

      if (limit === -1) {
        return next();
      }

      const currentUsage = await pgGetAIUsage(userId, feature);

      if (currentUsage >= limit) {
        return res.status(403).json({
          error: "Quota exceeded",
          message: `You have reached your monthly limit for ${feature.replace("_", " ")}.`,
          limit,
          usage: currentUsage,
          tier,
          upgradeUrl: "/pricing",
        });
      }

      next();
    } catch (error) {
      console.error("[Quota] Error checking quota:", error);
      next(); // Fail open
    }
  };
}
