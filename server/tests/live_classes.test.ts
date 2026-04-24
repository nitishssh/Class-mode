import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import session from "express-session";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

// ─── Mocks (factories must not reference outer variables) ─────────────────────

vi.mock("../services/daily", () => ({
  createRoom: vi.fn().mockResolvedValue({
    name: "class-mock-room-123",
    url: "https://test.daily.co/class-mock-room-123",
  }),
  createMeetingToken: vi.fn().mockResolvedValue("mock-daily-token"),
  getRecordings: vi
    .fn()
    .mockResolvedValue([{ id: "rec_123", duration: 3600, start_ts: Date.now() / 1000 }]),
  deleteRoom: vi.fn().mockResolvedValue({}),
}));

vi.mock("../chat-ws", () => ({
  broadcastGlobal: vi.fn(),
  setupChatWebSocket: vi.fn(),
}));

vi.mock("../lib/cassandra", () => ({
  initCassandra: vi.fn(),
  getCassandraClient: vi.fn().mockReturnValue(null),
}));

vi.mock("@shared/mongo-schema", () => ({
  MongoUser: {
    findOne: vi.fn().mockImplementation((query) => {
      if (query?.id === 1) return Promise.resolve({ id: 1, role: "teacher" });
      if (query?.id === 2) return Promise.resolve({ id: 2, role: "student" });
      if (query?.id === 99) return Promise.resolve({ id: 99, role: "teacher" });
      return Promise.resolve(null);
    }),
  },
  getNextSequenceValue: vi.fn(),
}));

vi.mock("../message", () => ({
  setupMessagePalWebSocket: vi.fn(),
  startMessagePalServer: vi.fn(),
}));

vi.mock("../lib/firebase-admin", () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getUser: vi.fn(),
    createLiveClass: vi.fn(),
    getLiveClass: vi.fn(),
    updateLiveClass: vi.fn(),
    getLiveClassesBySchoolAndClass: vi.fn(),
    createLiveSessionAttendance: vi.fn(),
    updateLiveSessionAttendance: vi.fn(),
    getWorkspaces: vi.fn().mockResolvedValue([]),
    getChannelsByWorkspace: vi.fn().mockResolvedValue([]),
  },
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const mockTeacher = {
  id: 1,
  username: "teacher1",
  name: "Test Teacher",
  email: "teacher@school.com",
  role: "teacher",
  status: "active",
  school_code: "SCH001",
  class: "10-A",
};

const mockStudent = {
  id: 2,
  username: "student1",
  name: "Test Student",
  email: "student@school.com",
  role: "student",
  status: "active",
  school_code: "SCH001",
  class: "10-A",
};

const baseClass = {
  id: 10,
  title: "Math Chapter 5",
  description: "Algebra basics",
  teacherId: 1,
  class: "10-A",
  scheduledTime: new Date(Date.now() + 3600_000),
  durationMinutes: 60,
  status: "scheduled",
  dailyRoomName: "class-mock-room-123",
  dailyRoomUrl: "https://test.daily.co/class-mock-room-123",
  startedAt: null,
  endedAt: null,
  recordingUrl: null,
  createdAt: new Date(),
};

const scheduledClass = { ...baseClass };
const liveClass = { ...baseClass, status: "live" };
const completedClass = {
  ...baseClass,
  status: "completed",
  recordingUrl: "https://cdn.daily.co/rec.mp4",
};

const mockAttendance = {
  id: 100,
  sessionId: 10,
  studentId: 2,
  joinedAt: new Date(),
  leftAt: null,
  durationMinutes: 0,
};

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { broadcastGlobal } from "../chat-ws";
import { createRoom, createMeetingToken, getRecordings } from "../services/daily";

// ─── Test app factory ─────────────────────────────────────────────────────────

/**
 * Builds an Express app with:
 * - A /test/set-user route to inject req.session.userId
 * - A Passport-compatible req.isAuthenticated() shim that reads session
 */
async function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));

  // Shim req.isAuthenticated() so the live router middleware doesn't throw
  app.use((req: any, _res: any, next: any) => {
    req.isAuthenticated = () => Boolean(req.session?.userId);
    next();
  });

  // Pre-auth helper — sets session without credentials
  app.post("/test/set-user", (req: any, res) => {
    req.session.userId = req.body.userId;
    const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_learning_pro_123";
    const token = jwt.sign({ userId: req.body.userId }, JWT_SECRET);
    res.cookie("access_token", token);
    res.json({ ok: true });
  });

  await registerRoutes(app);
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Live Classes API — /api/live", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (storage.getUser as ReturnType<typeof vi.fn>).mockImplementation((id: number) => {
      if (id === mockTeacher.id) return Promise.resolve(mockTeacher);
      if (id === mockStudent.id) return Promise.resolve(mockStudent);
      return Promise.resolve(undefined);
    });

    (storage.getLiveClass as ReturnType<typeof vi.fn>).mockResolvedValue({ ...scheduledClass });

    (storage.createLiveClass as ReturnType<typeof vi.fn>).mockImplementation((data: any) =>
      Promise.resolve({ id: 10, ...data, createdAt: new Date() })
    );

    (storage.updateLiveClass as ReturnType<typeof vi.fn>).mockImplementation(
      (id: number, update: any) => Promise.resolve({ ...scheduledClass, ...update })
    );

    (storage.createLiveSessionAttendance as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...mockAttendance,
    });

    (storage.updateLiveSessionAttendance as ReturnType<typeof vi.fn>).mockImplementation(
      (_id: number, update: any) => Promise.resolve({ ...mockAttendance, ...update })
    );

    (storage.getLiveClassesBySchoolAndClass as ReturnType<typeof vi.fn>).mockResolvedValue([
      { ...scheduledClass },
    ]);
  });

  // ── Schedule ──────────────────────────────────────────────────────────────

  describe("POST /api/live/schedule", () => {
    it("returns 401 when unauthenticated", async () => {
      const app = await buildApp();
      // No session set → unauthenticated
      const res = await request(app)
        .post("/api/live/schedule")
        .send({
          title: "Test",
          class: "10-A",
          scheduledTime: new Date(Date.now() + 3600_000).toISOString(),
          durationMinutes: 60,
        });
      expect(res.status).toBe(401);
    });

    it("creates room + class when a teacher schedules", async () => {
      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockTeacher.id });

      const res = await agent.post("/api/live/schedule").send({
        title: "Algebra Ch. 5",
        description: "Linear equations",
        class: "10-A",
        scheduledTime: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 60,
      });

      expect(res.status).toBe(201);
      expect(createRoom).toHaveBeenCalledTimes(1);
      expect(storage.createLiveClass).toHaveBeenCalledTimes(1);
      expect(res.body).toMatchObject({
        title: "Algebra Ch. 5",
        dailyRoomName: "class-mock-room-123",
        dailyRoomUrl: "https://test.daily.co/class-mock-room-123",
      });
    });

    it("returns 403 when a student tries to schedule", async () => {
      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });

      const res = await agent.post("/api/live/schedule").send({
        title: "Fake Class",
        class: "10-A",
        scheduledTime: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 60,
      });
      expect(res.status).toBe(403);
    });

    it("returns 400 for invalid input (missing title)", async () => {
      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockTeacher.id });

      const res = await agent.post("/api/live/schedule").send({
        class: "10-A",
        scheduledTime: new Date().toISOString(),
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ message: "Validation failed" });
    });
  });

  // ── Teacher Join ──────────────────────────────────────────────────────────

  describe("POST /api/live/join/teacher/:classId", () => {
    it("returns owner token and sets class to live", async () => {
      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockTeacher.id });

      const res = await agent.post("/api/live/join/teacher/10");

      expect(res.status).toBe(200);
      expect(createMeetingToken).toHaveBeenCalledWith(expect.objectContaining({ is_owner: true }));
      expect(storage.updateLiveClass).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: "live" })
      );
      expect(broadcastGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "live_class_event",
          action: "started",
        })
      );
      expect(res.body).toMatchObject({ token: "mock-daily-token" });
    });

    it("returns 403 when a different teacher tries to start", async () => {
      const impostor = { ...mockTeacher, id: 99 };
      (storage.getUser as ReturnType<typeof vi.fn>).mockResolvedValue(impostor);

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: 99 });

      const res = await agent.post("/api/live/join/teacher/10");
      expect(res.status).toBe(403);
    });
  });

  // ── Student Join ──────────────────────────────────────────────────────────

  describe("POST /api/live/join/student/:classId", () => {
    it("returns participant token + attendance record when class is live", async () => {
      (storage.getLiveClass as ReturnType<typeof vi.fn>).mockResolvedValue({ ...liveClass });

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });

      const res = await agent.post("/api/live/join/student/10");

      expect(res.status).toBe(200);
      expect(createMeetingToken).toHaveBeenCalledWith(expect.objectContaining({ is_owner: false }));
      expect(storage.createLiveSessionAttendance).toHaveBeenCalledTimes(1);
      expect(res.body).toMatchObject({ token: "mock-daily-token", attendanceId: 100 });
    });

    it("returns 400 when class is already completed", async () => {
      (storage.getLiveClass as ReturnType<typeof vi.fn>).mockResolvedValue({ ...completedClass });

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });

      const res = await agent.post("/api/live/join/student/10");
      expect(res.status).toBe(400);
    });
  });

  // ── Student Leave ─────────────────────────────────────────────────────────

  describe("POST /api/live/leave/student/:attendanceId", () => {
    it("sets leftAt and returns success", async () => {
      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });

      const res = await agent.post("/api/live/leave/student/100");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(storage.updateLiveSessionAttendance).toHaveBeenCalledWith(
        100,
        expect.objectContaining({ leftAt: expect.any(Date) })
      );
    });
  });

  // ── End Class ─────────────────────────────────────────────────────────────

  describe("POST /api/live/end/:classId", () => {
    it("marks class completed, fetches recordings, broadcasts ended", async () => {
      (storage.getLiveClass as ReturnType<typeof vi.fn>).mockResolvedValue({ ...liveClass });

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockTeacher.id });

      const res = await agent.post("/api/live/end/10");

      expect(res.status).toBe(200);
      expect(getRecordings).toHaveBeenCalled();
      expect(storage.updateLiveClass).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ status: "completed" })
      );
      expect(broadcastGlobal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "live_class_event",
          action: "ended",
        })
      );
      expect(res.body.success).toBe(true);
    });
  });

  // ── Upcoming List ─────────────────────────────────────────────────────────

  describe("GET /api/live/upcoming/:school/:class", () => {
    it("returns scheduled and live classes (excludes completed)", async () => {
      (storage.getLiveClassesBySchoolAndClass as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...scheduledClass },
        { ...liveClass, id: 11 },
        { ...completedClass, id: 12 },
      ]);

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });
      const res = await agent.get("/api/live/upcoming/SCH001/10-A");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const statuses: string[] = res.body.map((c: any) => c.status);
      expect(statuses).not.toContain("completed");
    });

    it("returns empty array when only completed classes exist", async () => {
      (storage.getLiveClassesBySchoolAndClass as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...completedClass },
      ]);

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });
      const res = await agent.get("/api/live/upcoming/SCH001/10-A");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  // ── Recordings ────────────────────────────────────────────────────────────

  describe("GET /api/live/recordings/:school/:class", () => {
    it("returns only completed classes with a recording URL", async () => {
      (storage.getLiveClassesBySchoolAndClass as ReturnType<typeof vi.fn>).mockResolvedValue([
        { ...completedClass },
        { ...completedClass, id: 11, recordingUrl: null }, // no URL yet
        { ...liveClass, id: 12 }, // not completed
      ]);

      const app = await buildApp();
      const agent = request.agent(app);
      await agent.post("/test/set-user").send({ userId: mockStudent.id });
      const res = await agent.get("/api/live/recordings/SCH001/10-A");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].recordingUrl).toBe("https://cdn.daily.co/rec.mp4");
    });
  });
});
