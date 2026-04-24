import { Client } from "cassandra-driver";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

// Load environment variables from .env if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkCassandraConnection() {
  console.log("=== Cassandra Production Connection Check ===");

  const secureBundlePath = process.env.ASTRA_DB_SECURE_BUNDLE_PATH;
  const username = "token";
  const password = process.env.ASTRA_DB_APPLICATION_TOKEN;
  const keyspace = process.env.ASTRA_DB_KEYSPACE || "default_keyspace";

  let hasErrors = false;

  if (!secureBundlePath) {
    console.error("❌ Missing ASTRA_DB_SECURE_BUNDLE_PATH");
    hasErrors = true;
  } else {
    // Check if the file actually exists
    const resolvedPath = path.resolve(__dirname, "..", secureBundlePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ Secure bundle not found at: ${resolvedPath}`);
      hasErrors = true;
    } else {
      console.log(`✅ Secure bundle found at ${resolvedPath}`);
    }
  }

  if (!password) {
    console.error("❌ Missing ASTRA_DB_APPLICATION_TOKEN (Password)");
    hasErrors = true;
  } else {
    console.log("✅ Token found.");
  }

  console.log(`ℹ️ Configured Keyspace: ${keyspace}`);

  if (hasErrors) {
    console.error(
      "\n❌ Configuration errors detected. Please fix the above issues in your .env file."
    );
    process.exit(1);
  }

  console.log("\nAttempting to connect to Astra DB...");

  try {
    const client = new Client({
      cloud: {
        secureConnectBundle: path.resolve(__dirname, "..", secureBundlePath),
      },
      credentials: {
        username,
        password: password,
      },
      keyspace,
    });

    await client.connect();
    console.log("✅ Successfully connected to Astra DB!");

    const result = await client.execute("SELECT release_version FROM system.local");
    console.log(`ℹ️ Connected to Cassandra version: ${result.rows[0].release_version}`);

    await client.shutdown();
    console.log("Connection closed.");
  } catch (err) {
    console.error("❌ Failed to connect to Astra DB:");
    console.error(err);
    process.exit(1);
  }
}

checkCassandraConnection();
