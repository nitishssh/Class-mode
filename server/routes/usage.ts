import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { resolveTenantScope } from "../lib/auth/tenant";
import { pgTrackFeatureUsage } from "../lib/db/pg-queries";

const router = Router();

/**
 * Client-reported view events (spec E1: reuse feature_usage — no new table).
 *
 * Only namespaced `*_view` feature strings are accepted here. Write actions
 * (attendance marking, fee payments, test creation, …) are tracked
 * server-side inside their own route handlers via pgTrackFeatureUsage, so
 * this allowlist keeps clients from inventing arbitrary feature rows.
 */
// `attendance_sync_recovered` (eng review T7): fired by the offline queue when a
// save that previously failed finally lands, so the weekly metrics can measure
// how often offline kicked in — the signal that decides whether the deferred
// service-worker/offline-reload work is justified. It is a real client-observed
// event the server cannot otherwise see (the original failure never reached it).
const VIEW_FEATURES = new Set([
  "attendance_view",
  "report_view",
  "attendance_sync_recovered",
]);

/**
 * POST /api/usage — record a single page-view feature usage event.
 *
 * Tenant-scoped: school_code always comes from the authenticated user, never
 * the request body. School-scoped accounts without a school are denied
 * (fail-closed) so feature_usage rows never carry a NULL school_code for
 * school-bound users; only the platform super-admin may record without one.
 */
const STAFF_ROLES = new Set(["teacher", "admin", "principal", "school_admin"]);

router.post("/", authenticateToken, (req: Request, res: Response) => {
  const user = (req as any).user;
  const feature = typeof req.body?.feature === "string" ? req.body.feature : "";
  if (!VIEW_FEATURES.has(feature)) {
    return res.status(400).json({ message: "Unknown feature" });
  }
  // Staff-only: these events feed the weekly ADOPTION metrics. Students can
  // reach some instrumented pages, and client-side gating alone would leave
  // the metric's integrity to client code — reject non-staff server-side.
  if (!STAFF_ROLES.has(user.role)) {
    return res.status(403).json({ message: "View events are recorded for staff only" });
  }

  const t = resolveTenantScope(user);
  if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });
  const schoolCode = t.scope.isPlatformAdmin
    ? // authenticateToken only ever sets camelCase schoolCode; a NULL-school
      // admin row is intentionally invisible to the weekly metrics.
      (user.schoolCode ?? null)
    : t.scope.schoolCode!;

  // Fire-and-forget: pgTrackFeatureUsage never throws and never blocks.
  pgTrackFeatureUsage({ feature, userId: user.id, schoolCode });
  return res.status(202).json({ success: true });
});

export default router;
