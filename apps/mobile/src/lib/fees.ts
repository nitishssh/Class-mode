import {
  actionSuccessResponseSchema,
  createFeeResponseSchema,
  staffFeesResponseSchema,
  staffFeeSummarySchema,
  type FeeStatus,
  type StaffFee,
  type StaffFeeSummary,
} from '@/shared/mobile-api';
import { apiGet, apiPost } from '@/lib/api';

export async function fetchFees(status?: FeeStatus): Promise<StaffFee[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiGet(`/api/fees${qs}`, staffFeesResponseSchema);
}

export async function fetchFeeSummary(): Promise<StaffFeeSummary> {
  return apiGet('/api/fees/summary', staffFeeSummarySchema);
}

export async function createFee(input: {
  studentId: number;
  description: string;
  amountCents: number;
  currency?: string;
  dueDate?: string;
}) {
  return apiPost('/api/fees', input, createFeeResponseSchema);
}

export async function markFeePaid(id: number) {
  return apiPost(`/api/fees/${id}/mark-paid`, {}, actionSuccessResponseSchema);
}

export async function remindFee(id: number, phone: string) {
  return apiPost(`/api/fees/${id}/remind`, { phone }, actionSuccessResponseSchema);
}
