import "dotenv/config";
import { logger } from "./lib/logger";

// Prevent unhandled promise rejections from crashing the server
process.on("unhandledRejection", (reason: any) => {
  logger.error("[unhandledRejection] non-fatal:", reason);
});
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import path from "path";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic } from "./vite";
import { storage } from "./storage";
import { WebSocketServer, WebSocket } from "ws";
import { connectMongoDB } from "./db";
import { setupChatWebSocket } from "./chat-ws";
import { setupMessagePalWebSocket, startMessagePalServer } from "./message";
import { initCassandra } from "./lib/cassandra";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP handled by Vite in dev

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5001")
  .split(",")
  .map((o) => o.trim());
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin requests, static files, etc.)
      if (!origin) return cb(null, true);

      // Allow configured origins
      if (allowedOrigins.includes(origin)) return cb(null, true);

      // In production, also allow the deployment domain
      if (process.env.NODE_ENV === "production") {
        const url = new URL(origin);
        if (
          url.hostname.endsWith(".onrender.com") ||
          url.hostname === "inmodel.in" ||
          url.hostname.endsWith(".inmodel.in")
        ) {
          return cb(null, true);
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

// Initialize Databases
connectMongoDB();
initCassandra();

// Set up session middleware
if (!process.env.SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error(
    "SESSION_SECRET environment variable is required in production. Set it in your .env file."
  );
}

app.use(
  session({
    secret: process.env.SESSION_SECRET || "master-plan-ai-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    store: storage.sessionStore,
  })
);

app.use(logger.requestLogger);

// ── DB health guard ───────────────────────────────────────────────────────────
import { requireDb } from "./middleware";
app.use("/api", requireDb);

(async () => {
  const server = await registerRoutes(app);

  // Attach WebSocket servers
  setupChatWebSocket(server, storage.sessionStore);
  setupMessagePalWebSocket(server, storage.sessionStore);

  // Start Message HTTP server
  startMessagePalServer();

  // Serve static files BEFORE error handler
  if (app.get("env") === "development") {
    try {
      await setupVite(app, server);
    } catch (error) {
      if (error && (error as any).code === "ERR_MODULE_NOT_FOUND") {
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
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message =
      process.env.NODE_ENV === "production" && status === 500
        ? "Something went wrong"
        : err.message || "Internal Server Error";
    logger.error(`[${status}] ${req.method} ${req.path} — ${err.message}`);
    res.status(status).json({ error: message, code: err.code || null });
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
