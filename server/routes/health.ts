import { Router } from "express";
import { isCassandraConnected } from "../lib/cassandra";
import { isPgReady } from "../db-pg";

const router = Router();

/**
 * Health check endpoint for database connections
 * GET /api/health
 */
router.get("/", async (req, res) => {
  const pgStatus = isPgReady();
  const cassandraStatus = isCassandraConnected();

  const health = {
    status: pgStatus ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    databases: {
      postgresql: { connected: pgStatus, available: pgStatus },
      cassandra: { connected: cassandraStatus, fallbackToPg: !cassandraStatus },
    },
  };

  res.status(pgStatus ? 200 : 503).json(health);
});

/**
 * Detailed database health check
 * GET /api/health/detailed
 */
router.get("/detailed", async (req, res) => {
  const pgStatus = isPgReady();
  const cassandraStatus = isCassandraConnected();

  const health = {
    status: pgStatus ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    databases: {
      postgresql: { connected: pgStatus, available: pgStatus },
      cassandra: {
        connected: cassandraStatus,
        fallbackToPg: !cassandraStatus,
        keyspace: process.env.ASTRA_DB_KEYSPACE || "not configured",
      },
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  res.status(pgStatus ? 200 : 503).json(health);
});


export default router;
