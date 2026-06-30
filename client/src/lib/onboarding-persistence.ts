// Best-effort local persistence of OnboardingV2 progress, so a user who drops
// off mid-flow (refresh, navigate away, browser crash) resumes where they left
// off instead of restarting at step 1. Namespaced by uid so two accounts on a
// shared machine never read each other's draft. All access is guarded — if
// localStorage is unavailable or full, persistence silently no-ops.

const KEY_PREFIX = "classmode:onboarding:v2:";

export interface PersistedOnboarding {
  step: number;
  // Opaque draft of the onboarding form; the consumer casts it on read.
  data: unknown;
}

function keyFor(uid: string | undefined | null): string | null {
  return uid ? KEY_PREFIX + uid : null;
}

export function loadOnboardingProgress(uid: string | undefined | null): PersistedOnboarding | null {
  const key = keyFor(uid);
  if (!key || typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.step === "number" &&
      parsed.data &&
      typeof parsed.data === "object"
    ) {
      return parsed as PersistedOnboarding;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(
  uid: string | undefined | null,
  payload: PersistedOnboarding
): void {
  const key = keyFor(uid);
  if (!key || typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — persistence is best-effort.
  }
}

export function clearOnboardingProgress(uid: string | undefined | null): void {
  const key = keyFor(uid);
  if (!key || typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
