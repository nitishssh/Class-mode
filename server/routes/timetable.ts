import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { 
  pgGetTimetableByWorkspace, 
  pgGetTimetableByClass, 
  pgCreateTimetableSlot, 
  pgDeleteTimetableSlot 
} from "../lib/pg-queries";
import { insertTimetableSlotSchema } from "@shared/schema";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/timetable — Get full workspace timetable (Admin/Teacher)
router.get("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const workspace = (req as any).workspace;
    if (!workspace?.id) return res.status(400).json({ message: "Workspace not found" });

    const timetable = await pgGetTimetableByWorkspace(workspace.id);
    res.json(timetable);
  } catch (error) {
    logger.error("[timetable/list] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to fetch timetable" });
  }
});

// GET /api/timetable/class/:className — Get class-specific timetable (Student/Teacher)
router.get("/class/:className", authenticateToken, async (req: Request, res: Response) => {
  try {
    const workspace = (req as any).workspace;
    const { className } = req.params;
    if (!workspace?.id) return res.status(400).json({ message: "Workspace not found" });

    const timetable = await pgGetTimetableByClass(workspace.id, className);
    res.json(timetable);
  } catch (error) {
    logger.error("[timetable/class] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to fetch class timetable" });
  }
});

// POST /api/timetable — Add a slot (Admin/Teacher)
router.post("/", authenticateToken, async (req: Request, res: Response) => {
  try {
    const workspace = (req as any).workspace;
    const userId = req.session!.userId;
    const role = req.session!.role;

    if (!["admin", "school_admin", "teacher", "principal"].includes(role || "")) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }

    if (!workspace?.id) return res.status(400).json({ message: "Workspace not found" });

    const data = insertTimetableSlotSchema.parse({
      ...req.body,
      workspaceId: workspace.id,
      teacherId: req.body.teacherId || userId,
    });

    const slot = await pgCreateTimetableSlot(data);
    res.status(201).json(slot);
  } catch (error: any) {
    logger.error("[timetable/create] Error", { error: String(error) });
    res.status(400).json({ message: error.message || "Failed to create timetable slot" });
  }
});

// DELETE /api/timetable/:id — Remove a slot
router.delete("/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    const workspace = (req as any).workspace;
    if (!workspace?.id) return res.status(400).json({ message: "Workspace not found" });

    const id = parseInt(req.params.id);
    const success = await pgDeleteTimetableSlot(id, workspace.id);

    if (!success) return res.status(404).json({ message: "Slot not found" });
    res.json({ message: "Slot deleted" });
  } catch (error) {
    logger.error("[timetable/delete] Error", { error: String(error) });
    res.status(500).json({ message: "Failed to delete slot" });
  }
});

export default router;
