import { Request, Response, NextFunction } from "express";
import { MongoSubscription } from "../../shared/mongo-schema";

const TIER_LEVEL: Record<string, number> = { free: 0, pro: 1, educator: 2, institution: 3 };

export interface AuthenticatedRequest extends Request {
  user?: any;
  subscription?: any;
}

/**
 * Middleware: Require an active subscription of at least `minTier`.
 * Reads `req.user` (set by `authenticateToken`).
 */
export function requireSubscription(minTier: "pro" | "educator" | "institution") {
  const requiredLevel = TIER_LEVEL[minTier] || 1;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const sub = await MongoSubscription.findOne({ userId: user.id });
    const userTier = sub?.tier || "free";
    const userLevel = TIER_LEVEL[userTier] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({
        error: "Active subscription required",
        requiredTier: minTier,
        currentTier: userTier,
        upgradeUrl: "/pricing",
      });
    }

    req.subscription = sub;
    next();
  };
}

/**
 * Check if a specific feature is available for the user's tier.
 */
export function checkFeatureAccess(
  userTier: string,
  feature: "aiTutor" | "tasks" | "storage"
): { allowed: boolean; limit: number } {
  const limits: Record<string, { aiTutor: number; tasks: number; storage: number }> = {
    free: { aiTutor: 3, tasks: 10, storage: 100 * 1024 * 1024 },
    pro: { aiTutor: -1, tasks: -1, storage: 5 * 1024 * 1024 * 1024 },
    educator: { aiTutor: -1, tasks: -1, storage: 10 * 1024 * 1024 * 1024 },
    institution: { aiTutor: -1, tasks: -1, storage: 100 * 1024 * 1024 * 1024 },
  };

  const tierLimits = limits[userTier] || limits.free;
  const limit = tierLimits[feature];

  return { allowed: limit === -1 || limit > 0, limit };
}
