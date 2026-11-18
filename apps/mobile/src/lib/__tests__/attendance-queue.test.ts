import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, OfflineError } from '@/lib/api';
import { enqueueMarks, flushQueue, pendingItems } from '@/lib/attendance-queue';

// Queue contract under test (eng review findings 1/7):
// - coalescing: only the newest marking per (className, date) survives
// - dequeue ONLY when the server confirms the full write
//   (200 with written < marks.length stays queued — never silently lost)
// - 4xx = permanent failure (kept + flagged), 5xx/offline = retry later

jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number;
    body: string;
    constructor(status: number, body: string) {
      super('API ' + String(status));
      this.status = status;
      this.body = body;
    }
    get serverMessage() {
      try {
        return JSON.parse(this.body).message ?? null;
      } catch {
        return null;
      }
    }
  }
  class OfflineError extends Error {}
  return { ApiError, OfflineError, apiPost: jest.fn() };
});

const { apiPost } = jest.requireMock('@/lib/api') as { apiPost: jest.Mock };

const marks = [
  { studentId: 1, status: 'present' as const },
  { studentId: 2, status: 'absent' as const },
];

beforeEach(async () => {
  await AsyncStorage.clear();
  apiPost.mockReset();
});

describe('attendance queue', () => {
  it('coalesces per (className, date): newest submission wins', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    await enqueueMarks({
      className: 'Grade 5',
      date: '2026-07-09',
      marks: [{ studentId: 1, status: 'absent' }],
    });
    await enqueueMarks({ className: 'Grade 6', date: '2026-07-09', marks });

    const items = await pendingItems();
    expect(items).toHaveLength(2);
    const g5 = items.find((i) => i.className === 'Grade 5');
    expect(g5?.marks).toEqual([{ studentId: 1, status: 'absent' }]);
  });

  it('dequeues only when the server confirms the FULL write', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });

    // Server says 200 but confirms fewer rows than sent — stays queued.
    apiPost.mockResolvedValueOnce({ success: true, written: 1 });
    let outcome = await flushQueue();
    expect(outcome.sent).toHaveLength(0);
    expect(outcome.pending).toHaveLength(1);
    expect(await pendingItems()).toHaveLength(1);

    // Full confirmation → dequeued.
    apiPost.mockResolvedValueOnce({ success: true, written: 2 });
    outcome = await flushQueue();
    expect(outcome.sent).toHaveLength(1);
    expect(await pendingItems()).toHaveLength(0);
  });

  it('keeps items queued through offline and 5xx failures', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });

    apiPost.mockRejectedValueOnce(new OfflineError());
    let outcome = await flushQueue();
    expect(outcome.pending).toHaveLength(1);

    apiPost.mockRejectedValueOnce(new ApiError(503, '{"message":"down"}'));
    outcome = await flushQueue();
    expect(outcome.pending).toHaveLength(1);
    expect((await pendingItems())[0].attempts).toBe(2);
  });

  it('flags 4xx rejections as permanent failures with the server reason', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });

    apiPost.mockRejectedValueOnce(
      new ApiError(403, '{"message":"Forbidden: some students are not in this class"}')
    );
    const outcome = await flushQueue();
    expect(outcome.failed).toHaveLength(1);
    expect(outcome.failed[0].failedWith).toContain('Forbidden');
    // Data is retained for the user to see/re-mark — never silently dropped.
    expect(await pendingItems()).toHaveLength(1);
  });

  it('survives an interrupted flush: unconfirmed items are still queued on relaunch', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    // Simulate the app dying mid-request: the POST never resolves into a
    // confirmation. A new flush (relaunch) re-sends the same item.
    apiPost.mockRejectedValueOnce(new OfflineError());
    await flushQueue();
    expect(await pendingItems()).toHaveLength(1);

    apiPost.mockResolvedValueOnce({ success: true, written: 2 });
    const outcome = await flushQueue();
    expect(outcome.sent).toHaveLength(1);
    expect(await pendingItems()).toHaveLength(0);
  });

  it('posts markedAt so the server can reject stale offline replays', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    apiPost.mockResolvedValueOnce({ success: true, written: 2 });

    await flushQueue();

    expect(apiPost).toHaveBeenCalledWith(
      '/api/attendance',
      expect.objectContaining({
        className: 'Grade 5',
        date: '2026-07-09',
        markedAt: expect.any(String),
        marks,
      }),
      expect.anything()
    );
  });
});

// Autoplan T14: the queue must distinguish "the server refused these rows"
// (final — stop retrying) from "the write did not happen" (retry). The old
// `written === marks.length` test conflated them, so a stale replay the server
// had permanently and correctly rejected was re-POSTed on every flush forever.
describe('attendance queue — final vs retryable server answers (T14)', () => {
  it('dequeues a save the server refused as stale, instead of retrying it forever', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });

    // The office already corrected both students from the web, so the server
    // applies nothing — but it is DONE with this save, not failing on it.
    apiPost.mockResolvedValueOnce({
      success: true,
      written: 0,
      applied: [],
      skipped: [1, 2],
    });

    const outcome = await flushQueue();
    expect(outcome.sent).toHaveLength(1);
    expect(outcome.pending).toHaveLength(0);
    expect(await pendingItems()).toHaveLength(0);
  });

  it('dequeues a partially-stale save once every student has a final answer', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    apiPost.mockResolvedValueOnce({
      success: true,
      written: 1,
      applied: [1],
      skipped: [2],
    });

    const outcome = await flushQueue();
    expect(outcome.sent).toHaveLength(1);
    expect(await pendingItems()).toHaveLength(0);
  });

  it('keeps an item queued when the server accounts for only some students', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    // Student 2 is in neither list — no final answer, so this is not done.
    apiPost.mockResolvedValueOnce({
      success: true,
      written: 1,
      applied: [1],
      skipped: [],
    });

    const outcome = await flushQueue();
    expect(outcome.sent).toHaveLength(0);
    expect(outcome.pending).toHaveLength(1);
    expect(await pendingItems()).toHaveLength(1);
  });

  it('falls back to the count comparison against a server that omits the fields', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    apiPost.mockResolvedValueOnce({ success: true, written: 2 });
    expect((await flushQueue()).sent).toHaveLength(1);
    expect(await pendingItems()).toHaveLength(0);
  });

  it('sends a stable opId, unchanged across retries of the same save', async () => {
    await enqueueMarks({ className: 'Grade 5', date: '2026-07-09', marks });
    const queued = (await pendingItems())[0];
    expect(queued.opId).toBeTruthy();

    // First attempt fails offline, second succeeds — same opId both times, so
    // the server's claim suppresses duplicate parent alerts.
    apiPost.mockRejectedValueOnce(new OfflineError('offline'));
    await flushQueue();
    apiPost.mockResolvedValueOnce({
      success: true,
      written: 2,
      applied: [1, 2],
      skipped: [],
    });
    await flushQueue();

    const sentOpIds = apiPost.mock.calls.map((c) => (c[1] as { opId?: string }).opId);
    expect(sentOpIds).toHaveLength(2);
    expect(sentOpIds[0]).toBe(queued.opId);
    expect(sentOpIds[1]).toBe(queued.opId);
  });

  it('omits opId for an item persisted before the field existed', async () => {
    // A teacher's phone can hold a day's marking across an app upgrade.
    await AsyncStorage.setItem(
      'classmode.attendanceQueue.v1',
      JSON.stringify({
        v: 1,
        items: [
          {
            v: 1,
            className: 'Grade 5',
            date: '2026-07-09',
            markedAt: '2026-07-09T03:00:00.000Z',
            marks,
            attempts: 0,
          },
        ],
      })
    );

    apiPost.mockResolvedValueOnce({
      success: true,
      written: 2,
      applied: [1, 2],
      skipped: [],
    });
    const outcome = await flushQueue();

    expect(outcome.sent).toHaveLength(1);
    expect((apiPost.mock.calls[0][1] as Record<string, unknown>)).not.toHaveProperty('opId');
  });
});
