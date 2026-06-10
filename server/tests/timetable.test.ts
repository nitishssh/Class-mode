import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import timetableRouter from "../routes/timetable";

vi.mock("../middleware", () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer invalid") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = { id: 1 };
    req.workspace = req.headers["x-workspace-id"]
      ? { id: parseInt(req.headers["x-workspace-id"]) }
      : null;
    next();
  },
}));

vi.mock("../lib/pg-queries", () => ({
  pgGetTimetableByWorkspace: vi.fn().mockResolvedValue([{
    id: 1,
    subject: "Math",
    room: null,
    day_of_week: 1,
    period_number: 1,
    class_name: "10A",
    teacher_id: 1,
    start_time: "08:00",
    end_time: "08:45",
    workspace_id: 1
  }]),
  pgGetTimetableByClass: vi.fn().mockResolvedValue([{
    id: 2,
    subject: "Science",
    room: null,
    day_of_week: 1,
    period_number: 2,
    class_name: "10A",
    teacher_id: 1,
    start_time: "08:45",
    end_time: "09:30",
    workspace_id: 1
  }]),
  pgCreateTimetableSlot: vi.fn().mockResolvedValue({
    id: 3,
    subject: "History",
    room: null,
    day_of_week: 1,
    period_number: 1,
    class_name: "10A",
    teacher_id: 1,
    start_time: "10:00",
    end_time: "11:00",
    workspace_id: 1
  }),
  pgDeleteTimetableSlot: vi.fn().mockImplementation(async (id) => id === 1),
}));

const app = express();
app.use(express.json());
app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
app.use((req: any, res, next) => {
  req.session.userId = 1;
  req.session.role = req.headers["x-role"] || "admin";
  next();
});
app.use("/api/timetable", timetableRouter);

describe("Timetable Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/timetable", () => {
    it("returns 400 if workspace not found", async () => {
      const res = await request(app).get("/api/timetable");
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Workspace not found");
    });

    it("returns timetable for workspace", async () => {
      const res = await request(app).get("/api/timetable").set("x-workspace-id", "1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{
        id: 1,
        subject: "Math",
        room: null,
        dayOfWeek: 1,
        periodNumber: 1,
        className: "10A",
        teacherId: 1,
        startTime: "08:00",
        endTime: "08:45",
        workspaceId: 1
      }]);
    });

    it("returns 500 on db error", async () => {
      const { pgGetTimetableByWorkspace } = await import("../lib/pg-queries");
      (pgGetTimetableByWorkspace as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app).get("/api/timetable").set("x-workspace-id", "1");
      expect(res.status).toBe(500);
    });
  });

  describe("GET /api/timetable/class/:className", () => {
    it("returns 400 if workspace not found", async () => {
      const res = await request(app).get("/api/timetable/class/10A");
      expect(res.status).toBe(400);
    });

    it("returns class timetable", async () => {
      const res = await request(app).get("/api/timetable/class/10A").set("x-workspace-id", "1");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{
        id: 2,
        subject: "Science",
        room: null,
        dayOfWeek: 1,
        periodNumber: 2,
        className: "10A",
        teacherId: 1,
        startTime: "08:45",
        endTime: "09:30",
        workspaceId: 1
      }]);
    });

    it("returns 500 on db error", async () => {
      const { pgGetTimetableByClass } = await import("../lib/pg-queries");
      (pgGetTimetableByClass as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app).get("/api/timetable/class/10A").set("x-workspace-id", "1");
      expect(res.status).toBe(500);
    });
  });

  describe("POST /api/timetable", () => {
    it("returns 403 if insufficient permissions", async () => {
      const res = await request(app).post("/api/timetable").set("x-role", "student");
      expect(res.status).toBe(403);
    });

    it("creates slot on success", async () => {
      const res = await request(app).post("/api/timetable").set("x-workspace-id", "1").send({
        className: "10A",
        subject: "History",
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: "10:00",
        endTime: "11:00",
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: 3,
        subject: "History",
        room: null,
        dayOfWeek: 1,
        periodNumber: 1,
        className: "10A",
        teacherId: 1,
        startTime: "10:00",
        endTime: "11:00",
        workspaceId: 1
      });
    });

    it("returns 400 if workspace not found", async () => {
      const res = await request(app).post("/api/timetable").send({
        className: "10A",
        subject: "History",
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: "10:00",
        endTime: "11:00",
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 on validation or db error", async () => {
      const { pgCreateTimetableSlot } = await import("../lib/pg-queries");
      (pgCreateTimetableSlot as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app).post("/api/timetable").set("x-workspace-id", "1").send({
        className: "10A",
        subject: "History",
        dayOfWeek: 1,
        periodNumber: 1,
        startTime: "10:00",
        endTime: "11:00",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/timetable/:id", () => {
    it("returns 404 if slot not found", async () => {
      const res = await request(app).delete("/api/timetable/999").set("x-workspace-id", "1");
      expect(res.status).toBe(404);
    });

    it("deletes slot successfully", async () => {
      const res = await request(app).delete("/api/timetable/1").set("x-workspace-id", "1");
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Slot deleted");
    });

    it("returns 400 if workspace not found", async () => {
      const res = await request(app).delete("/api/timetable/1");
      expect(res.status).toBe(400);
    });

    it("returns 500 on db error", async () => {
      const { pgDeleteTimetableSlot } = await import("../lib/pg-queries");
      (pgDeleteTimetableSlot as any).mockRejectedValueOnce(new Error("DB Error"));
      const res = await request(app).delete("/api/timetable/1").set("x-workspace-id", "1");
      expect(res.status).toBe(500);
    });
  });
});
