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

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

let initialised = false;

function ensureInitialised() {
  if (initialised || getApps().length > 0) {
    initialised = true;
    return;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;

  if (!projectId) {
    console.warn(
      "[firebase-admin] No project ID found — Firebase Admin disabled. Set FIREBASE_PROJECT_ID."
    );
    return;
  }

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
      console.log("[firebase-admin] Initialised with service account, project:", projectId);
    } else {
      initializeApp({ projectId });
      console.log("[firebase-admin] Initialised (no service account) project:", projectId);
      console.warn(
        "[firebase-admin] To enable Firebase token verification, set FIREBASE_SERVICE_ACCOUNT_JSON."
      );
    }
    initialised = true;
  } catch (err) {
    console.warn("[firebase-admin] Failed to initialise:", (err as Error).message);
  }
}

export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken | null> {
  ensureInitialised();

  if (!getApps().length) return null;

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return decoded;
  } catch (err) {
    console.error("[firebase-admin] Token verification failed:", (err as Error).message);
    return null;
  }
}

export function checkFirebaseAdminReadiness(): void {
  ensureInitialised();
  const hasApp = getApps().length > 0;
  const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!hasApp) {
    console.error(
      "[firebase-admin] NOT READY — Firebase Admin SDK failed to initialise. Token verification is disabled."
    );
  } else if (!hasServiceAccount) {
    console.warn(
      "[firebase-admin] PARTIAL — Running without service account. Firebase token verification may fail without ADC. Set FIREBASE_SERVICE_ACCOUNT_JSON for production."
    );
  } else {
    console.log("[firebase-admin] READY — Service account configured, token verification enabled.");
  }
}

export async function setCustomUserClaims(
  uid: string,
  claims: Record<string, any>
): Promise<boolean> {
  ensureInitialised();

  if (!getApps().length) return false;

  try {
    await getAuth().setCustomUserClaims(uid, claims);
    return true;
  } catch (err) {
    console.error("[firebase-admin] Failed to set custom claims:", (err as Error).message);
    return false;
  }
}
