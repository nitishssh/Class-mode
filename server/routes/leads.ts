import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getPgPool } from "../db-pg";
import { logger } from "../lib/logger";
import { sendLeadNotification } from "../lib/mailer";

const router = Router();

const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().default("");

// Mirrors the landing-page contact form: name is always required, and at
// least one of phone/email is needed so the team can actually reach out.
const LeadSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
    school: optionalTrimmed(200),
    email: optionalTrimmed(255),
    phone: optionalTrimmed(20),
    role: optionalTrimmed(50),
    message: optionalTrimmed(1000),
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "A phone number or email address is required",
      });
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Invalid email address",
      });
    }
  });

/**
 * POST /api/leads — public: persists a contact/pilot request from the
 * landing page and notifies the team by email.
 */
router.post("/", async (req: Request, res: Response) => {
  const parsed = LeadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(fieldErrors).flat()[0] ?? "Invalid submission";
    return res.status(400).json({ message: firstError, errors: fieldErrors });
  }

  const lead = parsed.data;
  try {
    const { rows } = await getPgPool().query(
      `INSERT INTO leads (name, school, email, phone, role, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        lead.name,
        lead.school || null,
        lead.email || null,
        lead.phone || null,
        lead.role || null,
        lead.message || null,
      ]
    );
    const leadId: number = rows[0].id;
    logger.info(`[leads] New contact lead #${leadId} (${lead.role || "role unspecified"})`);

    // Notify asynchronously — the lead is already persisted, so a mailer
    // failure must not turn the visitor's submission into an error.
    void sendLeadNotification({ id: leadId, ...lead }).catch((err) => {
      logger.error(`[leads] Failed to send notification email for lead #${leadId}:`, err);
    });

    return res
      .status(201)
      .json({ id: leadId, message: "Thanks! Our team will reach out within 24 hours." });
  } catch (err) {
    logger.error("[leads] Failed to persist contact lead:", err);
    return res
      .status(500)
      .json({ message: "Could not submit your message right now. Please try again." });
  }
});

export default router;
