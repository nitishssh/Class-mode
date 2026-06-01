import { Router, Request, Response } from "express";
import {
  pgListBases,
  pgFindBaseById,
  pgCreateBase,
  pgUpdateBase,
  pgDeleteBase,
  pgListTables,
  pgFindTableById,
  pgCreateTable,
  pgUpdateTable,
  pgDeleteTable,
  pgListFields,
  pgFindFieldById,
  pgCreateField,
  pgUpdateField,
  pgDeleteField,
  pgListRecords,
  pgFindRecordById,
  pgCreateRecord,
  pgUpdateRecord,
  pgDeleteRecord,
  pgBulkCreateRecords,
  pgListViews,
  pgCreateView,
} from "../lib/pg-dynamic-sis";
import { dynamicEnrichmentService, DynamicEnrichmentService } from "../services/dynamic-enrichment";
import { whatsappService } from "../services/whatsapp";

import { pgFindWorkspaceMembership } from "../lib/pg-queries";
import { type WorkspaceRole } from "../lib/auth-workspace";
import {
  insertDynamicBaseSchema,
  insertDynamicTableSchema,
  insertDynamicFieldSchema,
  insertDynamicRecordSchema,
  insertDynamicViewSchema,
} from "@shared/schema";
import { authenticateToken } from "../middleware";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireWorkspacePermission(
  req: Request,
  res: Response,
  workspaceId: number,
  permission: "view" | "edit" | "admin"
): Promise<boolean> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Authentication required" });
    return false;
  }

  const membership = await pgFindWorkspaceMembership(workspaceId, userId);
  if (!membership) {
    res.status(403).json({ message: "Not a member of this workspace" });
    return false;
  }

  // Map our simple permission to the workspace roles
  // owner, admin -> all
  // co-teacher, teaching-assistant -> edit, view
  // member, auditor -> view
  const role = membership.role as WorkspaceRole;

  if (permission === "admin") {
    if (!["owner", "admin"].includes(role)) {
      res.status(403).json({ message: "Admin permission required" });
      return false;
    }
  } else if (permission === "edit") {
    if (!["owner", "admin", "co-teacher", "teaching-assistant"].includes(role)) {
      res.status(403).json({ message: "Edit permission required" });
      return false;
    }
  }
  // "view" is allowed for all members

  return true;
}

// ─── Bases ───────────────────────────────────────────────────────────────────

router.get(
  "/workspaces/:workspaceId/bases",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.workspaceId);
      if (!(await requireWorkspacePermission(req, res, workspaceId, "view"))) return;

      const bases = await pgListBases(workspaceId);
      res.json(bases);
    } catch (error) {
      logger.error("[dynamic-sis/bases] List error", { error: String(error) });
      res.status(500).json({ message: "Failed to list bases" });
    }
  }
);

router.post(
  "/workspaces/:workspaceId/bases",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.params.workspaceId);
      if (!(await requireWorkspacePermission(req, res, workspaceId, "admin"))) return;

      const parsed = insertDynamicBaseSchema.parse({ ...req.body, workspaceId });
      const base = await pgCreateBase(parsed);
      res.status(201).json(base);
    } catch (error) {
      logger.error("[dynamic-sis/bases] Create error", { error: String(error) });
      res.status(400).json({ message: "Invalid base data" });
    }
  }
);

router.get("/bases/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const base = await pgFindBaseById(id);
    if (!base) return res.status(404).json({ message: "Base not found" });

    if (!(await requireWorkspacePermission(req, res, base.workspaceId, "view"))) return;

    res.json(base);
  } catch (error) {
    logger.error("[dynamic-sis/bases] Get error", { error: String(error) });
    res.status(500).json({ message: "Failed to get base" });
  }
});

router.patch("/bases/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const base = await pgFindBaseById(id);
    if (!base) return res.status(404).json({ message: "Base not found" });

    if (!(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const updated = await pgUpdateBase(id, req.body);
    res.json(updated);
  } catch (error) {
    logger.error("[dynamic-sis/bases] Update error", { error: String(error) });
    res.status(500).json({ message: "Failed to update base" });
  }
});

router.delete("/bases/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const base = await pgFindBaseById(id);
    if (!base) return res.status(404).json({ message: "Base not found" });

    if (!(await requireWorkspacePermission(req, res, base.workspaceId, "admin"))) return;

    await pgDeleteBase(id);
    res.status(204).end();
  } catch (error) {
    logger.error("[dynamic-sis/bases] Delete error", { error: String(error) });
    res.status(500).json({ message: "Failed to delete base" });
  }
});

// ─── Tables ──────────────────────────────────────────────────────────────────

router.get("/bases/:baseId/tables", authenticateToken, async (req: Request, res: Response) => {
  try {
    const baseId = parseInt(req.params.baseId);
    const base = await pgFindBaseById(baseId);
    if (!base) return res.status(404).json({ message: "Base not found" });

    if (!(await requireWorkspacePermission(req, res, base.workspaceId, "view"))) return;

    const tables = await pgListTables(baseId);
    res.json(tables);
  } catch (error) {
    logger.error("[dynamic-sis/tables] List error", { error: String(error) });
    res.status(500).json({ message: "Failed to list tables" });
  }
});

router.post("/bases/:baseId/tables", authenticateToken, async (req: Request, res: Response) => {
  try {
    const baseId = parseInt(req.params.baseId);
    const base = await pgFindBaseById(baseId);
    if (!base) return res.status(404).json({ message: "Base not found" });

    if (!(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const parsed = insertDynamicTableSchema.parse({ ...req.body, baseId });
    const table = await pgCreateTable(parsed);
    res.status(201).json(table);
  } catch (error) {
    logger.error("[dynamic-sis/tables] Create error", { error: String(error) });
    res.status(400).json({ message: "Invalid table data" });
  }
});

router.patch("/tables/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const table = await pgFindTableById(id);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const updated = await pgUpdateTable(id, req.body);
    res.json(updated);
  } catch (error) {
    logger.error("[dynamic-sis/tables] Update error", { error: String(error) });
    res.status(500).json({ message: "Failed to update table" });
  }
});

router.delete("/tables/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const table = await pgFindTableById(id);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    await pgDeleteTable(id);
    res.status(204).end();
  } catch (error) {
    logger.error("[dynamic-sis/tables] Delete error", { error: String(error) });
    res.status(500).json({ message: "Failed to delete table" });
  }
});

// ─── Fields ──────────────────────────────────────────────────────────────────

router.get("/tables/:tableId/fields", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const table = await pgFindTableById(tableId);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "view"))) return;

    const fields = await pgListFields(tableId);
    res.json(fields);
  } catch (error) {
    logger.error("[dynamic-sis/fields] List error", { error: String(error) });
    res.status(500).json({ message: "Failed to list fields" });
  }
});

router.post("/tables/:tableId/fields", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const table = await pgFindTableById(tableId);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const parsed = insertDynamicFieldSchema.parse({ ...req.body, tableId });
    const field = await pgCreateField(parsed);
    res.status(201).json(field);
  } catch (error) {
    logger.error("[dynamic-sis/fields] Create error", { error: String(error) });
    res.status(400).json({ message: "Invalid field data" });
  }
});

router.patch("/fields/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const field = await pgFindFieldById(id);
    if (!field) return res.status(404).json({ message: "Field not found" });

    const table = await pgFindTableById(field.tableId);
    const base = table ? await pgFindBaseById(table.baseId) : null;
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const updated = await pgUpdateField(id, req.body);
    res.json(updated);
  } catch (error) {
    logger.error("[dynamic-sis/fields] Update error", { error: String(error) });
    res.status(500).json({ message: "Failed to update field" });
  }
});

router.delete("/fields/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const field = await pgFindFieldById(id);
    if (!field) return res.status(404).json({ message: "Field not found" });

    const table = await pgFindTableById(field.tableId);
    const base = table ? await pgFindBaseById(table.baseId) : null;
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    await pgDeleteField(id);
    res.status(204).end();
  } catch (error) {
    logger.error("[dynamic-sis/fields] Delete error", { error: String(error) });
    res.status(500).json({ message: "Failed to delete field" });
  }
});

// ─── Records ─────────────────────────────────────────────────────────────────

router.get("/tables/:tableId/records", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const table = await pgFindTableById(tableId);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "view"))) return;

    const records = await pgListRecords(tableId);
    res.json(records);
  } catch (error) {
    logger.error("[dynamic-sis/records] List error", { error: String(error) });
    res.status(500).json({ message: "Failed to list records" });
  }
});

router.post("/tables/:tableId/records", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const table = await pgFindTableById(tableId);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const parsed = insertDynamicRecordSchema.parse({ ...req.body, tableId });
    const record = await pgCreateRecord(parsed);

    // Trigger enrichments in background
    dynamicEnrichmentService.processRecord(record.id, tableId).catch((err) => {
      logger.error("[dynamic-sis/records] Background enrichment error", { err: String(err) });
    });

    res.status(201).json(record);
  } catch (error) {
    logger.error("[dynamic-sis/records] Create error", { error: String(error) });
    res.status(400).json({ message: "Invalid record data" });
  }
});

router.post(
  "/tables/:tableId/bulk-records",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const tableId = parseInt(req.params.tableId);
      const table = await pgFindTableById(tableId);
      if (!table) return res.status(404).json({ message: "Table not found" });

      const base = await pgFindBaseById(table.baseId);
      if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

      const { records } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ message: "Invalid bulk data (expected records array)" });
      }
      if (records.length > 5000) {
        return res.status(400).json({ message: "Batch too large (max 5000 records)" });
      }

      await pgBulkCreateRecords(tableId, records);
      res.status(201).json({ message: `Successfully imported ${records.length} records` });
    } catch (error) {
      logger.error("[dynamic-sis/records] Bulk create error", { error: String(error) });
      res.status(500).json({ message: "Failed to bulk import records" });
    }
  }
);

router.patch("/records/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const record = await pgFindRecordById(id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const table = await pgFindTableById(record.tableId);
    const base = table ? await pgFindBaseById(table.baseId) : null;
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const updated = await pgUpdateRecord(id, req.body);

    // Trigger enrichments in background
    dynamicEnrichmentService.processRecord(id, record.tableId).catch((err) => {
      logger.error("[dynamic-sis/records] Background enrichment error", { err: String(err) });
    });

    res.json(updated);
  } catch (error) {
    logger.error("[dynamic-sis/records] Update error", { error: String(error) });
    res.status(500).json({ message: "Failed to update record" });
  }
});

router.delete("/records/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const record = await pgFindRecordById(id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const table = await pgFindTableById(record.tableId);
    const base = table ? await pgFindBaseById(table.baseId) : null;
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    await pgDeleteRecord(id);
    res.status(204).end();
  } catch (error) {
    logger.error("[dynamic-sis/records] Delete error", { error: String(error) });
    res.status(500).json({ message: "Failed to delete record" });
  }
});

// ─── Actions ─────────────────────────────────────────────────────────────────

router.post(
  "/records/:id/whatsapp/:fieldId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id, fieldId } = req.params;
      const record = await pgFindRecordById(id);
      const field = await pgFindFieldById(parseInt(fieldId));

      if (!record || !field || field.tableId !== record.tableId) {
        return res.status(404).json({ message: "Record or field not found" });
      }

      const table = await pgFindTableById(record.tableId);
      const base = table ? await pgFindBaseById(table.baseId) : null;
      if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

      const phoneField = field.config?.phoneField as string;
      const template = field.config?.template as string;

      if (!phoneField || !template) {
        return res
          .status(400)
          .json({ message: "WhatsApp field not configured (missing phoneField or template)" });
      }

      const phone = record.data[phoneField];
      if (!phone) {
        return res.status(400).json({ message: `Phone number not found in field: ${phoneField}` });
      }

      // Interpolate template
      const body = DynamicEnrichmentService.interpolate(template, record.data);

      if (body.includes("{{")) {
        return res.status(400).json({ message: "Message template contains missing variables" });
      }

      const result = await whatsappService.sendMessage({ to: String(phone), body });

      if (result.success) {
        // Update record with status
        const timestamp = new Date().toLocaleString();
        await pgUpdateRecord(id, { [field.name]: `Sent at ${timestamp}` });
        res.json(result);
      } else {
        res.status(500).json({ message: result.error || "WhatsApp send failed" });
      }
    } catch (error) {
      logger.error("[dynamic-sis/whatsapp] Action error", { error: String(error) });
      res.status(500).json({ message: "Failed to send WhatsApp" });
    }
  }
);

// ─── Views ───────────────────────────────────────────────────────────────────

router.get("/tables/:tableId/views", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const table = await pgFindTableById(tableId);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "view"))) return;

    const views = await pgListViews(tableId);
    res.json(views);
  } catch (error) {
    logger.error("[dynamic-sis/views] List error", { error: String(error) });
    res.status(500).json({ message: "Failed to list views" });
  }
});

router.post("/tables/:tableId/views", authenticateToken, async (req: Request, res: Response) => {
  try {
    const tableId = parseInt(req.params.tableId);
    const table = await pgFindTableById(tableId);
    if (!table) return res.status(404).json({ message: "Table not found" });

    const base = await pgFindBaseById(table.baseId);
    if (!base || !(await requireWorkspacePermission(req, res, base.workspaceId, "edit"))) return;

    const parsed = insertDynamicViewSchema.parse({ ...req.body, tableId });
    const view = await pgCreateView(parsed);
    res.status(201).json(view);
  } catch (error) {
    logger.error("[dynamic-sis/views] Create error", { error: String(error) });
    res.status(400).json({ message: "Invalid view data" });
  }
});

export default router;
