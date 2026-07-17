import { Router, Request, Response } from "express";
import { authenticateToken, requireRole } from "../middleware";
import { resolveTenantScope } from "../lib/tenant";
import { pgExportAttendanceRows, pgExportFeeRows } from "../lib/pg-queries";
import { logger } from "../lib/logger";

const router = Router();

/**
 * School data export (custodial baseline: "your data is yours, in Excel").
 * CSV with a UTF-8 BOM so Excel opens Devanagari/vernacular names correctly.
 * School-scoped; platform admin must name a school. Per spec E5 a query
 * failure is a 500 error, never a silently empty file.
 */

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Formula-injection guard (CWE-1236): these files are opened in Excel, so a
  // cell starting with = + - @ (or tab/CR) would execute as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvField).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function resolveExportScope(req: Request, res: Response): string | null {
  const user = (req as any).user;
  const t = resolveTenantScope(user);
  if ("error" in t) {
    res.status(t.error.status).json({ message: t.error.message });
    return null;
  }
  const schoolCode = t.scope.isPlatformAdmin
    ? String(req.query.schoolCode || "")
    : t.scope.schoolCode!;
  // Also guards the Content-Disposition filename this value is embedded in.
  if (!schoolCode || !/^[A-Za-z0-9_-]{1,64}$/.test(schoolCode)) {
    res.status(400).json({ message: "schoolCode is required" });
    return null;
  }
  return schoolCode;
}

/** Rejects well-formed-but-impossible dates (2026-02-31) that regexes let through. */
function isRealISODate(s: string): boolean {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
}

function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(csv);
}

/** GET /api/export/attendance.csv?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get(
  "/attendance.csv",
  authenticateToken,
  requireRole("admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const schoolCode = resolveExportScope(req, res);
    if (!schoolCode) return;

    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if ((from && !isRealISODate(from)) || (to && !isRealISODate(to))) {
      return res.status(400).json({ message: "from/to must be a real YYYY-MM-DD date" });
    }

    try {
      const rows = await pgExportAttendanceRows({
        schoolCode,
        from: from || undefined,
        to: to || undefined,
      });
      const csv = toCsv(
        ["Date", "Class", "Student", "Status", "Note", "Marked by"],
        rows.map((r) => [r.date, r.className, r.studentName, r.status, r.note, r.markedBy])
      );
      sendCsv(res, `attendance-${schoolCode}.csv`, csv);
    } catch (err) {
      logger.error("[export] attendance export failed", { err: String(err) });
      res.status(500).json({ message: "Export could not be generated" });
    }
  }
);

/** GET /api/export/fees.csv */
router.get(
  "/fees.csv",
  authenticateToken,
  requireRole("admin", "principal", "school_admin"),
  async (req: Request, res: Response) => {
    const schoolCode = resolveExportScope(req, res);
    if (!schoolCode) return;

    try {
      const rows = await pgExportFeeRows({ schoolCode });
      const csv = toCsv(
        [
          "Student",
          "Class",
          "Description",
          "Amount",
          "Currency",
          "Status",
          "Due date",
          "Paid at",
          "Created at",
        ],
        rows.map((r) => [
          r.studentName,
          r.className,
          r.description,
          (Number(r.amountCents) / 100).toFixed(2),
          r.currency,
          r.status,
          r.dueDate,
          r.paidAt,
          r.createdAt,
        ])
      );
      sendCsv(res, `fees-${schoolCode}.csv`, csv);
    } catch (err) {
      logger.error("[export] fees export failed", { err: String(err) });
      res.status(500).json({ message: "Export could not be generated" });
    }
  }
);

export default router;
