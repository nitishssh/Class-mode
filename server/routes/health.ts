import { Router } from "express";
import { isCassandraConnected } from "../lib/cassandra";
import { isPgReady, getPgPool } from "../db-pg";
import { authenticateToken } from "../middleware";
import { getFirebaseAdminStatus } from "../lib/firebase-admin";
import { isRedisConfigured, isRedisReady } from "../lib/redis";

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
  const firebase = getFirebaseAdminStatus();

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
        configured: !!process.env.POSTGRESQL_URL,
        cloudSqlConfigured: !!process.env.POSTGRESQL_URL?.includes("/cloudsql/"),
        // Cassandra falls back to PG when unavailable
        cassandraFallback: !cassandraReady,
      },
      cassandra: {
        connected: cassandraReady,
        configured: !!process.env.ASTRA_DB_APPLICATION_TOKEN,
      },
    },
    services: {
      redis: {
        configured: isRedisConfigured(),
        connected: isRedisReady(),
      },
    },
    auth: {
      firebaseAdminReady: firebase.hasApp,
      firebaseServiceAccountConfigured: firebase.hasServiceAccount,
      firebaseProjectConfigured: !!firebase.projectId,
      firebaseExchangeEnabled: process.env.ENABLE_FIREBASE_AUTH_COMPAT !== "false",
      localPasswordAuthEnabled:
        process.env.ENABLE_LOCAL_PASSWORD_AUTH === "true" || process.env.NODE_ENV !== "production",
    },
    secrets: {
      sessionSecretConfigured: !!process.env.SESSION_SECRET,
      jwtSecretConfigured: !!process.env.JWT_SECRET,
      refreshSecretConfigured: !!process.env.REFRESH_SECRET,
      googleApiKeyConfigured: !!process.env.GOOGLE_API_KEY,
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
  const firebase = getFirebaseAdminStatus();

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
    services: {
      redis: {
        configured: isRedisConfigured(),
        connected: isRedisReady(),
      },
    },
    ai: {
      gemini: !!process.env.GOOGLE_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    },
    firebase: {
      adminReady: firebase.hasApp,
      serviceAccountConfigured: firebase.hasServiceAccount,
      projectConfigured: !!firebase.projectId,
      exchangeEnabled: process.env.ENABLE_FIREBASE_AUTH_COMPAT !== "false",
    },
    secrets: {
      postgresqlUrlConfigured: !!process.env.POSTGRESQL_URL,
      sessionSecretConfigured: !!process.env.SESSION_SECRET,
      jwtSecretConfigured: !!process.env.JWT_SECRET,
      refreshSecretConfigured: !!process.env.REFRESH_SECRET,
      googleApiKeyConfigured: !!process.env.GOOGLE_API_KEY,
    },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
      heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
      rssMb: Math.round(mem.rss / 1_048_576),
    },
  });
});

export default router;
