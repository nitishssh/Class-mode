import "dotenv/config";
import { Pool } from "pg";
import Redis from "ioredis";

const postgresUrl = process.env.POSTGRESQL_URL;
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

async function main(): Promise<void> {
  if (!postgresUrl) {
    throw new Error("POSTGRESQL_URL is not configured");
  }

  const pool = new Pool({ connectionString: postgresUrl, max: 1 });
  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    const pgStarted = Date.now();
    const pgResult = await pool.query<{ database: string; user_name: string }>(
      "SELECT current_database() AS database, current_user AS user_name"
    );
    console.log(
      `✓ PostgreSQL connected (${Date.now() - pgStarted}ms): ${pgResult.rows[0].database} as ${pgResult.rows[0].user_name}`
    );

    const redisStarted = Date.now();
    await redis.connect();
    const pong = await redis.ping();
    if (pong !== "PONG") throw new Error(`Unexpected Redis response: ${pong}`);
    console.log(`✓ Redis connected (${Date.now() - redisStarted}ms): ${redisUrl}`);
  } finally {
    redis.disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`✗ Data service check failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
