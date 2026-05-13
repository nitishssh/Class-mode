import { createRequire } from "module";
import fs from "fs";
import os from "os";
import path from "path";

// cassandra-driver is an optional dependency. Load it only when present so
// the server can start without it when ASTRA_DB credentials are not set.
const _require = createRequire(import.meta.url);
let CassandraClient: any = null;
try {
  CassandraClient = _require("cassandra-driver").Client;
} catch {
  // package not installed — Cassandra features disabled
}

let client: any | null = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

export function getCassandraClient(): any | null {
  if (client && isConnected) return client;

  if (!CassandraClient) return null; // package not installed

  const bundlePath = process.env.ASTRA_DB_SECURE_BUNDLE_PATH;
  const bundleB64 = process.env.ASTRA_DB_SECURE_BUNDLE_B64;
  const token = process.env.ASTRA_DB_APPLICATION_TOKEN;
  const keyspace = process.env.ASTRA_DB_KEYSPACE;

  let resolvedBundlePath = bundlePath ? path.resolve(bundlePath) : null;

  if (!resolvedBundlePath && bundleB64) {
    const tempBundlePath = path.join(os.tmpdir(), "astra-secure-connect-temp.zip");
    fs.writeFileSync(tempBundlePath, Buffer.from(bundleB64, "base64"));
    resolvedBundlePath = tempBundlePath;
  }

  if (!resolvedBundlePath || !token || !keyspace) {
    return null;
  }

  if (!client) {
    client = new CassandraClient({
      cloud: { secureConnectBundle: resolvedBundlePath },
      credentials: { username: "token", password: token },
      keyspace,
      pooling: { coreConnectionsPerHost: { [0]: 2, [1]: 1 } },
      queryOptions: { consistency: 1, prepare: true },
      socketOptions: { connectTimeout: 5000, readTimeout: 12000 },
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

      await c.execute(`
        CREATE INDEX IF NOT EXISTS messages_is_pinned_idx ON messages (is_pinned);
      `);

      console.log("Cassandra 'messages' table verified.");
      return true;
    } catch (err: any) {
      const msg = err?.message || String(err);
      const inner = JSON.stringify(err?.innerErrors || {});

      if (
        msg.includes("401") ||
        msg.includes("Unauthorized") ||
        inner.includes("401") ||
        inner.includes("Unauthorized")
      ) {
        console.warn("[Cassandra] Database hibernated (HTTP 401). Falling back to MongoDB.");
        console.warn("[Cassandra] Wake your Astra DB at https://astra.datastax.com");
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

  for (let i = 1; i <= MAX_CONNECTION_ATTEMPTS; i++) {
    connectionAttempts = i;
    const success = await attemptConnection(i);
    if (success) return;

    if (hibernationDetected) {
      console.warn("[Cassandra] Skipping retries for hibernated database.");
      return;
    }

    if (i < MAX_CONNECTION_ATTEMPTS) {
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      console.log(`[Cassandra] Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.warn("[Cassandra] Max attempts reached. Falling back to MongoDB.");
}
