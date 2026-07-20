/**
 * Today's date in the DEVICE'S LOCAL timezone as YYYY-MM-DD.
 *
 * Never use `new Date().toISOString().slice(0, 10)` for "today" — that is the
 * UTC date, which for IST users is yesterday until 05:30 local, so attendance
 * pages would default to the wrong school day every morning.
 */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
