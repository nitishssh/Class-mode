import { Router, Request, Response } from "express";
import { pgGetResources } from "../lib/db/pg-queries";
import { logger } from "../lib/logger";

const router = Router();

const mapResource = (r: {
  id: number;
  title: string;
  description: string | null;
  type: string;
  subject: string | null;
  topic: string | null;
  url: string | null;
}) => ({
  id: r.id,
  title: r.title,
  description: r.description ?? "",
  type: r.type,
  subject: r.subject ?? null,
  topic: r.topic ?? null,
  url: r.url ?? null,
});

/**
 * GET /api/resources?topic=&subject=&type=
 * Lists learning resources for the Learn hub's Read tab. Filters are optional;
 * with none, returns the most recent resources.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : undefined;
    const subject = typeof req.query.subject === "string" ? req.query.subject.trim() : undefined;
    const type = typeof req.query.type === "string" ? req.query.type.trim() : undefined;

    const rows = await pgGetResources({
      topic: topic || undefined,
      subject: subject || undefined,
      type: type || undefined,
    });
    res.json({ resources: rows.map(mapResource), total: rows.length });
  } catch (err) {
    logger.error("[resources] list failed", { err: String(err) });
    res.status(500).json({ message: "Failed to load resources" });
  }
});

export default router;
