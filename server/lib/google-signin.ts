// Server-driven Google OAuth 2.0 sign-in.
//
// This replaces Firebase signInWithPopup/signInWithRedirect for the
// "Continue with Google" button. By doing the OAuth code flow entirely
// server-side, we sidestep every browser issue that breaks the Firebase
// JS popup flow: COOP, popup blockers, wallet/ad-blocker extensions
// (MetaMask in particular), Safari ITP, in-app browsers, mobile.
//
// Flow:
//   1. /api/auth/google/start    → 302 to accounts.google.com
//   2. User consents at Google
//   3. accounts.google.com       → 302 to /api/auth/google/callback?code=…
//   4. Callback exchanges code → user info → PG user + session cookie
//   5. Callback                  → 302 to /dashboard
//
// Reuses the same OAuth Web client as Google Classroom. The redirect
// URI for sign-in must be added to the OAuth client's authorized
// redirect URIs in GCP Console:
//   http://localhost:5001/api/auth/google/callback
//   https://<prod-host>/api/auth/google/callback

import { OAuth2Client } from "google-auth-library";
import { logger } from "./logger";

// Prefer the dedicated sign-in OAuth client when configured. Fall back to
// the Classroom client so deployments that share a single OAuth client
// for both flows continue to work — but you do need to ensure the
// /api/auth/google/callback URI is registered on whichever client wins.
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_SIGNIN_CLIENT_ID || process.env.GOOGLE_CLASSROOM_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_SIGNIN_CLIENT_SECRET || process.env.GOOGLE_CLASSROOM_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.GOOGLE_SIGNIN_REDIRECT_URI ||
  `${process.env.APP_URL || "http://localhost:5001"}/api/auth/google/callback`;

// Minimal scopes for identity. We deliberately do NOT request the
// Classroom scopes here — teachers connect Classroom later via the
// dedicated /api/lms/google/* flow, so non-teacher users aren't asked
// for access to data they don't need.
const SIGNIN_SCOPES = ["openid", "email", "profile"];

export function isGoogleSignInConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

if (!isGoogleSignInConfigured() && process.env.NODE_ENV !== "test") {
  logger.warn(
    "Google sign-in not configured. Set GOOGLE_CLASSROOM_CLIENT_ID/SECRET " +
      "(shared with the Classroom integration) and add the callback URI to " +
      "the OAuth client's authorized redirect URIs."
  );
}

function newClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
  });
}

export function getSignInAuthUrl(state: string): string {
  return newClient().generateAuthUrl({
    access_type: "online", // no refresh token needed for plain sign-in
    scope: SIGNIN_SCOPES,
    state,
    // Always show account chooser — important when a user has multiple
    // Google accounts and previously consented to a different one.
    prompt: "select_account",
  });
}

export interface GoogleSignInUserInfo {
  sub: string; // Google user id (stable, unique)
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

// Calls Google's userinfo endpoint with the access token from the code
// exchange. Returns the canonical fields we need to find-or-create a
// user in our DB.
export async function exchangeSignInCode(code: string): Promise<GoogleSignInUserInfo> {
  const client = newClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }
  client.setCredentials(tokens);
  const res = await client.request<{
    sub: string;
    email: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  }>({
    url: "https://openidconnect.googleapis.com/v1/userinfo",
  });
  const data = res.data;
  if (!data?.email) {
    throw new Error("Google did not return an email — cannot sign in");
  }
  return {
    sub: data.sub,
    email: data.email.toLowerCase().trim(),
    emailVerified: data.email_verified !== false,
    name: data.name ?? null,
    picture: data.picture ?? null,
  };
}
