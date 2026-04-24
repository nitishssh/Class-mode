import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  initializeFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../constants/config';

// User role types
export type UserRole = 'student' | 'teacher' | 'school_admin' | 'admin' | 'principal' | 'parent';

// User profile interface
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: 'active' | 'pending' | 'suspended' | 'rejected';
  photoURL?: string;
  school_code?: string;
  grade?: string;
  board?: string;
  subjects?: string[];
  district?: string;
  institutionId?: string;
  classId?: string;
  studentId?: string;
  createdAt?: any;
  lastLogin?: any;
}

// Check if Firebase is configured
export const firebaseEnabled =
  !!FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.startsWith('AIza');

if (!firebaseEnabled) {
  console.warn(
    '⚠️  Firebase is not configured. Auth features will be disabled.\n' +
    '   To enable Firebase, set EXPO_PUBLIC_FIREBASE_* environment variables.'
  );
}

// Initialize Firebase
const app = firebaseEnabled ? initializeApp(FIREBASE_CONFIG) : null;
export const auth = app ? getAuth(app) : null;
export const db = app
  ? initializeFirestore(app, { experimentalForceLongPolling: true })
  : null;

// Firebase error mapping
const firebaseErrorMap: Record<string, string> = {
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/user-disabled': 'This account has been disabled. Contact support.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
};

export function mapFirebaseError(error: any): string {
  const code = error?.code || '';
  return firebaseErrorMap[code] || error?.message || 'An unexpected error occurred. Please try again.';
}

// Authentication functions
export const loginWithEmail = async (email: string, password: string) => {
  if (!firebaseEnabled || !auth || !db) throw new Error('Firebase is not configured');
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    updateDoc(doc(db, 'users', userCredential.user.uid), {
      lastLogin: serverTimestamp(),
    }).catch(() => {});
    return userCredential.user;
  } catch (error: any) {
    const friendlyMsg = mapFirebaseError(error);
    console.error('Error logging in with email:', error);
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
  if (!firebaseEnabled || !auth || !db) throw new Error('Firebase is not configured');
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await updateProfile(user, { displayName });

    const userData: UserProfile = {
      uid: user.uid,
      email: user.email || email,
      displayName,
      role,
      status: role === 'student' ? 'active' : 'pending',
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      ...additionalData,
    };

    await setDoc(doc(db, 'users', user.uid), userData);

    return user;
  } catch (error: any) {
    const friendlyMsg = mapFirebaseError(error);
    console.error('Error registering with email:', error);
    const newErr = new Error(friendlyMsg) as any;
    newErr.code = error.code;
    throw newErr;
  }
};

export const logoutUser = async () => {
  if (!firebaseEnabled || !auth) throw new Error('Firebase is not configured');
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Error signing out:', error);
    throw new Error(mapFirebaseError(error));
  }
};

export const resetPassword = async (email: string) => {
  if (!firebaseEnabled || !auth) throw new Error('Firebase is not configured');
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error sending password reset email:', error);
    throw new Error(mapFirebaseError(error));
  }
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (!firebaseEnabled || !db) return null;
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

// Auth state observer
export { onAuthStateChanged };
