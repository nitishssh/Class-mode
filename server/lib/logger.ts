/**
 * server/lib/logger.ts
 *
 * Centralized structured logging utility.
 *
 * In production this emits one JSON object per line to stdout/stderr, which
 * Cloud Run automatically forwards to Cloud Logging. Error-level entries are
 * shaped to match what GCP Error Reporting auto-detects from Cloud Logging
 * (https://cloud.google.com/error-reporting/docs/formatting-error-messages):
 *   - `severity: "ERROR"` (or higher)
 *   - a `message` field containing the error text *and* stack trace
 *   - a `serviceContext: { service, version }` field
 *   - `@type` set to the ReportedErrorEvent type, which is the documented way
 *     to opt an arbitrary log entry into Error Reporting even outside GAE/GCF
 *
 * This is a zero-new-vendor approach: no @google-cloud/error-reporting
 * dependency, no extra IAM/ADC setup, and no separate network call per error.
 * It works because Cloud Run already ships stdout/stderr to Cloud Logging —
 * we just need to emit the shape Error Reporting scans for.
 *
 * In non-production (local dev, tests) we keep human-readable text output
 * instead of raw JSON, since that's what a developer's terminal wants.
 *
 * Every log line automatically includes the current request's correlation
 * ID (see server/lib/request-context.ts) when called from within a request —
 * no call-site changes needed across the ~280 existing logger.* call sites.
 */
import { getRequestId } from "./request-context";

const SERVICE_NAME = process.env.K_SERVICE || process.env.npm_package_name || "eduai-api";
const SERVICE_VERSION = process.env.K_REVISION || process.env.npm_package_version || "unknown";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// The special @type GCP Error Reporting looks for on arbitrary (non-GAE/GCF)
// Cloud Logging entries. See:
// https://cloud.google.com/error-reporting/docs/formatting-error-messages
const ERROR_EVENT_TYPE =
  "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent";

type Severity = "INFO" | "WARNING" | "ERROR";

function baseFields(severity: Severity): Record<string, unknown> {
  const requestId = getRequestId();
  return {
    severity,
    timestamp: new Date().toISOString(),
    ...(requestId ? { requestId, "logging.googleapis.com/labels": { requestId } } : {}),
  };
}

function stringifyMeta(meta: unknown): string {
  if (meta === undefined) return "";
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

function emitStructured(entry: Record<string, unknown>, stream: "stdout" | "stderr") {
  const line = JSON.stringify(entry);
  if (stream === "stderr") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const logger = {
  info: (msg: string, meta?: unknown) => {
    const requestId = getRequestId();
    if (!IS_PRODUCTION) {
      const timestamp = new Date().toISOString();
      const tag = requestId ? ` [req:${requestId}]` : "";
      console.log(`[INFO] ${timestamp}${tag} - ${msg}`, meta ? stringifyMeta(meta) : "");
      return;
    }
    emitStructured({ ...baseFields("INFO"), message: msg, ...(meta ? { meta } : {}) }, "stdout");
  },

  warn: (msg: string, meta?: unknown) => {
    const requestId = getRequestId();
    if (!IS_PRODUCTION) {
      const timestamp = new Date().toISOString();
      const tag = requestId ? ` [req:${requestId}]` : "";
      console.warn(`[WARN] ${timestamp}${tag} - ${msg}`, meta ? stringifyMeta(meta) : "");
      return;
    }
    emitStructured({ ...baseFields("WARNING"), message: msg, ...(meta ? { meta } : {}) }, "stdout");
  },

  /**
   * Logs an error. `err` may be an Error, a plain object/string, or omitted.
   * In production, emits a Cloud-Logging/Error-Reporting-compatible JSON
   * entry to stderr: severity ERROR, a message that includes the stack
   * trace (required for Error Reporting's auto-detection), and
   * serviceContext identifying this service/version.
   */
  error: (msg: string, err?: unknown) => {
    const requestId = getRequestId();
    const errorDetail =
      err instanceof Error
        ? err.stack || err.message
        : err !== undefined
          ? stringifyMeta(err)
          : undefined;

    if (!IS_PRODUCTION) {
      const timestamp = new Date().toISOString();
      const tag = requestId ? ` [req:${requestId}]` : "";
      console.error(`[ERROR] ${timestamp}${tag} - ${msg}${errorDetail ? `\n${errorDetail}` : ""}`);
      return;
    }

    // Error Reporting requires the stack trace to be part of `message`.
    const fullMessage = errorDetail ? `${msg}\n${errorDetail}` : msg;

    emitStructured(
      {
        ...baseFields("ERROR"),
        message: fullMessage,
        "@type": ERROR_EVENT_TYPE,
        serviceContext: {
          service: SERVICE_NAME,
          version: SERVICE_VERSION,
        },
        context: requestId ? { requestId } : undefined,
      },
      "stderr"
    );
  },

  /**
   * Simple request logger middleware
   */
  requestLogger: (req: any, res: any, next: any) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api")) {
        logger.info(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
      }
    });
    next();
  },
};
