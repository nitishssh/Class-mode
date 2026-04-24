import { Client } from "cassandra-driver";
import fs from "fs";
import os from "os";
import path from "path";

let client: Client | null = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

export function getCassandraClient() {
  if (client && isConnected) return client;

  const bundlePath = process.env.ASTRA_DB_SECURE_BUNDLE_PATH;
  const bundleB64 = process.env.ASTRA_DB_SECURE_BUNDLE_B64;
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN;
  const keyspace = process.env.ASTRA_DB_KEYSPACE;

  let resolvedBundlePath = bundlePath ? path.resolve(bundlePath) : null;

  // Support injecting the zip file via a base64 encoded environment variable
  if (!resolvedBundlePath && bundleB64) {
    const tempBundlePath = path.join(os.tmpdir(), "astra-secure-connect-temp.zip");
    fs.writeFileSync(tempBundlePath, Buffer.from(bundleB64, "base64"));
    resolvedBundlePath = tempBundlePath;
  }

  if (!resolvedBundlePath || !token || !keyspace) {
    console.warn("Astra DB credentials not fully configured. Cassandra client not initialized.");
    return null;
  }

  if (!client) {
    client = new Client({
      cloud: {
        secureConnectBundle: resolvedBundlePath,
      },
      credentials: {
        username: "token",
        password: token,
      },
      keyspace: keyspace,
      // Connection pool configuration
      pooling: {
        coreConnectionsPerHost: {
          [0]: 2,
          [1]: 1,
        },
      },
      // Query options
      queryOptions: {
        consistency: 1, // LOCAL_ONE for better performance
        prepare: true, // Use prepared statements
      },
      // Socket options
      socketOptions: {
        connectTimeout: 5000,
        readTimeout: 12000,
      },
    });
  }

  return client;
}

export function isCassandraConnected() {
  return isConnected;
}

export async function initCassandra() {
  const c = getCassandraClient();
  if (!c) return;

  const keyspace = process.env.ASTRA_DB_KEYSPACE;
  let hibernationDetected = false;

  const attemptConnection = async (attempt: number): Promise<boolean> => {
    try {
      await c.connect();
      console.log(`Connected to Astra DB (Cassandra) - Keyspace: ${keyspace}`);
      isConnected = true;

      // Create messages table if it doesn't exist.
      // Partitioned by channel_id, clustered by message_id (Snowflake — time-sortable).
      await c.execute(`
        CREATE TABLE IF NOT EXISTS messages (
          channel_id      text,
          message_id      text,
          author_id       bigint,
          content         text,
          type            text,
          file_url        text,
          is_pinned       boolean,
          is_homework     boolean,
          grading_status  text,
          read_by         list<bigint>,
          attachments     list<text>,
          created_at      timestamp,
          PRIMARY KEY (channel_id, message_id)
        ) WITH CLUSTERING ORDER BY (message_id DESC)
        AND compaction = {'class': 'TimeWindowCompactionStrategy'}
        AND default_time_to_live = 0;
      `);

      // Secondary index so getPinnedMessages can filter without ALLOW FILTERING on full partition
      await c.execute(`
        CREATE INDEX IF NOT EXISTS messages_is_pinned_idx
        ON messages (is_pinned);
      `);

      console.log("Cassandra 'messages' table verified.");
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      const innerErrorMsg = JSON.stringify(err?.innerErrors || {});

      // Check if it's a hibernation/401 error (can be in message or innerErrors)
      if (
        errorMsg.includes("401") ||
        errorMsg.includes("Unauthorized") ||
        innerErrorMsg.includes("401") ||
        innerErrorMsg.includes("Unauthorized")
      ) {
        console.warn(`[Cassandra] Database appears to be hibernated (HTTP 401).`);
        console.warn(
          `[Cassandra] The app will use MongoDB for messages. Wake your Astra DB at https://astra.datastax.com`
        );
        hibernationDetected = true;
        isConnected = false;
        return false;
      }

      console.error(
        `Failed to connect to Astra DB (attempt ${attempt}/${MAX_CONNECTION_ATTEMPTS}):`,
        err
      );
      isConnected = false;
      return false;
    }
  };

  // Retry logic with exponential backoff
  for (let i = 1; i <= MAX_CONNECTION_ATTEMPTS; i++) {
    connectionAttempts = i;
    const success = await attemptConnection(i);
    if (success) return;

    // Stop retrying if we detected hibernation
    if (hibernationDetected) {
      console.warn(
        "[Cassandra] Skipping retries for hibernated database. Falling back to MongoDB."
      );
      return;
    }

    if (i < MAX_CONNECTION_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`[Cassandra] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.warn(
    "[Cassandra] Max connection attempts reached. Falling back to MongoDB for messages."
  );
}
