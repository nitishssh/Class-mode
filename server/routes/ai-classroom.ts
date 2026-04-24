/**
 * AI Classroom Routes
 * Endpoints for Study Arena integration
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { getStudyArenaClient } from "../services/study-arena-client";
import { MongoAIClassroom, getNextSequenceValue } from "../../shared/mongo-schema";

const router = Router();

// Request schemas
const createClassroomSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  language: z.string().optional(),
  enableTTS: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
  sceneTypes: z.array(z.enum(["slides", "quiz", "simulation", "pbl"])).optional(),
});

/**
 * GET /api/ai-classroom/health
 * Check if Study Arena service is available
 * NOTE: This must be defined BEFORE /:classroomId to avoid being caught by the catch-all
 */
router.get("/health", async (req, res) => {
  try {
    const client = getStudyArenaClient();
    if (!client) {
      return res.json({
        available: false,
        message: "Study Arena not configured",
      });
    }

    const isHealthy = await client.healthCheck();
    res.json({
      available: isHealthy,
      message: isHealthy ? "Study Arena is available" : "Study Arena is not responding",
    });
  } catch (error: unknown) {
    res.json({
      available: false,
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/ai-classroom/create
 * Submit a new classroom generation job (async).
 * Returns immediately with jobId — frontend should poll /job/:jobId for status.
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    const client = getStudyArenaClient();
    if (!client) {
      return res.status(503).json({
        error: "AI Classroom service is not configured",
      });
    }

    const data = createClassroomSchema.parse(req.body);

    // Submit async generation job to Study Arena
    const generationResponse = await client.createClassroom({
      requirement: data.topic,
      language: data.language,
      enableTTS: data.enableTTS,
      enableWebSearch: data.enableWebSearch,
    });

    // Save to MongoDB with the job ID
    const id = await getNextSequenceValue("classroomId");

    // We allow any logged-in user to create classrooms, so we use their ID
    // If not logged in, we default to 1 (system) to avoid breaking if req.user isn't populated
    const user = req.user as { id: number } | undefined;
    const teacherId = user?.id || req.session?.userId || 1;

    const savedClassroom = new MongoAIClassroom({
      id,
      teacherId,
      topic: data.topic,
      studyArenaJobId: generationResponse.jobId,
      status: "generating",
      url: null,
    });

    await savedClassroom.save();

    res.status(202).json({
      id: savedClassroom.id,
      jobId: generationResponse.jobId,
      status: "generating",
      message: generationResponse.message || "Classroom generation started",
    });
  } catch (error: unknown) {
    console.error("Error creating classroom:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to create classroom",
    });
  }
});

/**
 * GET /api/ai-classroom/job/:jobId
 * Poll the status of a classroom generation job.
 * When the job completes successfully, updates the MongoDB record.
 */
router.get("/job/:jobId", async (req: Request, res: Response) => {
  try {
    const client = getStudyArenaClient();
    if (!client) {
      return res.status(503).json({
        error: "AI Classroom service is not configured",
      });
    }

    const { jobId } = req.params;
    const jobStatus = await client.pollJob(jobId);

    // If generation succeeded, update the MongoDB record
    if (jobStatus.done && jobStatus.status === "succeeded") {
      const classroomId = jobStatus.result?.classroomId;
      const studyArenaBaseUrl = process.env.STUDY_ARENA_URL || process.env.OPENMAIC_INTERNAL_URL || "http://localhost:3000";
      const classroomUrl = classroomId
        ? `${studyArenaBaseUrl}/classroom/${classroomId}`
        : undefined;
      if (!classroomId) {
        console.warn(`[ai-classroom] Job ${jobId} succeeded but result had no classroomId — URL will be null`);
      }

      await MongoAIClassroom.findOneAndUpdate(
        { studyArenaJobId: jobId },
        {
          status: "ready",
          classroomId: classroomId || null,
          url: classroomUrl || null,
        },
      );
    } else if (jobStatus.done && jobStatus.status === "failed") {
      await MongoAIClassroom.findOneAndUpdate(
        { studyArenaJobId: jobId },
        { status: "error" },
      );
    }

    res.json({
      jobId: jobStatus.jobId,
      status: jobStatus.status,
      step: jobStatus.step,
      progress: jobStatus.progress,
      message: jobStatus.message,
      scenesGenerated: jobStatus.scenesGenerated,
      totalScenes: jobStatus.totalScenes,
      done: jobStatus.done,
      result: jobStatus.done ? jobStatus.result : undefined,
      error: jobStatus.error,
    });
  } catch (error: unknown) {
    console.error("Error polling job:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to poll job status",
    });
  }
});

/**
 * GET /api/ai-classroom/my-classrooms
 * Fetch the current user's generated AI classrooms
 */
router.get("/my-classrooms", async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number } | undefined;
    const teacherId = user?.id || req.session?.userId || 1;
    const classrooms = await MongoAIClassroom.find({ teacherId }).sort({ createdAt: -1 });
    res.json(classrooms);
  } catch (error: unknown) {
    console.error("Error fetching classrooms:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to fetch classrooms",
    });
  }
});

/**
 * GET /api/ai-classroom/:classroomId
 * Get classroom details from Study Arena
 */
router.get("/:classroomId", async (req, res) => {
  try {
    const client = getStudyArenaClient();
    if (!client) {
      return res.status(503).json({
        error: "AI Classroom service is not configured",
      });
    }

    const { classroomId } = req.params;
    const classroom = await client.getClassroom(classroomId);

    res.json(classroom);
  } catch (error: unknown) {
    console.error("Error fetching classroom:", error);
    res.status(500).json({
      error: (error as Error).message || "Failed to fetch classroom",
    });
  }
});

export default router;
