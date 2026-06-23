import { describe, it, expect } from "vitest";
import {
  getDashboardPath,
  canChooseOnboardingRole,
  CHANGEABLE_DEFAULT_ROLES,
} from "../../client/src/lib/role-routes";

// These pure helpers are shared by the router and the onboarding flow.
// role-routes.ts has no React/DOM imports, so it runs in the node test env.

describe("getDashboardPath", () => {
  it("maps each role to its dashboard", () => {
    expect(getDashboardPath("principal")).toBe("/principal-dashboard");
    expect(getDashboardPath("school_admin")).toBe("/school-admin-dashboard");
    expect(getDashboardPath("admin")).toBe("/admin-dashboard");
    expect(getDashboardPath("teacher")).toBe("/teacher-dashboard");
    expect(getDashboardPath("student")).toBe("/student-dashboard");
    expect(getDashboardPath("parent")).toBe("/parent-dashboard");
  });

  it("is case-insensitive", () => {
    expect(getDashboardPath("Principal")).toBe("/principal-dashboard");
    expect(getDashboardPath("STUDENT")).toBe("/student-dashboard");
  });

  it("falls back to the teacher dashboard for unknown/empty roles", () => {
    expect(getDashboardPath("")).toBe("/teacher-dashboard");
    expect(getDashboardPath("wizard")).toBe("/teacher-dashboard");
  });
});

describe("canChooseOnboardingRole", () => {
  // Must mirror the server's CHANGEABLE_DEFAULT_ROLES in routes/onboarding.ts.
  // If the server set changes, this test should change with it — that is the
  // point: it locks client and server role rules together.
  it("lets only self-signup defaults (school_admin, admin) choose a role", () => {
    expect(canChooseOnboardingRole("school_admin")).toBe(true);
    expect(canChooseOnboardingRole("admin")).toBe(true);
  });

  it("locks invited/fixed roles so the UI never offers a server-rejected choice", () => {
    for (const role of ["teacher", "principal", "student", "parent"]) {
      expect(canChooseOnboardingRole(role)).toBe(false);
    }
  });

  it("treats missing/empty role as not changeable", () => {
    expect(canChooseOnboardingRole(undefined)).toBe(false);
    expect(canChooseOnboardingRole(null)).toBe(false);
    expect(canChooseOnboardingRole("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(canChooseOnboardingRole("School_Admin")).toBe(true);
    expect(canChooseOnboardingRole("TEACHER")).toBe(false);
  });

  it("exposes exactly the two changeable default roles", () => {
    expect([...CHANGEABLE_DEFAULT_ROLES].sort()).toEqual(["admin", "school_admin"]);
  });
});
