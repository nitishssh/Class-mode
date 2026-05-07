import { OAuth2Client } from "google-auth-library";
import { logger } from "../logger";
import { MongoLmsConnection, getNextSequenceValue } from "../../../shared/mongo-schema";
import { Request, Response } from "express";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLASSROOM_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLASSROOM_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_CLASSROOM_REDIRECT_URI || "http://localhost:5001/api/lms/google/callback";

if (!GOOGLE_CLIENT_ID && process.env.NODE_ENV !== "test") {
  logger.warn("Google Classroom OAuth not configured. Set GOOGLE_CLASSROOM_CLIENT_ID/SECRET.");
}

const oauth2Client = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
});

export function getAuthUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.students",
      "https://www.googleapis.com/auth/classroom.rosters.readonly",
    ],
    state,
  });
}

export async function exchangeCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date,
  };
}

export async function syncAssignments(userId: number, accessToken: string) {
  const client = new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    credentials: { access_token: accessToken },
  });
  const response = await client.request({
    url: "https://classroom.googleapis.com/v1/courses",
  });
  return (response.data as any).courses || [];
}

export async function pushGrades(
  accessToken: string,
  courseId: string,
  studentId: string,
  grade: number,
  maxGrade: number
) {
  const client = new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    credentials: { access_token: accessToken },
  });
  await client.request({
    url: `https://classroom.googleapis.com/v1/courses/${courseId}/studentSubmissions`,
    method: "POST",
    data: {
      userId: studentId,
      assignedGrade: grade,
      maxPoints: maxGrade,
    },
  });
}
