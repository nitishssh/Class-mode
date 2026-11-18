import { z } from 'zod';

import { apiGet, onSessionExpired } from '@/lib/api';
import { fetchSchoolAttendanceSummary } from '@/lib/attendance';
import { fetchFeeSummary, fetchFees } from '@/lib/fees';
import { registerDevicePushToken } from '@/lib/notifications';
import { claimParentChild, fetchParentChildAttendance } from '@/lib/parent';
import { clearTokens, getTokens, setTokens } from '@/lib/token-store';
import { installFetchMock, okJson } from '@/test-utils/fetch-mock';
import { toSessionUser } from '@/shared/mobile-api';

// Contract under test (W-1 client side, eng review findings 4/6):
// - single-flight: N concurrent 401s trigger exactly ONE refresh call
// - refresh 5xx/429 keeps tokens (transient trouble is not a logout)
// - refresh 401 clears tokens and notifies session listeners
// - every request carries X-Client: mobile, Bearer auth, and omits cookies

const fetchMock = installFetchMock();

const echoSchema = z.object({ ok: z.boolean() });

beforeEach(async () => {
  fetchMock.mockReset();
  await setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' });
});

afterEach(async () => {
  await clearTokens();
});

function routeFetch(handlers: {
  onData: () => Response | Promise<Response>;
  onRefresh?: () => Response | Promise<Response>;
}) {
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    if (String(url).endsWith('/api/auth/refresh')) {
      if (!handlers.onRefresh) throw new Error('unexpected refresh call');
      return handlers.onRefresh();
    }
    void init;
    return handlers.onData();
  });
}

describe('mobile API client', () => {
  it('sends X-Client: mobile, Bearer auth, and credentials: omit', async () => {
    routeFetch({ onData: () => okJson({ ok: true }) });
    await apiGet('/api/test', echoSchema);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Client']).toBe('mobile');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer old-access');
    expect(init.credentials).toBe('omit');
  });

  it('runs exactly ONE refresh for 5 concurrent 401s, then retries with the new token', async () => {
    let refreshCalls = 0;
    let refreshed = false;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).endsWith('/api/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 10)); // widen the race window
        refreshed = true;
        return okJson({ token: 'new-access', refreshToken: 'new-refresh' });
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      if (!refreshed || auth !== 'Bearer new-access') {
        return okJson({ message: 'expired' }, 401);
      }
      return okJson({ ok: true });
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => apiGet('/api/test', echoSchema))
    );

    expect(results).toHaveLength(5);
    expect(refreshCalls).toBe(1);
    expect(await getTokens()).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });

  it('keeps tokens when refresh fails transiently (5xx)', async () => {
    routeFetch({
      onData: () => okJson({ message: 'expired' }, 401),
      onRefresh: () => okJson({ message: 'server down' }, 503),
    });

    await expect(apiGet('/api/test', echoSchema)).rejects.toThrow();
    // The session survives: tokens are still there for the next retry.
    expect(await getTokens()).toEqual({
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    });
  });

  it('clears tokens and fires sessionExpired on a definitive refresh 401', async () => {
    const expired = jest.fn();
    const unsubscribe = onSessionExpired(expired);
    routeFetch({
      onData: () => okJson({ message: 'expired' }, 401),
      onRefresh: () => okJson({ message: 'invalid refresh token' }, 401),
    });

    await expect(apiGet('/api/test', echoSchema)).rejects.toThrow();
    expect(expired).toHaveBeenCalled();
    expect(await getTokens()).toBeNull();
    unsubscribe();
  });

  it('does NOT auto-refresh on login 401 (bad credentials are not an expired session)', async () => {
    routeFetch({
      onData: () => okJson({ message: 'Invalid email or password' }, 401),
      onRefresh: () => {
        throw new Error('refresh must not run for /api/auth/login');
      },
    });
    await expect(
      apiGet('/api/auth/login', z.object({ token: z.string() }))
    ).rejects.toThrow('API 401');
  });

  it('loads the principal school attendance summary through the shared schema', async () => {
    routeFetch({
      onData: () =>
        okJson({
          date: '2026-07-10',
          totals: {
            totalStudents: 4,
            markedStudents: 3,
            present: 2,
            absent: 1,
            late: 0,
            excused: 0,
            unmarked: 1,
          },
          classes: [
            {
              className: 'Grade 10',
              totalStudents: 4,
              markedStudents: 3,
              present: 2,
              absent: 1,
              late: 0,
              excused: 0,
              unmarked: 1,
            },
          ],
          unmarkedClasses: ['Grade 10'],
        }),
    });

    const summary = await fetchSchoolAttendanceSummary('2026-07-10');

    expect(summary.totals.unmarked).toBe(1);
    expect(summary.classes[0].className).toBe('Grade 10');
    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/attendance/school-summary?date=2026-07-10'
    );
  });

  it('loads staff fee list and summary through the shared schemas', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith('/api/fees/summary')) {
        return okJson({
          pendingCents: 500000,
          paidCents: 100000,
          pendingCount: 1,
          paidCount: 1,
        });
      }
      return okJson([
        {
          id: 77,
          studentId: 9,
          studentName: 'Asha',
          parentPhone: '+919876543210',
          description: 'Term 1',
          amountCents: 500000,
          currency: 'INR',
          status: 'pending',
          dueDate: '2026-07-15',
          paidAt: null,
        },
      ]);
    });

    const [fees, summary] = await Promise.all([fetchFees('pending'), fetchFeeSummary()]);

    expect(fees[0].studentName).toBe('Asha');
    expect(summary.pendingCount).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/fees?status=pending');
  });

  it('loads parent child attendance history through the shared schema', async () => {
    routeFetch({
      onData: () =>
        okJson({
          studentId: 7,
          attendance: [
            { date: '2026-07-10', status: 'present', note: null, className: 'Grade 4' },
            { date: '2026-07-09', status: 'absent', note: 'sick', className: 'Grade 4' },
          ],
        }),
    });

    const res = await fetchParentChildAttendance(7, {
      from: '2026-07-01',
      to: '2026-07-31',
      limit: 31,
    });

    expect(res.attendance[1].status).toBe('absent');
    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/parent/children/7/attendance?from=2026-07-01&to=2026-07-31&limit=31'
    );
  });

  it('claims a parent child through the shared schema', async () => {
    routeFetch({
      onData: () => okJson({ success: true, studentId: 7 }),
    });

    const res = await claimParentChild('CM-SCHOOL123-7', '9876543210');

    expect(res).toEqual({ success: true, studentId: 7 });
    expect(fetchMock.mock.calls[0][0]).toContain('/api/parent/claim');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ code: 'CM-SCHOOL123-7', parentPhone: '9876543210' }),
    });
  });

  it('registers a push token through the shared schema', async () => {
    routeFetch({
      onData: () => okJson({ success: true, message: 'Push token registered successfully' }),
    });

    const res = await registerDevicePushToken('ExponentPushToken[parent]', 'ios');

    expect(res.success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/tokens');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ token: 'ExponentPushToken[parent]', deviceType: 'ios' }),
    });
  });
});

describe('toSessionUser (the snake_case trap)', () => {
  const base = {
    user: {
      id: 1,
      email: 't@example.com',
      displayName: 'Teacher',
      status: 'active',
      emailVerified: true,
      role: 'teacher' as const,
    },
  };

  it('maps wire school_code to schoolCode', () => {
    const user = toSessionUser({
      user: { ...base.user, school_code: 'SCHOOL123' },
    });
    expect(user.schoolCode).toBe('SCHOOL123');
  });

  it('missing school_code becomes null — the fail-closed value', () => {
    const user = toSessionUser({ user: { ...base.user } });
    expect(user.schoolCode).toBeNull();
  });
});
