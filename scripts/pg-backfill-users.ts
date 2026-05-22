import "dotenv/config";
import mongoose from "mongoose";
import { Pool } from "pg";
import { MongoUser } from "../shared/mongo-schema";

const BATCH_SIZE = 100;
const LOG_EVERY = 500;

async function main() {
  const mongoUrl = process.env.MONGODB_URL;
  const pgUrl = process.env.POSTGRESQL_URL;

  if (!mongoUrl) {
    console.error("[backfill] MONGODB_URL not set");
    process.exit(1);
  }
  if (!pgUrl) {
    console.error("[backfill] POSTGRESQL_URL not set");
    process.exit(1);
  }

  await mongoose.connect(mongoUrl);
  console.log("[backfill] MongoDB connected");

  const pgPool = new Pool({ connectionString: pgUrl });
  await pgPool.query("SELECT 1");
  console.log("[backfill] PostgreSQL connected");

  let processed = 0;
  let inserted = 0;
  let failed = 0;

  const cursor = MongoUser.find({}).lean().cursor();

  const batch: any[] = [];

  const processBatch = async (users: any[]) => {
    for (const user of users) {
      try {
        const authProvider = user.firebaseUid ? "firebase" : "local";
        const authSubject = user.firebaseUid || user.email;

        const { rows } = await pgPool.query<{ id: string }>(
          `INSERT INTO users (auth_provider, auth_subject, email, display_name, avatar_url, mongo_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (auth_provider, auth_subject)
             DO UPDATE SET
               email        = EXCLUDED.email,
               display_name = COALESCE(EXCLUDED.display_name, users.display_name),
               avatar_url   = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
               mongo_id     = COALESCE(EXCLUDED.mongo_id, users.mongo_id)
           RETURNING id`,
          [
            authProvider,
            authSubject,
            user.email,
            user.displayName || user.name || null,
            user.avatar || null,
            user.id,
          ]
        );
        const pgUserId = rows[0] ? parseInt(rows[0].id, 10) : null;

        if (pgUserId && user.school_code) {
          // Ensure school row exists (insert by code if missing)
          const schoolRes = await pgPool.query<{ id: string }>(
            `INSERT INTO schools (code, name) VALUES ($1, $2)
             ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
             RETURNING id`,
            [user.school_code, user.school_code]
          );
          const schoolId = schoolRes.rows[0] ? parseInt(schoolRes.rows[0].id, 10) : null;

          if (schoolId) {
            const memberRes = await pgPool.query<{ id: string }>(
              `INSERT INTO memberships (user_id, school_id, status)
               VALUES ($1, $2, $3)
               ON CONFLICT (user_id, school_id) DO UPDATE SET status = EXCLUDED.status
               RETURNING id`,
              [pgUserId, schoolId, user.status || "active"]
            );
            const membershipId = memberRes.rows[0] ? parseInt(memberRes.rows[0].id, 10) : null;

            if (membershipId) {
              const roleRes = await pgPool.query<{ id: string }>(
                "SELECT id FROM roles WHERE key = $1",
                [user.role || "student"]
              );
              const roleId = roleRes.rows[0] ? parseInt(roleRes.rows[0].id, 10) : null;
              if (roleId) {
                await pgPool.query(
                  "INSERT INTO membership_roles (membership_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                  [membershipId, roleId]
                );
              }
            }
          }
        }
        inserted++;
      } catch (err) {
        console.error(`[backfill] Failed for mongo_id=${user.id}: ${String(err)}`);
        failed++;
      }
      processed++;
      if (processed % LOG_EVERY === 0) {
        console.log(
          `[backfill] Processed ${processed} users (inserted/updated: ${inserted}, failed: ${failed})`
        );
      }
    }
  };

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await processBatch(batch.splice(0, BATCH_SIZE));
    }
  }
  if (batch.length > 0) await processBatch(batch);

  // Reconciliation report
  const mongoCount = await MongoUser.countDocuments();
  const pgRes = await pgPool.query<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  const pgCount = parseInt(pgRes.rows[0]?.count || "0", 10);
  const delta = Math.abs(mongoCount - pgCount);

  console.log("\n[backfill] ── Reconciliation ─────────────────────────────");
  console.log(`  MongoDB users : ${mongoCount}`);
  console.log(`  PostgreSQL users: ${pgCount}`);
  console.log(`  Delta           : ${delta}`);
  console.log(`  Inserted/updated: ${inserted}`);
  console.log(`  Failed          : ${failed}`);
  if (delta === 0) {
    console.log("  ✓ Delta is 0 — safe to proceed to Phase 8.");
  } else {
    console.log("  ✗ Delta > 0 — investigate failures before starting Phase 8.");
  }

  await mongoose.disconnect();
  await pgPool.end();
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exit(1);
});
