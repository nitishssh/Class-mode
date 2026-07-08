import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken, requireRole } from "../middleware";
import { resolveTenantScope } from "../lib/tenant";
import {
  pgCreateFee,
  pgGetFees,
  pgGetFeeById,
  pgMarkFeePaid,
  pgGetFeeSummary,
  pgTrackFeatureUsage,
  pgFindUserById,
  type FeeStatus,
} from "../lib/pg-queries";
import { whatsappService } from "../services/whatsapp";
import { publishEvent } from "../lib/events";

const router = Router();

const admins = ["admin", "principal", "school_admin"] as const;

const CreateFeeSchema = z.object({
  studentId: z.number().int().positive(),
  description: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function formatAmount(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

/** POST /api/fees — create a fee for a student (tenant-scoped, fail-closed). */
router.post("/", authenticateToken, requireRole(...admins), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const t = resolveTenantScope(user);
  if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

  const parsed = CreateFeeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten().fieldErrors });

  // W-6: the fee must target a student of the requester's school — otherwise a
  // school admin could attach fees to another school's students.
  const student = await pgFindUserById(parsed.data.studentId);
  if (!student || student.role !== "student") {
    return res.status(404).json({ message: "Student not found" });
  }
  if (!t.scope.isPlatformAdmin && student.schoolCode !== t.scope.schoolCode) {
    return res.status(403).json({ message: "Forbidden: student belongs to another school" });
  }

  const schoolCode = t.scope.isPlatformAdmin ? (user.school_code ?? null) : t.scope.schoolCode!;
  const id = await pgCreateFee({
    studentId: parsed.data.studentId,
    schoolCode,
    description: parsed.data.description,
    amountCents: parsed.data.amountCents,
    currency: parsed.data.currency,
    dueDate: parsed.data.dueDate ?? null,
    createdBy: user.id,
  });
  if (!id) return res.status(500).json({ message: "Failed to create fee" });

  pgTrackFeatureUsage({ feature: "fees", userId: user.id, schoolCode });
  publishEvent("fee.created", {
    schoolCode,
    userId: user.id,
    payload: { feeId: id, studentId: parsed.data.studentId, amountCents: parsed.data.amountCents },
  });
  res.status(201).json({ id, status: "pending" });
});

/** GET /api/fees?status=&studentId= — list fees for the requester's school. */
router.get("/", authenticateToken, requireRole(...admins), async (req: Request, res: Response) => {
  const user = (req as any).user;
  const t = resolveTenantScope(user);
  if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

  const status = req.query.status ? (String(req.query.status) as FeeStatus) : undefined;
  if (status && !["pending", "paid", "waived"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const studentId = req.query.studentId ? parseInt(String(req.query.studentId), 10) : undefined;

  const fees = await pgGetFees({
    schoolCode: t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode,
    studentId: studentId && !isNaN(studentId) ? studentId : undefined,
    status,
  });
  res.json(fees);
});

/** GET /api/fees/summary — pending vs paid totals for the requester's school. */
router.get(
  "/summary",
  authenticateToken,
  requireRole(...admins),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const summary = await pgGetFeeSummary({
      schoolCode: t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode,
    });
    res.json(summary);
  }
);

/** POST /api/fees/:id/mark-paid — settle a fee (scoped to the admin's school). */
router.post(
  "/:id/mark-paid",
  authenticateToken,
  requireRole(...admins),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid fee id" });

    const ok = await pgMarkFeePaid(id, t.scope.isPlatformAdmin ? undefined : t.scope.schoolCode);
    if (!ok)
      return res
        .status(404)
        .json({ message: "Fee not found, not in your school, or already paid" });
    publishEvent("fee.paid", {
      schoolCode: t.scope.isPlatformAdmin ? null : t.scope.schoolCode!,
      userId: user.id,
      payload: { feeId: id },
    });
    res.json({ success: true });
  }
);

/**
 * POST /api/fees/:id/remind — send a WhatsApp fee reminder (ties B1 fees to the
 * #213 WhatsApp channel). Recipient phone is provided in the body; the fee must
 * belong to the requester's school.
 */
router.post(
  "/:id/remind",
  authenticateToken,
  requireRole(...admins),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const t = resolveTenantScope(user);
    if ("error" in t) return res.status(t.error.status).json({ message: t.error.message });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid fee id" });
    const phone = String(req.body?.phone || "");
    if (!phone) return res.status(400).json({ message: "phone is required" });

    const fee = await pgGetFeeById(id);
    if (!fee) return res.status(404).json({ message: "Fee not found" });
    if (!t.scope.isPlatformAdmin && fee.schoolCode !== t.scope.schoolCode) {
      return res.status(403).json({ message: "Forbidden: fee belongs to another school" });
    }

    const amount = formatAmount(Number(fee.amountCents), fee.currency);
    const due = fee.dueDate ? ` (due ${String(fee.dueDate).slice(0, 10)})` : "";
    const body = `Fee reminder for ${fee.studentName}: ${fee.description} — ${amount}${due}. Please complete the payment.`;

    const result = await whatsappService.sendMessage({ to: phone, body });
    if (!result.success)
      return res.status(502).json({ message: "Failed to send reminder", error: result.error });
    res.json({ success: true, simulated: result.simulated ?? false });
  }
);

export default router;
