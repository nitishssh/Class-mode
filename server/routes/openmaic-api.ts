/**
 * server/routes/openmaic-api.ts (LEGACY)
 *
 * This file is deprecated. All requests are now handled by the native Study Arena service.
 */

import { Router } from "express";

export const openmaicApiRouter = Router();

// Middleware to inform about deprecation
openmaicApiRouter.use((req, res, next) => {
  console.warn(`[DEPRECATED] OpenMAIC API called at ${req.path}. Use /api/ai-classroom instead.`);
  next();
});

openmaicApiRouter.all("*", (req, res) => {
  res.status(410).json({
    message: "The OpenMAIC API has been retired and replaced by the native Study Arena service.",
    nextSteps: "Please use the /api/ai-classroom endpoints for all AI classroom operations.",
    documentation: "See AGENTS.md for current integration details.",
  });
});
