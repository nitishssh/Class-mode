import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  User,
} from "firebase/auth";
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Graceful fallback: allow running without Firebase credentials
export const firebaseEnabled = !!firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith("AIza");

if (!firebaseEnabled) {
  console.warn(
    "⚠️  Firebase is not configured. Auth features will be disabled.\n" +
      "   To enable Firebase, copy .env.example to .env and fill in your credentials.\n" +
      "   See README.md for details."
  );
}

// Initialize Firebase only when credentials are present
const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? initializeFirestore(app, { experimentalForceLongPolling: true }) : null;
export const googleProvider = firebaseEnabled ? new GoogleAuthProvider() : null;

// User role types
export type UserRole = "student" | "teacher" | "school_admin" | "admin" | "principal" | "parent";

// User profile interface
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: "active" | "pending" | "suspended" | "rejected";
  photoURL?: string;
  // Role-specific fields
  school_code?: string;
  grade?: string; // Students
  board?: string; // Students
  subjects?: string[]; // Teachers
  district?: string; // School Admins
  institutionId?: string;
  classId?: string;
  studentId?: string; // For parents
  createdAt?: any;
  lastLogin?: any;
}

// ── Friendly Firebase error mapping ──
const firebaseErrorMap: Record<string, string> = {
  "auth/user-not-found": "No account found with this email address.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Invalid email or password. Please try again.",
  "auth/invalid-api-key":
    "Firebase config error: invalid API key. Verify VITE_FIREBASE_API_KEY in .env and restart the dev server.",
  // Some Firebase SDKs surface this as the full message-like code.
  "auth/api-key-not-valid.-please-pass-a-valid-api-key.":
    "Firebase config error: API key is not valid (or is restricted). Check Google Cloud API key restrictions and ensure localhost is allowed.",
  "auth/unauthorized-domain":
    "Firebase config error: unauthorized domain. Add localhost to Firebase Auth > Settings > Authorized domains.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Contact support.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in popup was closed. Please try again.",
  "auth/operation-not-allowed": "This sign-in method is not enabled.",
  "auth/requires-recent-login": "Please log in again to complete this action.",
};

export function mapFirebaseError(error: any): string {
  const code = error?.code || "";
  return (
    firebaseErrorMap[code] || error?.message || "An unexpected error occurred. Please try again."
  );
}

// Authentication functions
export const loginWithEmail = async (email: string, password: string) => {
  if (!firebaseEnabled || !auth || !db) throw new Error("Firebase is not configured");
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Update last login — don't fail the login if Firestore is unreachable
    updateDoc(doc(db, "users", userCredential.user.uid), {
      lastLogin: serverTimestamp(),
    }).catch(() => {});
    return userCredential.user;
  } catch (error: any) {
    const friendlyMsg = mapFirebaseError(error);
    console.error("Error logging in with email:", error);
    const newErr = new Error(friendlyMsg) as any;
    newErr.code = error.code;
    throw newErr;
  }
};

export const registerWithEmail = async (
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
  additionalData: Partial<UserProfile> = {}
) => {
  if (!firebaseEnabled || !auth || !db) throw new Error("Firebase is not configured");
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update profile with display name
    await updateProfile(user, { displayName });
    sendEmailVerification(user).catch(() => {});

    // Create user document in Firestore
    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName,
      role,
      status: role === "student" ? "active" : "pending",
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      ...additionalData,
    };

    await setDoc(doc(db, "users", user.uid), userData);

    return user;
  } catch (error: any) {
    const friendlyMsg = mapFirebaseError(error);
    console.error("Error registering with email:", error);
    const newErr = new Error(friendlyMsg) as any;
    newErr.code = error.code;
    throw newErr;
  }
};

// Errors where a popup didn't reliably complete — usually browser extension
// interference (MetaMask, ad blockers), aggressive popup blockers, mobile
// Safari, or COOP issues. Retrying with signInWithRedirect is bulletproof
// because the whole page navigates to Google instead of relying on a popup
// channel.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

async function resolveGoogleUser(user: User) {
  // Check if user exists in Firestore (best effort — if it fails we'll just
  // treat them as new and let the server-side firebase exchange figure it out).
  let isNewUser = true;
  let profile: UserProfile | null = null;
  try {
    if (db) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        isNewUser = false;
        profile = userDoc.data() as UserProfile;
        await updateDoc(doc(db, "users", user.uid), { lastLogin: serverTimestamp() }).catch(() => {});
      }
    }
  } catch {
    // Firestore unreachable; carry on, server will resolve.
  }
  return { user, profile, isNewUser };
}

// We deliberately use signInWithRedirect rather than signInWithPopup.
// Real-world reliability beats the "snappier" popup UX:
//   - Cross-Origin-Opener-Policy (even at same-origin-allow-popups) blocks
//     Firebase's window.closed polling, so popup completion is lost
//   - Browser extensions that inject content scripts (MetaMask, ad blockers)
//     intercept postMessage between popup and opener
//   - Mobile Safari blocks popups outright in many flows
//   - Popup blockers are common
// With redirect, the whole page navigates to Google's consent screen and
// returns via Firebase's authDomain handler. The result is consumed on
// boot by consumePendingGoogleRedirect() in the auth context.
export const loginWithGoogle = async (): Promise<never> => {
  if (!firebaseEnabled || !auth || !googleProvider)
    throw new Error("Firebase is not configured");
  // signInWithRedirect navigates the entire page to Google. The returned
  // Promise never resolves in normal flow (the document is being torn down
  // for navigation). The credential is picked up on the next page load by
  // consumePendingGoogleRedirect() in firebase-auth-context's boot effect.
  await signInWithRedirect(auth, googleProvider);
  // Should be unreachable — if we get here, navigation didn't happen.
  throw new Error("Google sign-in: navigation to consent screen did not start.");
};

// Suppress unused-import warning — kept for the popup-based code path
// future maintainers may want to switch back to.
void POPUP_FALLBACK_CODES;
void signInWithPopup;

// Call on app boot. If the user just returned from signInWithRedirect, this
// resolves to the user object so the auth context can exchange the Firebase
// token for our server session. Returns null when there's nothing to consume.
export const consumePendingGoogleRedirect = async () => {
  if (!firebaseEnabled || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    return await resolveGoogleUser(result.user);
  } catch (err: any) {
    console.error("Error consuming Google redirect result:", err);
    return null;
  }
};

export const completeGoogleSignUp = async (
  user: User,
  role: UserRole,
  additionalData: Partial<UserProfile> = {}
) => {
  if (!firebaseEnabled || !db) throw new Error("Firebase is not configured");
  try {
    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || "",
      role,
      status: role === "student" ? "active" : "pending",
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      ...additionalData,
    };

    await setDoc(doc(db, "users", user.uid), userData);

    return userData;
  } catch (error: any) {
    const friendlyMsg = mapFirebaseError(error);
    console.error("Error completing Google sign up:", error);
    throw new Error(friendlyMsg, { cause: error });
  }
};

export const logoutUser = async () => {
  if (!firebaseEnabled || !auth) throw new Error("Firebase is not configured");
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error("Error signing out:", error);
    throw new Error(mapFirebaseError(error), { cause: error });
  }
};

export const resetPassword = async (email: string) => {
  if (!firebaseEnabled || !auth) throw new Error("Firebase is not configured");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    throw new Error(mapFirebaseError(error), { cause: error });
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!firebaseEnabled || !db) return null;
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    return null;
  }
};
