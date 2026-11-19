import {
  parentChildAttendanceHistoryResponseSchema,
  parentChildFeeSummarySchema,
  parentChildrenResponseSchema,
  parentClaimResponseSchema,
  type ParentChildAttendanceHistoryResponse,
  type ParentChildFeeSummary,
  type ParentChildrenResponse,
  type ParentClaimResponse,
} from '@/shared/mobile-api';
import { apiGet, apiPost } from '@/lib/api';
import { shiftDateString, todayDateString } from '@/lib/attendance';

export async function fetchParentChildren(date = todayDateString()): Promise<ParentChildrenResponse> {
  return apiGet(
    `/api/parent/children?date=${encodeURIComponent(date)}`,
    parentChildrenResponseSchema
  );
}

export async function fetchParentChildFees(studentId: number): Promise<ParentChildFeeSummary> {
  return apiGet(`/api/parent/children/${studentId}/fees`, parentChildFeeSummarySchema);
}

export async function claimParentChild(
  code: string,
  parentPhone: string
): Promise<ParentClaimResponse> {
  return apiPost('/api/parent/claim', { code, parentPhone }, parentClaimResponseSchema);
}

export async function fetchParentChildAttendance(
  studentId: number,
  options: { from?: string; to?: string; limit?: number } = {}
): Promise<ParentChildAttendanceHistoryResponse> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  if (options.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return apiGet(
    `/api/parent/children/${studentId}/attendance${qs ? `?${qs}` : ''}`,
    parentChildAttendanceHistoryResponseSchema
  );
}

export function currentMonthRange(now = todayDateString()): { from: string; to: string } {
  const from = `${now.slice(0, 8)}01`;
  return { from, to: now };
}

export function recentHistoryRange(days = 30): { from: string; to: string; limit: number } {
  const to = todayDateString();
  return { from: shiftDateString(to, -days), to, limit: days + 1 };
}
