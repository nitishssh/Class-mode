import { describe, expect, it } from "vitest";
import {
  ACCESS_COOKIE_OPTS,
  AUTH_COOKIE_CLEAR_OPTS,
  REFRESH_COOKIE_OPTS,
} from "../lib/auth-workspace";

// Regression: ISSUE-001 — logout passed maxAge to Express clearCookie
// Found by /qa on 2026-07-22
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-22.md
describe("auth cookie clearing options", () => {
  it("preserves cookie security attributes without passing a deprecated lifetime", () => {
    expect(AUTH_COOKIE_CLEAR_OPTS).toEqual({
      httpOnly: ACCESS_COOKIE_OPTS.httpOnly,
      secure: ACCESS_COOKIE_OPTS.secure,
      sameSite: ACCESS_COOKIE_OPTS.sameSite,
    });
    expect(AUTH_COOKIE_CLEAR_OPTS).not.toHaveProperty("maxAge");
    expect(ACCESS_COOKIE_OPTS).toHaveProperty("maxAge");
    expect(REFRESH_COOKIE_OPTS).toHaveProperty("maxAge");
  });
});
