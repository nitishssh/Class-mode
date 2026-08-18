/**
 * DM channel identity — the one place that knows how a DM channel name encodes
 * its two participants.
 *
 * Storage writes canonical `dm_<minId>_<maxId>` names (server/storage.ts:1254).
 * Every authorization check used to re-derive that format inline, and each one
 * got it wrong in a different way:
 *
 *   - `name.includes("1")`        matched `dm_10_20` — substring, not identity
 *   - `name.split("-")`           never matched anything — wrong separator
 *   - `name LIKE 'dm_2_%'`        matched `dm_20_30` — `_` is a SQL wildcard
 *
 * All three were reachable the moment the DM list started loading. Parse once,
 * compare exactly, and let the type system carry the result.
 */

/** Matches only a canonical DM name: `dm_<digits>_<digits>`. */
const DM_NAME = /^dm_(\d+)_(\d+)$/;

/**
 * The two user ids in a DM channel name, or null if the name is not a
 * canonical DM name. Null is a denial, never a pass — callers must treat an
 * unparseable name as "nobody is a participant".
 */
export function parseDmParticipants(name: string): [number, number] | null {
  const match = DM_NAME.exec(name);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return null;
  return [a, b];
}

/** True only when userId is one of the channel's two exact participants. */
export function isDmParticipant(name: string, userId: number): boolean {
  const participants = parseDmParticipants(name);
  if (!participants) return false;
  return participants[0] === userId || participants[1] === userId;
}

/** The canonical name storage uses, so callers never hand-format one. */
export function dmChannelName(userId1: number, userId2: number): string {
  return `dm_${Math.min(userId1, userId2)}_${Math.max(userId1, userId2)}`;
}
