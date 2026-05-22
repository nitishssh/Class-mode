import { Router } from "express";
import { isCassandraConnected } from "../lib/cassandra";
import { isPgReady, getPgPool } from "../db-pg";
import { authenticateToken } from "../routes";

const router = Router();

const SERVICE_VERSION = process.env.npm_package_version ?? "1.1.0";

/**
 * Liveness / readiness health check.
 * Always returns 200 so load-balancer liveness probes don't kill a
 * temporarily DB-disconnected instance. DB status is reported as a field.
 * GET /api/health
 */
router.get("/", (_req, res) => {
  const pgReady = isPgReady();
  const cassandraReady = isCassandraConnected();

  res.status(200).json({
    service: "eduai-api",
    version: SERVICE_VERSION,
    environment: process.env.NODE_ENV ?? "development",
    status: pgReady ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    databases: {
      postgresql: {
        connected: pgReady,
        // Cassandra falls back to PG when unavailable
        cassandraFallback: !cassandraReady,
      },
      cassandra: {
        connected: cassandraReady,
        configured: !!process.env.ASTRA_DB_APPLICATION_TOKEN,
      },
    },
  });
});

/**
 * Detailed diagnostic health check — requires authentication.
 * Performs a live DB ping so stale in-memory state is not relied upon.
 * GET /api/health/detailed
 */
router.get("/detailed", authenticateToken, async (_req, res) => {
  const cassandraReady = isCassandraConnected();

  // Live ping — more reliable than the cached isPgReady() flag
  let pgLive: boolean;
  let pgLatencyMs: number | null = null;
  try {
    const t0 = Date.now();
    await getPgPool().query("SELECT 1");
    pgLatencyMs = Date.now() - t0;
    pgLive = true;
  } catch {
    pgLive = false;
  }

  const mem = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());

  res.status(pgLive ? 200 : 503).json({
    service: "eduai-api",
    version: SERVICE_VERSION,
    environment: process.env.NODE_ENV ?? "development",
    status: pgLive ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSec,
      human: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m ${uptimeSec % 60}s`,
    },
    databases: {
      postgresql: {
        connected: pgLive,
        latencyMs: pgLatencyMs,
        configured: !!process.env.POSTGRESQL_URL,
      },
      cassandra: {
        connected: cassandraReady,
        configured: !!process.env.ASTRA_DB_APPLICATION_TOKEN,
        keyspace: process.env.ASTRA_DB_KEYSPACE ?? "not configured",
        fallbackToPg: !cassandraReady,
      },
    },
    ai: {
      gemini: !!process.env.GOOGLE_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
    firebase: {
      adminConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
      heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
      rssMb: Math.round(mem.rss / 1_048_576),
    },
  });
});

export default router;
