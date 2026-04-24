# Cassandra Production Deployment Checklist

This guide outlines the steps to ensure the cloud Astra DB connection works perfectly for the messaging phase of the application in production.

## 1. Environment Variables

Ensure the production environment (e.g., Render, Vercel, Heroku, or your VPS) has the following variables set:

- `ASTRA_DB_SECURE_BUNDLE_PATH`: The relative path to the secure bundle zip (e.g., `./secure-connect-bundle.zip`).
- `ASTRA_DB_APPLICATION_TOKEN`: The client secret / token generated from the Astra DB dashboard.
- `ASTRA_DB_KEYSPACE`: The keyspace used for the database (e.g., `ks_messages`).

## 2. Secure Connect Bundle

The secure connect bundle ZIP file must be accessible in your production build.

- If using Docker, ensure the `COPY` command includes this file.
- If deploying to a PaaS, ensure it is committed to your repository or securely downloaded during the build step.
- Do NOT extract the ZIP file; the Node.js Cassandra driver requires it as a `.zip`.

## 3. Verify Connection Script

You can verify the connection structure before booting the full server. Run the provided script:

```bash
node scripts/check-cassandra-prod.js
```

**Expected Output:**

- ✅ Secure bundle found
- ✅ Token found
- ✅ Successfully connected to Astra DB

## 4. Production Boot Sequence

When running `npm start`, the `server/lib/cassandra-message-store.ts` file should initialize the connection using these same credentials.
Check your production logs right after boot. You should see:
`[Cassandra] Connected to Astra DB Keyspace...`

If you see connection timeout errors, verify the database has not been paused by DataStax (free tier databases pause after inactivity).
