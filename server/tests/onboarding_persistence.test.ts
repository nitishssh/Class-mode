import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadOnboardingProgress,
  saveOnboardingProgress,
  clearOnboardingProgress,
} from "../../client/src/lib/onboarding-persistence";

// The util guards on `window`/`localStorage`. Provide an in-memory stand-in so
// the storage logic runs in the node test env.
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    _map: m,
  };
}

beforeEach(() => {
  (globalThis as any).window = { localStorage: makeStorage() };
});
afterEach(() => {
  delete (globalThis as any).window;
});

const sample = { step: 3, data: { role: "teacher", name: "Springfield High" } };

describe("onboarding-persistence", () => {
  it("round-trips saved progress for a uid", () => {
    saveOnboardingProgress("user-1", sample);
    expect(loadOnboardingProgress("user-1")).toEqual(sample);
  });

  it("namespaces by uid — accounts on a shared machine don't bleed", () => {
    saveOnboardingProgress("user-1", sample);
    expect(loadOnboardingProgress("user-2")).toBeNull();
  });

  it("clears a saved draft", () => {
    saveOnboardingProgress("user-1", sample);
    clearOnboardingProgress("user-1");
    expect(loadOnboardingProgress("user-1")).toBeNull();
  });

  it("returns null with no uid and never writes for a missing uid", () => {
    expect(loadOnboardingProgress(undefined)).toBeNull();
    saveOnboardingProgress(undefined, sample);
    expect((globalThis as any).window.localStorage._map.size).toBe(0);
  });

  it("returns null (no throw) on corrupted stored JSON", () => {
    (globalThis as any).window.localStorage.setItem("classmode:onboarding:v2:user-1", "{not json");
    expect(loadOnboardingProgress("user-1")).toBeNull();
  });

  it("ignores malformed payloads missing step/data", () => {
    (globalThis as any).window.localStorage.setItem(
      "classmode:onboarding:v2:user-1",
      JSON.stringify({ foo: "bar" })
    );
    expect(loadOnboardingProgress("user-1")).toBeNull();
  });

  it("no-ops without throwing when window is absent (SSR-safe)", () => {
    delete (globalThis as any).window;
    expect(() => saveOnboardingProgress("user-1", sample)).not.toThrow();
    expect(loadOnboardingProgress("user-1")).toBeNull();
  });
});
