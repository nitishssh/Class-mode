import { vi, describe, it, expect, beforeEach } from "vitest";

// Exercise the REAL pg-queries implementation (server/tests/setup.ts mocks
// every pg-queries export globally for all other test files) so the actual
// school-code generation logic is what's under test here, not a stand-in.
vi.unmock("../lib/db/pg-queries");

// Minimal stateful fake for the `schools` table — just enough to back the
// three queries pgUpsertSchool issues (lookup by created_by_uid, lookup by
// code, and the INSERT ... RETURNING).
type FakeSchoolRow = {
  id: number;
  code: string;
  name: string;
  city: string | null;
  board: string | null;
  grades_offered: string[];
  logo: string | null;
  approximate_students: string | null;
  created_by_uid: string;
  onboarding_complete: boolean;
};

let schools: FakeSchoolRow[] = [];
let nextId = 1;

const queryMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  if (sql.includes("SELECT * FROM schools WHERE created_by_uid")) {
    const row = schools.find((s) => s.created_by_uid === params[0]);
    return { rows: row ? [row] : [] };
  }
  if (sql.includes("SELECT * FROM schools WHERE code")) {
    const row = schools.find((s) => s.code === params[0]);
    return { rows: row ? [row] : [] };
  }
  if (sql.includes("UPDATE schools SET")) {
    const row = schools.find((s) => s.id === params[params.length - 1]);
    if (!row) return { rows: [] };
    row.name = params[0] as string;
    row.city = (params[1] as string) ?? null;
    row.board = (params[2] as string) ?? null;
    row.grades_offered = (params[3] as string[]) ?? [];
    row.logo = (params[4] as string) ?? null;
    row.approximate_students = (params[5] as string) ?? null;
    row.onboarding_complete = (params[6] as boolean) ?? false;
    return { rows: [row] };
  }
  if (sql.includes("INSERT INTO schools")) {
    const row: FakeSchoolRow = {
      id: nextId++,
      code: params[0] as string,
      name: params[1] as string,
      city: (params[2] as string) ?? null,
      board: (params[3] as string) ?? null,
      grades_offered: (params[4] as string[]) ?? [],
      logo: (params[5] as string) ?? null,
      approximate_students: (params[6] as string) ?? null,
      created_by_uid: params[7] as string,
      onboarding_complete: (params[8] as boolean) ?? false,
    };
    schools.push(row);
    return { rows: [row] };
  }
  return { rows: [] };
});

vi.mock("../db-pg", () => ({
  getPgPool: () => ({ query: queryMock }),
  isPgReady: () => true,
  connectPostgres: vi.fn().mockResolvedValue(undefined),
  withPgClient: async <T>(fn: (client: unknown) => Promise<T>): Promise<T> =>
    fn({ query: queryMock }),
}));

import { pgUpsertSchool } from "../lib/db/pg-queries";

describe("pgUpsertSchool school-code generation", () => {
  beforeEach(() => {
    schools = [];
    nextId = 1;
    queryMock.mockClear();
  });

  it("strips non-alphanumeric characters BEFORE slicing to 20, not after", async () => {
    // Hand-verified: raw uid.slice(0, 20) = "teacher-code-check-9" (ends at
    // the FIRST "9", one char before the second "9") — stripping hyphens
    // from that afterwards (the old, buggy order) gives "TEACHERCODECHECK9".
    // Stripping the full uid first, then slicing to 20, instead gives
    // "TEACHERCODECHECK99EX" — a different code that actually reaches the
    // disambiguating second "9". This is what distinguished two schools
    // whose raw uids previously collided under the old order.
    const school = await pgUpsertSchool({
      uid: "teacher-code-check-99@example.com",
      name: "Order Check School",
    });

    expect(school.code).toBe("TEACHERCODECHECK99EX");
    expect(school.code).not.toBe("TEACHERCODECHECK9"); // the old buggy result
  });

  it("gives two schools whose emails share the same first-20-raw-character prefix distinct codes", async () => {
    // The exact collision reported empirically: two epoch-ms-suffixed
    // signup emails from the same day, differing only after the raw
    // 20-character mark — both used to produce school_code =
    // 'ATTENDANCETEACHER1' and silently merge via
    // `ON CONFLICT (code) DO UPDATE SET name = ...`.
    const uidA = "attendance-teacher-1783381215448-4010@example.com";
    const uidB = "attendance-teacher-1783380511068-38839@example.com";

    const schoolA = await pgUpsertSchool({ uid: uidA, name: "School A" });
    const schoolB = await pgUpsertSchool({ uid: uidB, name: "School B" });

    expect(schoolA.code).not.toBe(schoolB.code);
    expect(schoolA.id).not.toBe(schoolB.id);
    // Neither call silently overwrote the other's row.
    expect(schools).toHaveLength(2);
    expect(schools.find((s) => s.created_by_uid === uidA)?.name).toBe("School A");
    expect(schools.find((s) => s.created_by_uid === uidB)?.name).toBe("School B");
  });

  it("appends a disambiguating suffix when the derived base code is already taken by an unrelated school", async () => {
    const uid = "collision-school@example.com";
    const base = uid
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 20);

    // Seed a pre-existing, unrelated school that already holds the exact
    // base code this new uid would derive.
    schools.push({
      id: 999,
      code: base,
      name: "Pre-existing Unrelated School",
      city: null,
      board: null,
      grades_offered: [],
      logo: null,
      approximate_students: null,
      created_by_uid: "someone-else@example.com",
      onboarding_complete: false,
    });

    const school = await pgUpsertSchool({ uid, name: "New School" });

    expect(school.code).not.toBe(base);
    expect(school.code.startsWith(base)).toBe(true);
    expect(school.id).not.toBe(999);
    // The pre-existing school's row must be untouched.
    expect(schools.find((s) => s.id === 999)?.name).toBe("Pre-existing Unrelated School");
  });

  it("is idempotent for repeat calls with the same uid — updates the existing row instead of creating a second one", async () => {
    const uid = "teacher-repeat-call@example.com";
    const first = await pgUpsertSchool({ uid, name: "Original Name" });
    const second = await pgUpsertSchool({ uid, name: "Renamed" });

    expect(second.id).toBe(first.id);
    expect(second.code).toBe(first.code);
    expect(second.name).toBe("Renamed");
    expect(schools).toHaveLength(1);
  });
});
