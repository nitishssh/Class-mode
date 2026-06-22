import { Queue, Worker, Job } from "bullmq";
import { whatsappService } from "./whatsapp";
import { 
  pgFindUserById 
} from "../lib/pg-queries";
import { getPgPool, isPgReady } from "../db-pg";
import { logger } from "../lib/logger";
import { createBullMQConnection } from "../lib/redis";

const connection = createBullMQConnection();

export const automationQueue = new Queue("sis-automation", {
  connection: connection as any,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const automationWorker = new Worker(
  "sis-automation",
  async (job: Job) => {
    const { type, userId, metadata } = job.data;

    try {
      const user = await pgFindUserById(userId);
      if (!user || !user.parentId) return; // Need parent info for nudges

      const parent = await pgFindUserById(user.parentId);
      if (!parent || !parent.username) return; // Username is used as phone in this mock SIS

      let message = "";
      if (type === "missed_class") {
        message = `Hello, this is Class Mode. Your child ${user.name} missed the ${metadata.subject} class today. Please ensure they catch up on the recording.`;
      } else if (type === "low_score") {
        message = `Hello. ${user.name} scored ${metadata.score}% in the recent ${metadata.subject} test. Our AI tutor has generated a revision plan for them.`;
      } else if (type === "inactivity") {
        message = `Greetings from Class Mode. ${user.name} hasn't logged in for 3 days. Consistency is key to learning!`;
      }

      if (message) {
        await whatsappService.sendMessage({
          to: parent.username, // In this system, username is often the phone number/email
          body: message,
        });
        logger.info(`[SIS Automation] Sent nudge to parent of ${user.name}`, { type });
      }
    } catch (error) {
      logger.error("[SIS Automation] Job failed", { error: String(error), jobId: job.id });
      throw error;
    }
  },
  { connection: connection as any }
);

// Scheduler to check for at-risk students every hour
export async function scheduleAtRiskChecks() {
  if (!isPgReady()) return;

  const pool = getPgPool();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  // 1. Check for inactivity
  const inactiveStudents = await pool.query(
    "SELECT id FROM users WHERE role = 'student' AND (last_login_at < $1 OR (last_login_at IS NULL AND created_at < $1))",
    [threeDaysAgo]
  );

  for (const student of inactiveStudents.rows) {
    await automationQueue.add(`inactivity-${student.id}`, {
      type: "inactivity",
      userId: parseInt(student.id),
    }, {
      jobId: `inactivity-${student.id}-${new Date().toISOString().split('T')[0]}`, // Once per day
    });
  }

  // 2. Check for low scores in last 24h
  const lowScores = await pool.query(
    `SELECT ta.student_id, t.subject, ta.score, t.total_marks 
     FROM test_attempts ta JOIN tests t ON t.id = ta.test_id
     WHERE ta.status = 'evaluated' AND ta.end_time > now() - interval '24 hours'
     AND (ta.score::numeric / t.total_marks) < 0.4`
  );

  for (const record of lowScores.rows) {
    await automationQueue.add(`lowscore-${record.student_id}`, {
      type: "low_score",
      userId: parseInt(record.student_id),
      metadata: { subject: record.subject, score: Math.round((record.score / record.total_marks) * 100) }
    });
  }
}
