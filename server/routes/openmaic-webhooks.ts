/**
 * server/routes/openmaic-webhooks.ts (LEGACY)
 *
 * This file is deprecated.
 */

import { Router } from "express";

export const openmaicWebhookRouter = Router();

openmaicWebhookRouter.all("*", (req, res) => {
  res.status(410).json({ message: "Legacy webhook endpoint retired." });
});
