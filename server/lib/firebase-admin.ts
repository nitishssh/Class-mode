/**
 * server/lib/firebase-admin.ts
 *
 * Initialises firebase-admin once (lazy, singleton) and exports a helper
 * to verify a Firebase ID token from the client.
 *
 * The service-account key can be supplied via one of:
 *   FIREBASE_SERVICE_ACCOUNT_JSON  – raw JSON string of the service account
 *   FIREBASE_PROJECT_ID            – minimal setup using ADC / emulator
 *
 * If neither is present the module degrades gracefully and token verification
 * will return null so the rest of the app keeps working without Firebase.
 */

import * as admin from "firebase-admin";

let initialised = false;

function ensureInitialised() {
  if (initialised || admin.apps.length > 0) {
    initialised = true;
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.warn("[firebase-admin] No project ID found — Firebase Admin disabled. Set FIREBASE_PROJECT_ID.");
    return;
  }

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      console.log("[firebase-admin] Initialised with service account, project:", projectId);
    } else {
      // No service account — initialise with project ID only.
      // Token verification will fail locally without ADC; the auth route
      // falls back to JWT session auth automatically.
      admin.initializeApp({ projectId });
      console.log("[firebase-admin] Initialised (no service account) project:", projectId);
      console.warn("[firebase-admin] To enable Firebase token verification, set FIREBASE_SERVICE_ACCOUNT_JSON.");
    }
    initialised = true;
  } catch (err) {
    console.warn("[firebase-admin] Failed to initialise:", (err as Error).message);
  }
}

/**
 * Verify a Firebase ID token from the client.
 * Returns the decoded token payload, or null on failure.
 */
export async function verifyFirebaseToken(
  idToken: string
): Promise<admin.auth.DecodedIdToken | null> {
  ensureInitialised();

  if (!admin.apps.length) return null;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    console.error("[firebase-admin] Token verification failed:", (err as Error).message);
    return null;
  }
}

/**
 * Set custom user claims for a Firebase user.
 */
export async function setCustomUserClaims(
  uid: string,
  claims: Record<string, any>
): Promise<boolean> {
  ensureInitialised();

  if (!admin.apps.length) return false;

  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    return true;
  } catch (err) {
    console.error("[firebase-admin] Failed to set custom claims:", (err as Error).message);
    return false;
  }
}
