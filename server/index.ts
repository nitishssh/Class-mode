import "dotenv/config";
import dns from "node:dns";
// Fix SRV resolution errors by forcing Google DNS globally
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (e) {
  console.warn("Could not set DNS servers", e);
}

if (process.env.DNS_IPV4_FIRST === "true") {
  dns.setDefaultResultOrder("ipv4first");
}
import { logger } from "./lib/logger";

// Prevent unhandled promise rejections from crashing the server
process.on("unhandledRejection", (reason: unknown) => {
  logger.error("[unhandledRejection] non-fatal:", reason);
});
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { storage } from "./storage";
import { connectPostgres } from "./db-pg";
import { setupChatWebSocket } from "./chat-ws";
import { setupMessagePalWebSocket } from "./message";
import { initCassandra } from "./lib/cassandra";
import { checkFirebaseAdminReadiness } from "./lib/firebase-admin";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy:
      process.env.NODE_ENV === "production"
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://apis.google.com",
                "https://www.gstatic.com",
              ],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              imgSrc: [
                "'self'",
                "data:",
                "https://firebasestorage.googleapis.com",
                "https://lh3.googleusercontent.com",
              ],
              connectSrc: [
                "'self'",
                "https://*.firebaseio.com",
                "https://*.googleapis.com",
                "https://*.run.app",
              ],
              fontSrc: ["'self'", "https://fonts.gstatic.com"],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false, // CSP handled by Vite in dev
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
            url.hostname === "inmodel.in" ||
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
app.use(
  "/api/ai",
  rateLimit({ windowMs: 60_000, max: 20, message: { error: "Too many requests, slow down" } })
);
app.use(
  "/api/auth",
  rateLimit({ windowMs: 60_000, max: 10, message: { error: "Too many auth attempts" } })
);

// Serve uploaded files
app.use("/uploads", express.static(path.resolve("public", "uploads")));

// Check Firebase Admin readiness at startup
checkFirebaseAdminReadiness();

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
    store: storage.sessionStore,
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

// ── DB health guard ───────────────────────────────────────────────────────────
import { requireDb } from "./middleware";
app.use("/api", requireDb);

(async () => {
  // Initialize Database
  await connectPostgres();
  initCassandra();

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

  // Error handler must be LAST
  app.use(
    (
      err: { status?: number; statusCode?: number; message?: string; code?: string },
      req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      const status = err.status || err.statusCode || 500;
      const message =
        process.env.NODE_ENV === "production" && status === 500
          ? "Something went wrong"
          : err.message || "Internal Server Error";
      logger.error(`[${status}] ${req.method} ${req.path} — ${err.message}`);
      res.status(status).json({ error: message, code: err.code || null });
    }
  );

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
