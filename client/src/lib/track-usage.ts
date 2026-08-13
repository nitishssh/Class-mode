import { apiRequest } from "./queryClient";

/** Client events the server accepts (see server/routes/usage.ts allowlist). */
export type ViewFeature = "attendance_view" | "report_view" | "attendance_sync_recovered";

/**
 * Record a page-view feature_usage event. Fire-and-forget: never throws and
 * never blocks rendering — failures (offline, logged out, server down) are
 * swallowed to the console so instrumentation can never break a page.
 */
export function trackFeatureView(feature: ViewFeature): void {
  apiRequest("POST", "/api/usage", { feature }).catch((err) => {
    console.warn(`[usage] failed to record ${feature}:`, err);
  });
}
