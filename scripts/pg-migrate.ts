import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.POSTGRESQL_URL;
  if (!url) {
    console.error("[pg-migrate] POSTGRESQL_URL is not set. Aborting.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });
  const sql = readFileSync(join(__dirname, "pg-schema.sql"), "utf8");

  try {
    const client = await pool.connect();
    try {
      await client.query(sql);
      console.log("[pg-migrate] Schema applied successfully.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[pg-migrate] Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
