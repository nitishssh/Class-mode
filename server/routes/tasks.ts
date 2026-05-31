import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware";
import { storage } from "../storage";
import { insertTaskSchema, insertFocusSessionSchema } from "@shared/schema";

const router = Router();

// ─── Task routes ─────────────────────────────────────────────────────────

router.post("/tasks", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parseResult = insertTaskSchema.safeParse({ ...req.body, userId: req.session.userId });
    if (!parseResult.success) {
      return res
        .status(400)
        .json({ message: "Invalid input data", errors: parseResult.error.errors });
    }
    const task = await storage.createTask(parseResult.data);
    return res.status(201).json(task);
  } catch {
    res.status(500).json({ message: "Failed to create task" });
  }
});

router.get("/tasks", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const tasks = await storage.getTasksByUser(req.session.userId);
    return res.status(200).json(tasks);
  } catch {
    res.status(500).json({ message: "Failed to get tasks" });
  }
});

router.patch("/tasks/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }
    const parseResult = insertTaskSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({ message: "Invalid input data", errors: parseResult.error.errors });
    }
    const allUserTasks = await storage.getTasksByUser(req.session.userId);
    const ownedTask = allUserTasks.find((t) => t.id === taskId);
    if (!ownedTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    const updated = await storage.updateTask(taskId, parseResult.data, req.session.userId);
    if (updated === undefined) {
      return res.status(403).json({ message: "Forbidden: Not your task" });
    }
    return res.status(200).json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update task" });
  }
});

router.delete("/tasks/:id", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
      return res.status(400).json({ message: "Invalid task ID" });
    }
    const allUserTasks = await storage.getTasksByUser(req.session.userId);
    const ownedTask = allUserTasks.find((t) => t.id === taskId);
    if (!ownedTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    const deleted = await storage.deleteTask(taskId, req.session.userId);
    if (!deleted) {
      return res.status(403).json({ message: "Forbidden: Not your task" });
    }
    return res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to delete task" });
  }
});

// ─── Focus Session routes ─────────────────────────────────────────────────

router.post("/focus-sessions", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parseResult = insertFocusSessionSchema.safeParse({
      ...req.body,
      userId: req.session.userId,
    });
    if (!parseResult.success) {
      return res
        .status(400)
        .json({ message: "Invalid input data", errors: parseResult.error.errors });
    }
    const session = await storage.createFocusSession(parseResult.data);
    return res.status(201).json(session);
  } catch {
    return res.status(500).json({ message: "Failed to create focus session" });
  }
});

router.get("/focus-sessions", authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const sessions = await storage.getFocusSessionsByUser(req.session.userId);
    return res.status(200).json(sessions);
  } catch {
    return res.status(500).json({ message: "Failed to get focus sessions" });
  }
});

export default router;
