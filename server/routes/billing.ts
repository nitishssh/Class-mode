import { Router, type Request, type Response } from "express";
import { authenticateToken } from "../routes";

const router = Router();

// ── Billing is not enabled ────────────────────────────────────────────────────
// Stripe integration has not been configured for this deployment.
// All billing endpoints return 503 until billing is set up.

function notEnabled(_req: Request, res: Response) {
  return res.status(503).json({
    error: "Billing not available",
    message: "Billing is not enabled on this platform yet.",
  });
}

router.get("/plans", notEnabled);
router.get("/subscription", authenticateToken, notEnabled);
router.post("/checkout", authenticateToken, notEnabled);
router.post("/portal", authenticateToken, notEnabled);
router.post("/webhook", notEnabled);
router.get("/usage", authenticateToken, notEnabled);

export default router;
