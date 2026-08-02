import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { authenticateToken, requireVerifiedEmail } from "../middleware";

// Route imports
import authRouter from "./auth";
import onboardingRouter from "./onboarding";
import workspaceRouter from "./workspace";
import dynamicSisRouter from "./dynamic-sis";
import lifecycleRouter from "./lifecycle";
import healthRoutes from "./health";
import leadsRouter from "./leads";
import whatsappRoutes from "./whatsapp";
import attendanceRoutes from "./attendance";
import feesRoutes from "./fees";
import usageRoutes from "./usage";
import exportRoutes from "./export";
import gdprRoutes from "./gdpr";
import billingRoutes from "./billing";
import lmsRoutes from "./lms";
import educatorRoutes from "./educator";
import resourcesRoutes from "./resources";
import parentRoutes from "./parent";
import gradingRoutes from "./grading";
import aiClassroomRoutes from "./ai-classroom";
import studyArenaBetaRoutes from "./study-arena-beta";
import { liveRouter } from "./live";
import messageRoutes from "../message/routes";

// Newly extracted domain-driven routers
import analyticsRouter from "./analytics";
import testsRouter from "./tests";
import usersRouter from "./users";
import chatRouter from "./chat";
import tasksRouter from "./tasks";
import notificationsRouter from "./notifications";
import ocrRouter from "./ocr";
import uploadRouter from "./upload";
import timetableRouter from "./timetable";
import aiRouter from "./ai";

// Shorthand: auth + verified email — used on all dashboard-level routes
const verifiedAuth = [authenticateToken, requireVerifiedEmail];

export async function registerRoutes(app: Express): Promise<Server> {
  // ── Global email-verification gate ─────────────────────────────────────────
  app.use("/api", (req: Request, res: Response, next: express.NextFunction) => {
    const EXEMPT = ["/api/auth/", "/api/health", "/api/invite/validate", "/api/invites/"];
    const isExempt = EXEMPT.some((p) => req.path?.startsWith(p) || req.originalUrl?.startsWith(p));
    if (isExempt) return next();
    const user = (req as any).user;
    if (user && user.emailVerified === false) {
      return res.status(403).json({
        error: "Email verification required",
        message: "Please verify your email before accessing this resource.",
      });
    }
    return next();
  });

  // Mount existing routers
  app.use("/api/messagepal", messageRoutes);
  app.use("/api/live", ...verifiedAuth, liveRouter);
  app.use("/api/ai-classroom", aiClassroomRoutes);
  app.use("/api/study-arena-beta", studyArenaBetaRoutes);
  app.use("/api/grading", ...verifiedAuth, gradingRoutes);
  app.use("/api/educator", ...verifiedAuth, educatorRoutes);
  app.use("/api/resources", ...verifiedAuth, resourcesRoutes);
  app.use("/api/parent", ...verifiedAuth, parentRoutes);
  // Stripe posts to /api/billing/webhook with no app session/token, so it must
  // bypass verifiedAuth. Run the auth chain only for the other billing routes;
  // signature verification (in billing.ts) is what authenticates the webhook.
  app.use(
    "/api/billing",
    (req: Request, res: Response, next: express.NextFunction) => {
      if (req.path === "/webhook") return next();
      let i = 0;
      const runNext = (err?: unknown): void => {
        if (err) return next(err as any);
        const mw = verifiedAuth[i++];
        if (!mw) return next();
        mw(req, res, runNext);
      };
      runNext();
    },
    billingRoutes
  );
  app.use("/api/lms", ...verifiedAuth, lmsRoutes);
  app.use("/api/dynamic-sis", dynamicSisRouter);
  app.use("/api/lifecycle", authenticateToken, lifecycleRouter);
  app.use("/api/gdpr", gdprRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/leads", leadsRouter); // public landing-page contact form
  app.use("/api/whatsapp", whatsappRoutes); // public webhook (Meta calls it)
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/fees", feesRoutes);
  app.use("/api/usage", usageRoutes);
  app.use("/api/export", exportRoutes);
  app.use("/api/onboarding", onboardingRouter);

  // Mount newly extracted domain routers at /api root
  app.use("/api/auth", authRouter); // Supports /api/auth/*
  app.use("/api", authRouter); // Supports /api/* (login, signup, etc.)
  app.use("/api", usersRouter);
  app.use("/api", analyticsRouter);
  app.use("/api", testsRouter);
  app.use("/api/timetable", timetableRouter);
  app.use("/api", aiRouter); // Handles /api/ai-chat
  app.use("/api", chatRouter); // Handles /api/workspaces, /api/channels, /api/messages
  app.use("/api", tasksRouter);
  app.use("/api", notificationsRouter);
  app.use("/api/ocr", ocrRouter);
  app.use("/api/upload", uploadRouter);

  // Legacy Workspace v2 (must be last)
  app.use("/api", workspaceRouter);

  // Unmatched /api/* paths must 404 as JSON — never fall through to the SPA
  // catch-all, which returns index.html with a 200 and makes dead endpoints
  // look like successes to API clients.
  app.use("/api", (req: Request, res: Response) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  const httpServer = createServer(app);
  return httpServer;
}
