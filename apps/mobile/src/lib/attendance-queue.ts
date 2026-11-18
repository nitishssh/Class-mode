import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  markAttendanceResponseSchema,
  type MarkAttendanceRequest,
  type MarkAttendanceResponse,
} from '@/shared/mobile-api';
import { ApiError, OfflineError, apiPost } from '@/lib/api';

// Offline-first submit queue for attendance marking (plan §Phase 3).
//
// Contract (eng review findings 1, 3, 7):
// - versioned storage shape ({v:1}) so future migrations are possible
// - items coalesce per (className, date): only the NEWEST marking for a
//   class-day survives — an old offline mark never overwrites a newer one
//   locally, and each item carries markedAt for future server-side stale
//   checks
// - an item is dequeued ONLY when the server confirms the full write
//   (written === marks.length); W-2a makes the server honest about failures
// - 4xx responses are permanent failures (retrying identical data cannot
//   succeed): the item moves to `failed` and the UI must show a persistent
//   banner — a day's marking is never silently lost
// - 5xx/offline keep the item queued for the next flush

const QUEUE_KEY = 'classmode.attendanceQueue.v1';

export type QueueItem = {
  v: 1;
  className: string;
  date: string; // YYYY-MM-DD
  markedAt: string; // ISO timestamp of the teacher's action
  marks: MarkAttendanceRequest['marks'];
  attempts: number;
  /**
   * Autoplan T14: idempotency key, stable across every retry of THIS save, so
   * the server runs side effects (parent alerts, adoption tracking) exactly
   * once no matter how many times a flaky connection replays it. Optional
   * because items persisted before this field existed have none; those are
   * sent without it and the server falls back to its legacy always-run path.
   */
  opId?: string;
  /** Set when the server permanently rejected the item (4xx). */
  failedWith?: string;
};

/**
 * Stable-enough unique id without pulling in a uuid dependency. One per
 * enqueue, never regenerated on retry — regenerating it would defeat the
 * whole point and let one save's side effects fire twice.
 */
function newOpId(className: string, date: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `m:${className}:${date}:${Date.now().toString(36)}:${rand}`;
}

type QueueFile = { v: 1; items: QueueItem[] };

export type FlushOutcome = {
  sent: { item: QueueItem; response: MarkAttendanceResponse }[];
  /** Still queued (offline / server trouble) — will retry. */
  pending: QueueItem[];
  /** Permanently rejected — needs user attention. */
  failed: QueueItem[];
};

async function readQueue(): Promise<QueueFile> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return { v: 1, items: [] };
    const parsed = JSON.parse(raw) as QueueFile;
    if (parsed?.v !== 1 || !Array.isArray(parsed.items)) return { v: 1, items: [] };
    return parsed;
  } catch {
    return { v: 1, items: [] };
  }
}

async function writeQueue(file: QueueFile): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(file));
}

/** Queue (or replace) the marking for a class-day. Newest submission wins. */
export async function enqueueMarks(input: {
  className: string;
  date: string;
  marks: MarkAttendanceRequest['marks'];
}): Promise<QueueItem> {
  const file = await readQueue();
  const item: QueueItem = {
    v: 1,
    className: input.className,
    date: input.date,
    markedAt: new Date().toISOString(),
    marks: input.marks,
    attempts: 0,
    opId: newOpId(input.className, input.date),
  };
  file.items = [
    ...file.items.filter((i) => !(i.className === input.className && i.date === input.date)),
    item,
  ];
  await writeQueue(file);
  return item;
}

/** Remove the queued item for a class-day (used by Undo-as-rewrite flows). */
export async function removeQueued(className: string, date: string): Promise<void> {
  const file = await readQueue();
  file.items = file.items.filter((i) => !(i.className === className && i.date === date));
  await writeQueue(file);
}

export async function pendingItems(): Promise<QueueItem[]> {
  return (await readQueue()).items;
}

let flushInFlight: Promise<FlushOutcome> | null = null;

/**
 * Has the server reached a FINAL answer for every student in this item?
 *
 * Autoplan T14: the old test was `written === marks.length`, which conflated
 * "the server refused these rows" with "the write did not happen". A stale
 * replay — a save the office has since corrected — is refused permanently, so
 * `written` is 0 and the item was re-queued and re-POSTed on every flush,
 * forever. It also mis-handled a duplicate studentId in one payload: the server
 * dedupes, so `written` is legitimately lower than `marks.length` on a complete
 * success.
 *
 * A student is accounted for when the server names them as either applied or
 * skipped. Both are final; neither is worth retrying. Servers older than this
 * contract omit both arrays, so fall back to the previous count comparison.
 */
function isFullyAccountedFor(item: QueueItem, response: MarkAttendanceResponse): boolean {
  const { applied, skipped } = response;
  if (!applied && !skipped) return response.written === item.marks.length;
  const accounted = new Set<number>([...(applied ?? []), ...(skipped ?? [])]);
  return item.marks.every((m) => accounted.has(m.studentId));
}

/**
 * Try to deliver every queued item. Single-flight: concurrent callers share
 * one flush (kill-the-app-mid-flush is safe — items are only removed after
 * the server confirms, and the mark endpoint is an upsert).
 */
export async function flushQueue(): Promise<FlushOutcome> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const outcome: FlushOutcome = { sent: [], pending: [], failed: [] };
    const file = await readQueue();
    const remaining: QueueItem[] = [];

    for (const item of file.items) {
      if (item.failedWith) {
        outcome.failed.push(item);
        remaining.push(item);
        continue;
      }
      try {
        const response = await apiPost(
          '/api/attendance',
          {
            className: item.className,
            date: item.date,
            markedAt: item.markedAt,
            marks: item.marks,
            ...(item.opId ? { opId: item.opId } : {}),
          },
          markAttendanceResponseSchema
        );
        if (response.success && isFullyAccountedFor(item, response)) {
          outcome.sent.push({ item, response });
          // confirmed — do not re-add
        } else {
          // Server answered 200 but did not confirm the full write — treat as
          // retryable, never as done.
          const kept = { ...item, attempts: item.attempts + 1 };
          outcome.pending.push(kept);
          remaining.push(kept);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          const kept = {
            ...item,
            attempts: item.attempts + 1,
            failedWith: err.serverMessage ?? `Rejected (${err.status})`,
          };
          outcome.failed.push(kept);
          remaining.push(kept);
        } else if (err instanceof OfflineError || err instanceof ApiError) {
          const kept = { ...item, attempts: item.attempts + 1 };
          outcome.pending.push(kept);
          remaining.push(kept);
        } else {
          // Unknown failure (e.g. contract error) — keep the data, surface it.
          const kept = { ...item, attempts: item.attempts + 1, failedWith: String(err) };
          outcome.failed.push(kept);
          remaining.push(kept);
        }
      }
    }

    await writeQueue({ v: 1, items: remaining });
    return outcome;
  })().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
}

/** Clear a permanently-failed item after the user acknowledged/re-marked. */
export async function acknowledgeFailure(className: string, date: string): Promise<void> {
  await removeQueued(className, date);
}
