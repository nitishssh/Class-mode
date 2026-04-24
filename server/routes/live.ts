import { Router } from "express";
import { storage } from "../storage";
import { insertLiveClassSchema, insertLiveSessionAttendanceSchema } from "@shared/schema";
import { createRoom, createMeetingToken, getRecordings, deleteRoom } from "../services/daily";
import { broadcastGlobal } from "../chat-ws";
import { z } from "zod";

import { User } from "@shared/schema";

export const liveRouter = Router();

// Middleware to ensure user is authenticated and map to req.user
liveRouter.use(async (req: any, res, next) => {
  try {
    const isPassportAuth = typeof req.isAuthenticated === "function" && req.isAuthenticated();
    const hasSession = !!req.session?.userId;

    if (!isPassportAuth && !hasSession) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Attach user to req from session if it exists
    if (hasSession) {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      req.user = user;
    }

    next();
  } catch (err) {
    console.error("[live] Auth middleware error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Middleware to ensure user is a teacher (or admin)
const requireTeacher = (req: any, res: any, next: any) => {
  if (req.user?.role !== "teacher" && req.user?.role !== "admin") {
    return res.status(403).json({ message: "Forbidden - Teacher access required" });
  }
  next();
};

/**
 * @route POST /api/live/schedule
 * @desc Teacher schedules a new live class and creates a Daily.co room
 */
liveRouter.post("/schedule", requireTeacher, async (req, res) => {
  try {
    const rawData = {
      ...req.body,
      teacherId: (req as any).user.id,
      scheduledTime: new Date(req.body.scheduledTime),
    };

    const parsedData = insertLiveClassSchema.parse(rawData);

    // Ensure scheduledTime is a Date object
    const scheduledDate = new Date(parsedData.scheduledTime);

    // Create a room in Daily.co
    const roomName = `class-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const dailyRoom = await createRoom({
      name: roomName,
      properties: {
        max_participants: 50,
        enable_knocking: true, // students wait for admission
        enable_recording: "cloud",
        start_video_off: true,
        start_audio_off: true,
        exp: Math.floor(scheduledDate.getTime() / 1000) + parsedData.durationMinutes * 60 + 3600, // Expire 1 hour after class ends
      },
    });

    // Save class to our DB
    const liveClass = await storage.createLiveClass({
      ...parsedData,
      dailyRoomName: dailyRoom.name,
      dailyRoomUrl: dailyRoom.url,
      status: "scheduled",
    });

    res.status(201).json(liveClass);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: "Validation failed", errors: err.errors });
    }
    console.error("Live schedule error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/live/join/teacher/:classId
 * @desc Teacher joins the class, makes it 'live', gets owner token
 */
liveRouter.post("/join/teacher/:classId", requireTeacher, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const liveClass = await storage.getLiveClass(classId);

    if (!liveClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    const user = (req as any).user;
    if (liveClass.teacherId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "You are not the teacher of this class" });
    }

    // Update status to live if not already
    if (liveClass.status === "scheduled") {
      await storage.updateLiveClass(classId, { status: "live", startedAt: new Date() });

      // Broadcast 'live_class_event' via WebSockets
      broadcastGlobal({
        type: "live_class_event",
        classId,
        action: "started",
        triggeredBy: { userId: user.id, displayName: user.name || "Teacher" },
      });
    }

    // Generate Owner Token
    const token = await createMeetingToken({
      room_name: liveClass.dailyRoomName!,
      is_owner: true,
      user_name: user.name || "Teacher",
      user_id: user.id.toString(),
    });

    res.json({ token, roomUrl: liveClass.dailyRoomUrl });
  } catch (err) {
    console.error("Teacher join error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/live/join/student/:classId
 * @desc Student joins the live class, gets participant token
 */
liveRouter.post("/join/student/:classId", async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const liveClass = await storage.getLiveClass(classId);

    if (!liveClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    if (liveClass.status === "completed" || liveClass.status === "cancelled") {
      return res.status(400).json({ message: "This class has already ended" });
    }

    // Generate Participant Token
    const user = (req as any).user;
    const token = await createMeetingToken({
      room_name: liveClass.dailyRoomName!,
      is_owner: false,
      user_name: user.name || "Student",
      user_id: user.id.toString(),
    });

    // Record attendance joined
    const attendance = await storage.createLiveSessionAttendance({
      sessionId: liveClass.id,
      studentId: user.id,
      joinedAt: new Date(),
      durationMinutes: 0, // Will be updated when leaving
    });

    res.json({ token, roomUrl: liveClass.dailyRoomUrl, attendanceId: attendance.id });
  } catch (err) {
    console.error("Student join error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/live/leave/student/:attendanceId
 * @desc Student leaves, mark leftAt time
 */
liveRouter.post("/leave/student/:attendanceId", async (req, res) => {
  try {
    const attendanceId = parseInt(req.params.attendanceId);

    // We ideally should query the attendance to calculate duration, but for now we just mark left
    // A complete implementation would fetch the attendance, calc diff between joinedAt and now, and set duration
    await storage.updateLiveSessionAttendance(attendanceId, {
      leftAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Student leave error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route POST /api/live/end/:classId
 * @desc Teacher ends the class. Sets status, fetches recording URLs.
 */
liveRouter.post("/end/:classId", requireTeacher, async (req, res) => {
  try {
    const classId = parseInt(req.params.classId);
    const liveClass = await storage.getLiveClass(classId);

    if (!liveClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    const user = (req as any).user;
    if (liveClass.teacherId !== user.id && user.role !== "admin") {
      return res.status(403).json({ message: "Permission denied" });
    }

    // Try to get recordings from Daily.co
    let recordingUrl = null;
    try {
      if (liveClass.dailyRoomName) {
        const recordings = await getRecordings(liveClass.dailyRoomName);
        if (recordings && recordings.length > 0) {
          // Provide the first/latest recording
          recordingUrl = recordings[0].id;
        }
      }
    } catch (err: any) {
      console.warn("Could not fetch recordings immediately:", err.message);
    }

    await storage.updateLiveClass(classId, {
      status: "completed",
      endedAt: new Date(),
      recordingUrl: recordingUrl,
    });

    // Broadcast 'class_ended' via WebSockets to force students out
    broadcastGlobal({
      type: "live_class_event",
      classId,
      action: "ended",
      triggeredBy: { userId: user.id, displayName: user.name || "Teacher" },
    });

    res.json({ success: true, recordingUrl });
  } catch (err) {
    console.error("Teacher end class error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/live/upcoming/:school/:class
 * @desc Get upcoming/live classes for a specific grade/school
 */
liveRouter.get("/upcoming/:school/:class", async (req, res) => {
  try {
    // In actual implementation we use the schoolCode and matching class properly.
    // Right now storage filters by class only for simplicity.
    const className = req.params.class;

    // Using simple find for now - should ideally filter in DB
    const classes = await storage.getLiveClassesBySchoolAndClass(req.params.school, className);

    const upcoming = classes.filter((c) => c.status === "scheduled" || c.status === "live");
    res.json(upcoming);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * @route GET /api/live/recordings/:school/:class
 * @desc Get past classes with recordings
 */
liveRouter.get("/recordings/:school/:class", async (req, res) => {
  try {
    const className = req.params.class;

    const classes = await storage.getLiveClassesBySchoolAndClass(req.params.school, className);

    const recorded = classes.filter((c) => c.status === "completed" && c.recordingUrl);
    res.json(recorded);
  } catch (err) {
    res.status(500).json({ message: "Internal server error" });
  }
});
