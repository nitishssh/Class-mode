import { OAuth2Client } from "google-auth-library";
import { logger } from "../logger";
import { pgCreateLmsConnection, pgFindLmsConnection, type PgLmsConnection } from "../pg-queries";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLASSROOM_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.GOOGLE_CLASSROOM_REDIRECT_URI || "http://localhost:5001/api/lms/google/callback";

export const GOOGLE_CLASSROOM_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  // Required to read roster emails (rosters.readonly returns userId, not email)
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/classroom.coursework.students",
];

if (!GOOGLE_CLIENT_ID && process.env.NODE_ENV !== "test") {
  logger.warn("Google Classroom OAuth not configured. Set GOOGLE_CLASSROOM_CLIENT_ID/SECRET.");
}

export function isGoogleClassroomConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}

function newOauthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
  });
}

export function getAuthUrl(state: string): string {
  return newOauthClient().generateAuthUrl({
    access_type: "offline",
    // prompt=consent ensures we receive a refresh_token on re-connect. Without
    // it, Google omits the refresh_token on subsequent consents and we'd lose
    // the ability to call APIs after the access token expires.
    prompt: "consent",
    scope: GOOGLE_CLASSROOM_SCOPES,
    state,
  });
}

export async function exchangeCode(code: string) {
  const { tokens } = await newOauthClient().getToken(code);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
    scope: tokens.scope,
    idToken: tokens.id_token,
  };
}

// ── Authenticated client with auto-refresh ─────────────────────────────────
// Loads the stored connection, refreshes the access_token if it's within 60s
// of expiry, persists the new token back to lms_connections, and returns a
// ready-to-use OAuth2Client. Centralises refresh logic so callers can't forget.
const REFRESH_SKEW_MS = 60_000;

async function getAuthedClient(userId: number): Promise<OAuth2Client> {
  const conn = await pgFindLmsConnection(userId, "google_classroom");
  if (!conn) throw new GoogleClassroomNotConnectedError();
  if (!conn.accessToken) throw new GoogleClassroomNotConnectedError();

  const client = newOauthClient();
  client.setCredentials({
    access_token: conn.accessToken,
    refresh_token: conn.refreshToken || undefined,
    expiry_date: conn.tokenExpiry ? conn.tokenExpiry.getTime() : undefined,
  });

  const needsRefresh =
    !conn.tokenExpiry || conn.tokenExpiry.getTime() - Date.now() < REFRESH_SKEW_MS;

  if (needsRefresh) {
    if (!conn.refreshToken) {
      // No refresh token on file — user must re-consent. Surface as a typed
      // error so the route can return 401 and the UI can prompt re-connect.
      throw new GoogleClassroomReauthRequiredError(
        "Access token expired and no refresh token stored — user must re-consent"
      );
    }
    try {
      const { credentials } = await client.refreshAccessToken();
      // Persist the new access_token (and a new refresh_token if Google sent one)
      await pgCreateLmsConnection({
        userId,
        provider: "google_classroom",
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token ?? conn.refreshToken,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      });
      client.setCredentials(credentials);
    } catch (err) {
      logger.warn("[gclassroom] token refresh failed", { error: String(err) });
      throw new GoogleClassroomReauthRequiredError("Token refresh failed");
    }
  }

  return client;
}

export class GoogleClassroomNotConnectedError extends Error {
  constructor(message = "User has not connected Google Classroom") {
    super(message);
    this.name = "GoogleClassroomNotConnectedError";
  }
}

export class GoogleClassroomReauthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleClassroomReauthRequiredError";
  }
}

// ── Classroom API calls ────────────────────────────────────────────────────

export interface ClassroomCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  enrollmentCode?: string;
  ownerId?: string;
  courseState?: string;
}

export interface ClassroomStudent {
  userId: string; // Google user ID
  email: string | null; // requires classroom.profile.emails scope
  fullName: string;
  givenName?: string;
  familyName?: string;
  photoUrl?: string;
}

export async function listCourses(userId: number): Promise<ClassroomCourse[]> {
  const client = await getAuthedClient(userId);
  const courses: ClassroomCourse[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://classroom.googleapis.com/v1/courses");
    url.searchParams.set("courseStates", "ACTIVE");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await client.request<{
      courses?: ClassroomCourse[];
      nextPageToken?: string;
    }>({ url: url.toString() });
    if (res.data.courses) courses.push(...res.data.courses);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return courses;
}

export async function listStudents(userId: number, courseId: string): Promise<ClassroomStudent[]> {
  const client = await getAuthedClient(userId);
  const students: ClassroomStudent[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}/students`
    );
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await client.request<{
      students?: Array<{
        userId: string;
        profile?: {
          emailAddress?: string;
          name?: { fullName?: string; givenName?: string; familyName?: string };
          photoUrl?: string;
        };
      }>;
      nextPageToken?: string;
    }>({ url: url.toString() });
    for (const s of res.data.students ?? []) {
      students.push({
        userId: s.userId,
        email: s.profile?.emailAddress ?? null,
        fullName: s.profile?.name?.fullName ?? s.profile?.name?.givenName ?? "Student",
        givenName: s.profile?.name?.givenName,
        familyName: s.profile?.name?.familyName,
        photoUrl: s.profile?.photoUrl,
      });
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return students;
}

export async function pushGrade(
  userId: number,
  courseId: string,
  courseWorkId: string,
  submissionId: string,
  assignedGrade: number
): Promise<void> {
  const client = await getAuthedClient(userId);
  await client.request({
    url:
      `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(courseId)}` +
      `/courseWork/${encodeURIComponent(courseWorkId)}` +
      `/studentSubmissions/${encodeURIComponent(submissionId)}` +
      `?updateMask=assignedGrade,draftGrade`,
    method: "PATCH",
    data: { assignedGrade, draftGrade: assignedGrade },
  });
}

// ── Backwards-compatible aliases ───────────────────────────────────────────
// `syncAssignments` was the original misnamed export. Keep it pointing at
// listCourses so any callers still compile, but new code should use listCourses.
export const syncAssignments = (userId: number, _accessToken?: string) => listCourses(userId);

export { pgFindLmsConnection };
export type { PgLmsConnection };
