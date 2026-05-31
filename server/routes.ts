import express, { type Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { logger } from "./lib/logger";
import { authenticateToken, requireVerifiedEmail } from "./middleware";

// Route imports
import authRouter from "./routes/auth";
import onboardingRouter from "./routes/onboarding";
import workspaceRouter from "./routes/workspace";
import dynamicSisRouter from "./routes/dynamic-sis";
import lifecycleRouter from "./routes/lifecycle";
import healthRoutes from "./routes/health";
import gdprRoutes from "./routes/gdpr";
import billingRoutes from "./routes/billing";
import lmsRoutes from "./routes/lms";
import educatorRoutes from "./routes/educator";
import parentRoutes from "./routes/parent";
import gradingRoutes from "./routes/grading";
import aiClassroomRoutes from "./routes/ai-classroom";
import { liveRouter } from "./routes/live";
import messageRoutes from "./message/routes";

// Newly extracted domain-driven routers
import analyticsRouter from "./routes/analytics";
import testsRouter from "./routes/tests";
import usersRouter from "./routes/users";
import chatRouter from "./routes/chat";
import tasksRouter from "./routes/tasks";
import notificationsRouter from "./routes/notifications";
import ocrRouter from "./routes/ocr";
import uploadRouter from "./routes/upload";
import timetableRouter from "./routes/timetable";
import aiRouter from "./routes/ai";

// Shorthand: auth + verified email — used on all dashboard-level routes
const verifiedAuth = [authenticateToken, requireVerifiedEmail];

export async function registerRoutes(app: Express): Promise<Server> {
  // ── Global email-verification gate ─────────────────────────────────────────
  app.use("/api", (req: Request, res: Response, next: express.NextFunction) => {
    const EXEMPT = ["/api/auth/", "/api/health", "/api/invite/validate", "/api/invites/"];
    const isExempt = EXEMPT.some((p) => req.path.startsWith(p) || req.originalUrl.startsWith(p));
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
  app.use("/api/grading", ...verifiedAuth, gradingRoutes);
  app.use("/api/educator", ...verifiedAuth, educatorRoutes);
  app.use("/api/parent", ...verifiedAuth, parentRoutes);
  app.use("/api/billing", ...verifiedAuth, billingRoutes);
  app.use("/api/lms", ...verifiedAuth, lmsRoutes);
  app.use("/api/dynamic-sis", dynamicSisRouter);
  app.use("/api/lifecycle", authenticateToken, lifecycleRouter);
  app.use("/api/gdpr", gdprRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/onboarding", onboardingRouter);

  // Mount newly extracted domain routers
  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/tests", testsRouter);
  app.use("/api/timetable", timetableRouter);
  app.use("/api", aiRouter); // Handles /api/ai-chat
  app.use("/api", chatRouter); // Handles /workspaces, /channels, /messages, /chat
  app.use("/api/tasks", tasksRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/ocr", ocrRouter);
  app.use("/api/upload", uploadRouter);
  
  // Legacy Workspace v2 (must be last to catch generic /api routes if any)
  app.use("/api", workspaceRouter);

  const httpServer = createServer(app);
  return httpServer;
}
