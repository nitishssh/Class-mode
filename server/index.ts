import "dotenv/config";
import dns from "node:dns";
import { logger } from "./lib/logger";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { productionCspDirectives } from "./lib/security/csp";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { storage } from "./storage";
import { connectPostgres } from "./db-pg";
import { connectRedis } from "./lib/db/redis";
import { startNotificationConsumers } from "./services/notifications-consumer";
import { startExpoPushSender } from "./services/expo-push-sender";
import { setupChatWebSocket } from "./chat-ws";
import { setupMessagePalWebSocket } from "./message";
import { initCassandra } from "./lib/db/cassandra";
import { healthcheck as aiHealthcheck } from "./lib/ai/gateway";
import { requireDb, requestId } from "./middleware";
import { ApiError } from "./lib/http-errors";

// Fix SRV resolution errors by forcing Google DNS globally
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (e) {
  console.warn("Could not set DNS servers", e);
}

if (process.env.DNS_IPV4_FIRST === "true") {
  dns.setDefaultResultOrder("ipv4first");
}

// Prevent unhandled promise rejections from crashing the server
process.on("unhandledRejection", (reason: unknown) => {
  logger.error("[unhandledRejection] non-fatal:", reason);
});

const app = express();
app.set("trust proxy", 1);

// Request-ID correlation must run before anything that logs, so every log
// line for this request (and the error-handler's JSON response) can be
// tied together and traced through Cloud Logging / Error Reporting.
app.use(requestId);

app.use(
  express.json({
    // Stash the raw request body for the Stripe webhook so signature
    // verification (stripe.webhooks.constructEvent) can run against the
    // exact bytes Stripe signed. express.json() otherwise consumes the
    // stream and only leaves the parsed object behind.
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      if (req.originalUrl?.startsWith("/api/billing/webhook")) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── Redirect to Canonical Domain ──────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === "production" && process.env.CANONICAL_DOMAIN) {
    const host = req.headers.host;
    if (host && host !== process.env.CANONICAL_DOMAIN) {
      return res.redirect(301, `https://${process.env.CANONICAL_DOMAIN}${req.originalUrl}`);
    }
  }
  next();
});
// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? { directives: { ...productionCspDirectives } }
        : false, // CSP handled by Vite in dev
    // Firebase signInWithPopup requires the popup to share an opener
    // context with the parent window so it can postMessage the credential
    // back. helmet's default of "same-origin" blocks that and Firebase
    // throws auth/popup-closed-by-user even when the user finished consent.
    // "same-origin-allow-popups" keeps process isolation while letting our
    // own popups talk to us — this is the setting Firebase + Google docs
    // recommend for OAuth flows.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5001,http://127.0.0.1:5001")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin requests, static files, etc.)
      if (!origin || app.get("env") === "development") return cb(null, true);

      // Check against configured allowed origins
      if (allowedOrigins.includes(origin)) return cb(null, true);

      // In production, strictly only allow specified domain patterns
      if (process.env.NODE_ENV === "production") {
        try {
          const url = new URL(origin);
          const isAllowedDomain =
            url.hostname === "classmode.com" ||
            url.hostname.endsWith(".classmode.com") ||
            url.hostname === "inmodel.in" ||
            url.hostname === "classmode.inmodel.in" ||
            url.hostname.endsWith(".inmodel.in") ||
            url.hostname.endsWith(".run.app") ||
            process.env.ALLOWED_PROD_DOMAINS?.split(",").includes(url.hostname);

          if (isAllowedDomain) return cb(null, true);
        } catch {
          // Fall through to error
        }
      }

      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Database outages should return 503 before auth rate limiting consumes attempts.
app.use("/api", requireDb);

app.use(
  "/api/ai",
  rateLimit({ windowMs: 60_000, max: 20, message: { error: "Too many requests, slow down" } })
);
app.use(
  "/api/auth",
  rateLimit({
    windowMs: 60_000,
    max: 10,
    message: { error: "Too many auth attempts" },
    // Skip the global auth rate limit in any non-prod environment so
    // developers (and React StrictMode's double-mounting) don't keep
    // tripping it during normal testing. The per-route limiters inside
    // server/routes/auth.ts (signupLimiter, loginLimiter, etc.) still
    // give us per-action brute-force protection in dev.
    //
    // /me, /refresh and /login are exempt: they carry their own protection,
    // and a school's worth of mobile devices shares one NAT IP — 30 teachers
    // cold-starting the app at 8:55am would trip a 10/min/IP limit on
    // infrastructure, not abuse (W-1). /me and /refresh are token-level;
    // /login is covered by loginLimiter (email+IP, brute force) and
    // loginIpLimiter (per-IP, credential stuffing) in routes/auth.ts, both of
    // which sit above a whole school signing in within the same minute.
    skip: (req) =>
      process.env.NODE_ENV !== "production" ||
      req.path === "/me" ||
      req.path === "/refresh" ||
      req.path === "/login",
  })
);

// Serve uploaded files
app.use("/uploads", express.static(path.resolve("public", "uploads")));

// Set up session middleware
const SESSION_SECRET = process.env.SESSION_SECRET || "class-mode-secret-key";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "class-mode-secret-key")
) {
  throw new Error(
    "A strong, unique SESSION_SECRET environment variable is required in production."
  );
}

// storage.sessionStore is connect-pg-simple against POSTGRESQL_URL. That is
// the wrong store for ENABLE_DEV_AUTH_WITHOUT_DB, whose entire purpose is to
// run auth with no reachable database: login and signup both call
// req.session.regenerate(), which would then block on a Postgres connection
// that is never going to succeed, and the request hangs forever rather than
// failing. Fall back to express-session's in-memory store, which is what
// omitting `store` selects.
//
// Gated on NODE_ENV plus the explicit opt-in — the same two conditions
// requireDb uses — so production can never reach it. Deliberately NOT gated on
// isPgReady(): the pool has not finished its first connection attempt when
// this middleware is registered. If the database turns out to be up after all,
// the only consequence is that sessions live in process memory for this run.
const useMemorySessionStore =
  process.env.NODE_ENV !== "production" && process.env.ENABLE_DEV_AUTH_WITHOUT_DB === "true";
if (useMemorySessionStore) {
  logger.warn(
    "[session] ENABLE_DEV_AUTH_WITHOUT_DB is set — using in-memory session store. " +
      "Sessions will not survive a restart and are not shared between processes."
  );
}

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    ...(useMemorySessionStore ? {} : { store: storage.sessionStore }),
  })
);

app.use(logger.requestLogger);

// ── Rate limiting (Additional) ───────────────────────────────────────────────
app.use(
  "/api/upload",
  rateLimit({ windowMs: 15 * 60_000, max: 10, message: { error: "Too many uploads, please wait" } })
);
app.use(
  "/api/ocr",
  rateLimit({ windowMs: 60_000, max: 5, message: { error: "Too many OCR requests" } })
);
app.use(
  "/api/leads",
  rateLimit({
    windowMs: 60_000,
    max: 5,
    message: { error: "Too many submissions, please try again in a minute" },
  })
);
app.use(
  "/api/export",
  // Full-history CSVs are built in memory — without a limiter a single staff
  // token could hammer multi-year exports concurrently and exhaust the heap.
  rateLimit({ windowMs: 60_000, max: 10, message: { error: "Too many export requests" } })
);
app.use(
  "/api/usage",
  // View events fire once per page visit; anything faster is a bug or metric
  // inflation. Proper per-user/feature/day dedupe is tracked in TODOS.md.
  rateLimit({ windowMs: 60_000, max: 30, message: { error: "Too many usage events" } })
);

// ── DB health guard ───────────────────────────────────────────────────────────
(async () => {
  // Initialize Database
  await connectPostgres();
  await initCassandra();

  // Redis (cache + BullMQ + event bus) — no-op when REDIS_URL is unset.
  await connectRedis();

  // Event consumers (durable absence notifications). No-op without Redis —
  // the attendance route falls back to inline sends.
  if (startNotificationConsumers()) {
    logger.info("[events] notification consumers started");
  }
  if (startExpoPushSender()) {
    logger.info("[expo-push] sender started");
  }

  // Surface a missing/blocked Gemini key at boot with an actionable message
  // instead of an opaque 403 deep inside a feature. Fire-and-forget — never
  // blocks startup.
  void aiHealthcheck();

  // Start AI Job Workers (Study Arena classroom + lesson compiler)
  import("./services/study-arena/job-queue")
    .then(({ classroomWorker }) => {
      if (classroomWorker) logger.info("[StudyArena] Worker initialized");
    })
    .catch((err) => {
      logger.error("[StudyArena] Failed to initialize worker:", err);
    });
  import("./services/study-arena/lesson-compiler")
    .then(({ lessonCompileWorker }) => {
      if (lessonCompileWorker) logger.info("[StudyArena] Lesson compiler worker initialized");
    })
    .catch((err) => {
      logger.error("[StudyArena] Failed to initialize lesson compiler worker:", err);
    });

  // Start SIS Automation Workers (needs Redis; scheduleAtRiskChecks no-ops without it)
  import("./services/whatsapp-automation")
    .then(({ automationWorker, scheduleAtRiskChecks }) => {
      if (!automationWorker) return;
      logger.info("[SIS Automation] Worker initialized");
      // scheduleAtRiskChecks also self-gates on this flag (defense in depth);
      // skipping here avoids an hourly no-op and makes the off state visible.
      if (process.env.WHATSAPP_ALERTS_ENABLED !== "true") {
        logger.info(
          "[SIS Automation] WHATSAPP_ALERTS_ENABLED is not 'true' — automated at-risk nudges disabled"
        );
        return;
      }
      // #324.1: both calls used to be floating promises, so a failure inside
      // the scheduler surfaced as a bare [unhandledRejection] with no route
      // context and at-risk detection stayed dead until someone read the logs
      // by hand. Catch per run: the failure is named and loud, and one bad run
      // no longer decides whether the next one happens.
      const runAtRiskChecks = () =>
        scheduleAtRiskChecks().catch((err) =>
          logger.error("[SIS Automation] at-risk check failed", { error: String(err) })
        );

      // Run initial check and then every hour
      void runAtRiskChecks();
      setInterval(runAtRiskChecks, 60 * 60 * 1000);
    })
    .catch((err) => {
      logger.error("[SIS Automation] Failed to initialize worker:", err);
    });

  const server = await registerRoutes(app);

  // Attach WebSocket servers
  setupChatWebSocket(server, storage.sessionStore);
  setupMessagePalWebSocket(server, storage.sessionStore);

  // Serve static files BEFORE error handler
  if (app.get("env") === "development") {
    try {
      await setupVite(app, server);
    } catch (error) {
      if (error && (error as { code?: string }).code === "ERR_MODULE_NOT_FOUND") {
        logger.info("Vite not found. Assuming production mode and falling back to static serving.");
        serveStatic(app);
      } else {
        throw error;
      }
    }
  } else {
    serveStatic(app);
  }

  // ── Centralized error handler (must be LAST, and must keep 4 args) ─────────
  // Almost all routes still catch their own errors and reply directly with
  // `{ message }` / `{ error }` shapes (unchanged, out of scope here). This
  // handler is the fallback for anything that reaches `next(err)` or throws
  // past a route/middleware — unknown errors, ApiError instances thrown by
  // newer code, and framework-level failures (e.g. body-parser, CORS). It
  // always logs the full error server-side, but only ever returns a single,
  // consistent, client-safe JSON shape: `{ error: { message, code?, requestId? } }`.
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    // Let Express's built-in handler deal with it if headers are already
    // out the door — writing a second response would throw ERR_HTTP_HEADERS_SENT.
    if (res.headersSent) {
      return next(err);
    }

    const asHttpError = err as {
      status?: number;
      statusCode?: number;
      message?: string;
      code?: string;
      stack?: string;
    };
    const status =
      err instanceof ApiError
        ? err.statusCode
        : asHttpError?.status || asHttpError?.statusCode || 500;
    const isServerError = status >= 500;
    const code = err instanceof ApiError ? err.code : asHttpError?.code;

    // Pass the original error (not just its message) so the stack trace
    // reaches the logger — required for GCP Error Reporting's
    // auto-detection, and useful for local debugging either way.
    logger.error(`[${status}] ${req.method} ${req.path}`, err);

    // Never leak stack traces or internal error details to the client. In
    // production, unexpected 500s get a generic message; operational
    // errors (4xx, or an explicit ApiError) already have a client-safe
    // message and are passed through as-is.
    const message =
      isServerError && process.env.NODE_ENV === "production"
        ? "Something went wrong"
        : asHttpError?.message || "Internal Server Error";

    res.status(status).json({
      error: {
        message,
        ...(code ? { code } : {}),
        ...(req.id ? { requestId: req.id } : {}),
      },
    });
  });

  // Use port strictly if provided by Render/environment, otherwise default to 5001
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5001", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      logger.info(`serving on port ${port}`);
    }
  );
})();
