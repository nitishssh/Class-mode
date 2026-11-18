import { ContractError } from '@/lib/api';
import { shiftDateString, isWithinBackfillWindow, todayDateString } from '@/lib/attendance';
import { createFee, markFeePaid, remindFee } from '@/lib/fees';
import { currentMonthRange, recentHistoryRange } from '@/lib/parent';
import { clearTokens, setTokens } from '@/lib/token-store';
import { installFetchMock, okJson } from '@/test-utils/fetch-mock';

// Fee mutations are the school-admin pilot workflow; a wrong URL or body
// shape here silently breaks money-adjacent operations. Date-range helpers
// feed the parent history queries; off-by-one there shows the wrong days.
// The clock is frozen so every date assertion is a literal, not a value
// recomputed with the helper under test.

const FROZEN_TODAY = '2026-07-10';

const fetchMock = installFetchMock();

const pathname = (url: unknown) => new URL(String(url)).pathname;

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date(`${FROZEN_TODAY}T12:00:00`));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(async () => {
  fetchMock.mockReset();
  await setTokens({ accessToken: 'access', refreshToken: 'refresh' });
});

afterEach(async () => {
  await clearTokens();
});

describe('fee mutations', () => {
  it('creates a fee with the exact endpoint and body the server contract expects', async () => {
    fetchMock.mockResolvedValue(okJson({ id: 5, status: 'pending' }));

    await createFee({
      studentId: 9,
      description: 'Term 1',
      amountCents: 500000,
      dueDate: '2026-07-15',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(pathname(url)).toBe('/api/fees');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      studentId: 9,
      description: 'Term 1',
      amountCents: 500000,
      dueDate: '2026-07-15',
    });
  });

  it('marks a fee paid via its exact id-scoped endpoint', async () => {
    fetchMock.mockResolvedValue(okJson({ success: true, message: 'ok' }));

    await markFeePaid(77);

    expect(pathname(fetchMock.mock.calls[0][0])).toBe('/api/fees/77/mark-paid');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
  });

  it('sends a reminder with the parent phone to the exact endpoint', async () => {
    fetchMock.mockResolvedValue(okJson({ success: true, message: 'ok' }));

    await remindFee(77, '+919876543210');

    expect(pathname(fetchMock.mock.calls[0][0])).toBe('/api/fees/77/remind');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      phone: '+919876543210',
    });
  });

  it('rejects a malformed fee response with a ContractError, never passing it to the UI', async () => {
    fetchMock.mockResolvedValue(okJson({ unexpected: 'shape' }));

    await expect(markFeePaid(77)).rejects.toBeInstanceOf(ContractError);
  });
});

describe('date helpers (clock frozen at 2026-07-10)', () => {
  it('reports the frozen date as today', () => {
    expect(todayDateString()).toBe(FROZEN_TODAY);
  });

  it('shifts across month boundaries', () => {
    expect(shiftDateString('2026-07-01', -1)).toBe('2026-06-30');
    expect(shiftDateString('2026-06-30', 1)).toBe('2026-07-01');
  });

  it('shifts across year boundaries', () => {
    expect(shiftDateString('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('shifts multi-day spans, not just single days', () => {
    expect(shiftDateString('2026-07-10', -30)).toBe('2026-06-10');
    expect(shiftDateString('2026-02-15', 30)).toBe('2026-03-17');
  });

  it('backfill window accepts today and 3 days back, rejects 4 days back and tomorrow', () => {
    expect(isWithinBackfillWindow('2026-07-10')).toBe(true);
    expect(isWithinBackfillWindow('2026-07-07')).toBe(true);
    expect(isWithinBackfillWindow('2026-07-06')).toBe(false);
    expect(isWithinBackfillWindow('2026-07-11')).toBe(false);
  });

  it('currentMonthRange starts on the 1st of the current month', () => {
    expect(currentMonthRange('2026-07-10')).toEqual({ from: '2026-07-01', to: '2026-07-10' });
  });

  it('recentHistoryRange spans the requested days inclusive of today', () => {
    expect(recentHistoryRange(30)).toEqual({
      from: '2026-06-10',
      to: '2026-07-10',
      limit: 31,
    });
  });
});
