import Dexie, { Table } from "dexie";

/**
 * Offline attendance write queue (eng review T6/T8/T9).
 *
 * The attendance mark is the wedge's core habit; on a cheap Android with patchy
 * connectivity a dropped save must never lose a teacher's day. This persists the
 * per-class-day batch locally BEFORE the network POST, so the mark survives a
 * signal drop or a reload, then drains on reconnect.
 *
 *   marking screen ──save──▶ enqueue(record)  ──POST ok──▶ markSynced (delete)
 *                                 │  POST fail (transient)  ──▶ stays 'pending'
 *                                 └  POST fail (permanent)   ──▶ 'failed' (T9)
 *   'online' event / focus ──▶ drainQueue() replays every pending record,
 *                              one batched POST per class-day, reusing opId so
 *                              side effects fire exactly once (server T4).
 *
 * Ownership (Issue 5): a pending record is the source of truth for its
 * class-day until it drains — the marking screen seeds from the queue, not the
 * server refetch, so a background read can't clobber an unsynced mark.
 *
 * Isolation (T8): every record is namespaced by `owner` = `${userId}:${school}`
 * so a shared device never leaks or replays one teacher's marks under another
 * account. purgeOwner() runs on logout.
 */

export type Status = "present" | "absent" | "late" | "excused";
export type QueueStatus = "pending" | "failed";

export interface QueuedSave {
  key: string; // `${owner}|${className}|${date}` — one pending save per class-day
  owner: string; // `${userId}:${schoolCode}` — T8 isolation
  opId: string; // T4 idempotency key, stable across retries of THIS save
  className: string;
  date: string; // YYYY-MM-DD
  markedAt: string; // ISO — client mark time (server clamps skew)
  marks: { studentId: number; status: Status }[];
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  updatedAt: number;
}

class AttendanceQueueDatabase extends Dexie {
  saves!: Table<QueuedSave, string>;

  constructor() {
    super("ClassMode_AttendanceQueue");
    this.version(1).stores({
      // Primary key `key`; secondary indexes for owner-scoped and status queries.
      saves: "key, owner, status, [owner+status]",
    });
  }
}

export const attendanceQueueDb = new AttendanceQueueDatabase();

/** Namespace token for the signed-in user on this device (T8). */
export function ownerToken(
  userId: number | null | undefined,
  schoolCode: string | null | undefined
): string {
  return `${userId ?? "anon"}:${schoolCode ?? "none"}`;
}

export function queueKey(owner: string, className: string, date: string): string {
  return `${owner}|${className}|${date}`;
}

/**
 * Persist (or replace) the pending save for a class-day. A re-edit of the same
 * class-day before it drains coalesces into one record with a fresh opId and
 * markedAt — the latest local state is what we sync. Returns the stored record.
 */
export async function enqueueSave(input: {
  owner: string;
  opId: string;
  className: string;
  date: string;
  markedAt: string;
  marks: { studentId: number; status: Status }[];
}): Promise<QueuedSave> {
  const record: QueuedSave = {
    key: queueKey(input.owner, input.className, input.date),
    owner: input.owner,
    opId: input.opId,
    className: input.className,
    date: input.date,
    markedAt: input.markedAt,
    marks: input.marks,
    status: "pending",
    attempts: 0,
    updatedAt: Date.now(),
  };
  await attendanceQueueDb.saves.put(record);
  return record;
}

/** The pending/failed record for a class-day, if any (source of truth while unsynced). */
export async function getQueued(
  owner: string,
  className: string,
  date: string
): Promise<QueuedSave | undefined> {
  return attendanceQueueDb.saves.get(queueKey(owner, className, date));
}

/** All records still needing a sync attempt for this owner (pending only). */
export async function getPending(owner: string): Promise<QueuedSave[]> {
  return attendanceQueueDb.saves.where({ owner, status: "pending" }).toArray();
}

/** Any records at all (pending or failed) for this owner — for a status badge. */
export async function getUnsynced(owner: string): Promise<QueuedSave[]> {
  return attendanceQueueDb.saves.where("owner").equals(owner).toArray();
}

/**
 * A save landed on the server: drop it from the queue.
 * CAS guard: only delete if the record still carries the same opId — a newer
 * enqueueSave for the same class-day may have replaced it while this POST was
 * in flight, and we must not clobber that newer edit.
 */
export async function markSynced(key: string, opId: string): Promise<void> {
  const rec = await attendanceQueueDb.saves.get(key);
  if (rec && rec.opId === opId) await attendanceQueueDb.saves.delete(key);
}

/** A transient failure: keep it pending, record the reason, bump the attempt count. */
export async function markPendingRetry(key: string, opId: string, error: string): Promise<void> {
  const rec = await attendanceQueueDb.saves.get(key);
  if (!rec || rec.opId !== opId) return;
  await attendanceQueueDb.saves.put({
    ...rec,
    status: "pending",
    attempts: rec.attempts + 1,
    lastError: error,
    updatedAt: Date.now(),
  });
}

/** A permanent failure (T9): mark terminal so the drain stops retrying it. */
export async function markFailed(key: string, opId: string, error: string): Promise<void> {
  const rec = await attendanceQueueDb.saves.get(key);
  if (!rec || rec.opId !== opId) return;
  await attendanceQueueDb.saves.put({
    ...rec,
    status: "failed",
    attempts: rec.attempts + 1,
    lastError: error,
    updatedAt: Date.now(),
  });
}

/** T8: wipe every queued record for an owner (called on logout / account switch). */
export async function purgeOwner(owner: string): Promise<void> {
  await attendanceQueueDb.saves.where("owner").equals(owner).delete();
}

export type SyncOutcome = "synced" | "retry" | "failed";
export interface PostResult {
  ok: boolean;
  status?: number;
  error?: string;
  written?: number; // server's actual rowCount — honesty invariant (T5)
}

/**
 * T9: is a failed sync transient (retry later) or permanent (stop retrying)?
 * Permanent = the server rejected the request on its merits and always will:
 *   400 — validation, e.g. outside the 3-day backfill window (attendance.ts)
 *   403 — tenant/role rejection
 *   422 — semantic validation
 * A read-swallow that surfaced as a spurious 403 is NOT this case: that path
 * now throws a 500 (eng review T3), which classifies as retry. Everything else
 * (offline, 5xx, 408, 429, unknown) is transient and stays pending.
 */
export function classifyFailure(httpStatus: number | undefined): "retry" | "failed" {
  if (httpStatus === 400 || httpStatus === 403 || httpStatus === 422) return "failed";
  return "retry";
}

export type SyncResult = { outcome: SyncOutcome; written?: number };

/** Sync one record via the injected poster; update the queue by outcome. */
export async function syncRecord(
  rec: QueuedSave,
  poster: (rec: QueuedSave) => Promise<PostResult>
): Promise<SyncResult> {
  const res = await poster(rec).catch(
    (err): PostResult => ({ ok: false, status: undefined, error: String(err) })
  );
  if (res.ok) {
    await markSynced(rec.key, rec.opId);
    return { outcome: "synced", written: res.written };
  }
  if (classifyFailure(res.status) === "failed") {
    await markFailed(rec.key, rec.opId, res.error ?? `HTTP ${res.status}`);
    return { outcome: "failed" };
  }
  await markPendingRetry(rec.key, rec.opId, res.error ?? "network error");
  return { outcome: "retry" };
}

/**
 * Drain every pending record for an owner, one batched POST per class-day
 * (Issue 6 — never one request per student). `onRecovered` fires for a record
 * that had previously failed at least once and now synced, so the caller can
 * instrument the offline-recovery rate (T7).
 */
export async function drainQueue(
  owner: string,
  poster: (rec: QueuedSave) => Promise<PostResult>,
  onRecovered?: (rec: QueuedSave) => void
): Promise<{ synced: number; retry: number; failed: number }> {
  const pending = await getPending(owner);
  const summary = { synced: 0, retry: 0, failed: 0 };
  for (const rec of pending) {
    const { outcome } = await syncRecord(rec, poster);
    summary[outcome] += 1;
    if (outcome === "synced" && rec.attempts > 0) onRecovered?.(rec);
  }
  return summary;
}
