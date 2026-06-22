/**
 * Unit tests for client/src/hooks/use-quest-progress.ts
 *
 * The hook runs in a browser environment; we provide minimal localStorage
 * and window.dispatchEvent shims so the pure logic can be exercised in Node.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Shims ────────────────────────────────────────────────────────────────────

const store: Record<string, string> = {};

const localStorageShim = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, val: string) => {
    store[key] = val;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
};

// @ts-ignore — inject browser globals into Node test environment
global.localStorage = localStorageShim;
// @ts-ignore
global.window = { dispatchEvent: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() };

// ── Subject under test ────────────────────────────────────────────────────────
// Dynamic import after shims are in place so the module picks them up.

let QUEST_STORAGE_KEY: string;
let readProgressFromStorage: any;
let markQuestComplete: any;
let setFirstSeenAt: any;
let setPanelDismissed: any;
let hasConfettiFired: any;
let markConfettiFired: any;
let isExpired: any;

beforeEach(async () => {
  localStorageShim.clear();
  vi.clearAllMocks();
  vi.resetModules(); // ensure fresh module state between tests

  // Re-import after resetModules to pick up cleared state
  const mod = await import("@/hooks/use-quest-progress");
  QUEST_STORAGE_KEY = mod.QUEST_STORAGE_KEY;
  readProgressFromStorage = mod.readProgressFromStorage;
  markQuestComplete = mod.markQuestComplete;
  setFirstSeenAt = mod.setFirstSeenAt;
  setPanelDismissed = mod.setPanelDismissed;
  hasConfettiFired = mod.hasConfettiFired;
  markConfettiFired = mod.markConfettiFired;
  isExpired = mod.isExpired;
});

// ── readProgressFromStorage ───────────────────────────────────────────────────

describe("readProgressFromStorage", () => {
  it("returns default progress when key is absent", () => {
    const p = readProgressFromStorage();
    expect(p.completedIds).toEqual([]);
    expect(p.panelDismissed).toBe(true);
    expect(p.firstSeenAt).toBeTruthy();
  });

  it("returns stored progress when key exists", () => {
    const stored = {
      completedIds: ["quest:create-test"],
      panelDismissed: true,
      firstSeenAt: "2026-01-01T00:00:00.000Z",
    };
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(stored));
    const p = readProgressFromStorage();
    expect(p.completedIds).toEqual(["quest:create-test"]);
    expect(p.panelDismissed).toBe(true);
  });

  it("returns default progress when stored JSON is corrupt", () => {
    localStorage.setItem(QUEST_STORAGE_KEY, "not-valid-json{{{");
    const p = readProgressFromStorage();
    expect(p.completedIds).toEqual([]);
  });
});

// ── markQuestComplete ─────────────────────────────────────────────────────────

describe("markQuestComplete", () => {
  it("adds questId to completedIds and persists", () => {
    markQuestComplete("quest:create-test");
    expect(readProgressFromStorage().completedIds).toContain("quest:create-test");
  });

  it("is idempotent — does not add duplicate ids", () => {
    markQuestComplete("quest:create-test");
    markQuestComplete("quest:create-test");
    const ids = readProgressFromStorage().completedIds.filter(
      (id: string) => id === "quest:create-test"
    );
    expect(ids).toHaveLength(1);
  });

  it("dispatches quest-updated event", () => {
    markQuestComplete("quest:create-class");
    expect(global.window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "quest-updated" })
    );
  });

  it("does not dispatch event on duplicate (idempotent path)", () => {
    markQuestComplete("quest:create-class");
    vi.clearAllMocks();
    markQuestComplete("quest:create-class");
    expect(global.window.dispatchEvent).not.toHaveBeenCalled();
  });
});

// ── setFirstSeenAt ────────────────────────────────────────────────────────────

describe("setFirstSeenAt", () => {
  it("writes firstSeenAt when empty", () => {
    localStorage.setItem(
      QUEST_STORAGE_KEY,
      JSON.stringify({ completedIds: [], panelDismissed: false, firstSeenAt: "" })
    );
    setFirstSeenAt("2026-06-01T00:00:00.000Z");
    expect(readProgressFromStorage().firstSeenAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("is a no-op when firstSeenAt is already set", () => {
    const original = "2026-01-01T00:00:00.000Z";
    localStorage.setItem(
      QUEST_STORAGE_KEY,
      JSON.stringify({ completedIds: [], panelDismissed: false, firstSeenAt: original })
    );
    setFirstSeenAt("2026-06-01T00:00:00.000Z");
    expect(readProgressFromStorage().firstSeenAt).toBe(original);
  });
});

// ── setPanelDismissed ─────────────────────────────────────────────────────────

describe("setPanelDismissed", () => {
  it("sets panelDismissed true and dispatches event", () => {
    setPanelDismissed(true);
    expect(readProgressFromStorage().panelDismissed).toBe(true);
    expect(global.window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "quest-updated" })
    );
  });

  it("sets panelDismissed false", () => {
    setPanelDismissed(true);
    setPanelDismissed(false);
    expect(readProgressFromStorage().panelDismissed).toBe(false);
  });
});

// ── confetti flag ─────────────────────────────────────────────────────────────

describe("confetti flag", () => {
  it("hasConfettiFired returns false before any call", () => {
    expect(hasConfettiFired()).toBe(false);
  });

  it("markConfettiFired sets the flag persistently", () => {
    markConfettiFired();
    expect(hasConfettiFired()).toBe(true);
  });
});

// ── isExpired ─────────────────────────────────────────────────────────────────

describe("isExpired", () => {
  it("returns false when firstSeenAt is empty string", () => {
    expect(isExpired({ completedIds: [], panelDismissed: false, firstSeenAt: "" })).toBe(false);
  });

  it("returns false when within 7 days", () => {
    const recent = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired({ completedIds: [], panelDismissed: false, firstSeenAt: recent })).toBe(false);
  });

  it("returns true when past 7 days", () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isExpired({ completedIds: [], panelDismissed: false, firstSeenAt: old })).toBe(true);
  });

  it("returns true at exactly the 7-day boundary (>= comparison)", () => {
    // exactly 7 days ago should be expired
    const boundary = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1).toISOString();
    expect(isExpired({ completedIds: [], panelDismissed: false, firstSeenAt: boundary })).toBe(
      true
    );
  });
});
