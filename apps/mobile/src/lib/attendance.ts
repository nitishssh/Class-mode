import {
  attendanceListResponseSchema,
  classListResponseSchema,
  rosterResponseSchema,
  schoolAttendanceSummaryResponseSchema,
  type AttendanceRow,
  type AttendanceStatus,
  type RosterStudent,
  type SchoolAttendanceSummaryResponse,
} from '@/shared/mobile-api';
import { apiGet } from '@/lib/api';

// Read-side attendance API (submits go through attendance-queue.ts).

export function todayDateString(): string {
  // Device-local calendar date; the server enforces the real marking window
  // (W-6 date validation with UTC slack), so a skewed device clock fails
  // loudly there instead of writing to the wrong day silently.
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shiftDateString(date: string, days: number): string {
  const dt = new Date(`${date}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Mobile can mark/correct up to 3 days back (D-13); older is read-only. */
export const MAX_BACKFILL_DAYS = 3;

export function isWithinBackfillWindow(date: string): boolean {
  const today = todayDateString();
  return date <= today && date >= shiftDateString(today, -MAX_BACKFILL_DAYS);
}

export async function fetchClasses(): Promise<string[]> {
  return apiGet('/api/attendance/classes', classListResponseSchema);
}

export async function fetchRoster(className: string): Promise<RosterStudent[]> {
  return apiGet(
    `/api/attendance/roster?className=${encodeURIComponent(className)}`,
    rosterResponseSchema
  );
}

export async function fetchMarks(className: string, date: string): Promise<AttendanceRow[]> {
  return apiGet(
    `/api/attendance?className=${encodeURIComponent(className)}&date=${encodeURIComponent(date)}`,
    attendanceListResponseSchema
  );
}

export async function fetchSchoolAttendanceSummary(
  date: string
): Promise<SchoolAttendanceSummaryResponse> {
  return apiGet(
    `/api/attendance/school-summary?date=${encodeURIComponent(date)}`,
    schoolAttendanceSummaryResponseSchema
  );
}

export type ClassDayState = {
  className: string;
  date: string;
  /** null = not marked yet */
  counts: Record<AttendanceStatus, number> | null;
  total: number;
};

/** Summarize a class-day's rows into the receipt-card shape (D-4). */
export function summarizeRows(rows: AttendanceRow[]): Record<AttendanceStatus, number> | null {
  if (rows.length === 0) return null;
  const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
