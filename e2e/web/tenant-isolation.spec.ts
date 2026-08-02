import { test, expect, Browser } from "@playwright/test";
import { signUp, verifyEmail, uniqueEmail, TEST_PASSWORD, BASE_URL } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";
import { getLatestInviteToken } from "./helpers/db";

// Regression guard for the fail-closed tenant isolation invariant
// (server/lib/auth/tenant.ts's resolveTenantScope, hardened in PR #305 to
// distinguish a 403 from a genuine empty state): two schools set up
// independently must never see each other's data on the tenant-scoped pages
// — attendance, fees, and student directory. A leak here would mean either
// school_code scoping regressed, or a null-schoolCode account fell through
// to an unscoped query.
test.describe("Tenant isolation — school A never sees school B's data", () => {
  test("two schools onboarded in parallel stay fully isolated on tenant-scoped pages", async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    // Two full school onboardings (signup → verify → onboard → class →
    // invite → accept, twice) took 23s of the default 30s test timeout even
    // on a local machine — comfortably passes locally but leaves too little
    // margin for a colder/slower CI runner (first-time e2e-tests job: fresh
    // Postgres, fresh Vite build, fresh Chromium download all in one job).
    test.setTimeout(90_000);

    const suffix = Date.now();
    const schoolA = {
      teacherEmail: uniqueEmail(`tenant-a-${suffix}`),
      workspaceName: `E2E Tenant School A ${suffix}`,
      className: `Tenant A Class ${suffix}`,
      studentName: "Student Alpha",
      parentEmail: uniqueEmail(`tenant-a-parent-${suffix}`),
    };
    const schoolB = {
      teacherEmail: uniqueEmail(`tenant-b-${suffix}`),
      workspaceName: `E2E Tenant School B ${suffix}`,
      className: `Tenant B Class ${suffix}`,
      studentName: "Student Beta",
      parentEmail: uniqueEmail(`tenant-b-parent-${suffix}`),
    };

    // Two independent browser contexts so each school's session cookie is
    // isolated — this is what "in parallel" means for tenant isolation: two
    // concurrently-live sessions, not necessarily concurrently-executing
    // Playwright steps (signupLimiter is 5/hour/IP, so the two onboarding
    // flows below run one after another to stay under it).
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    async function onboardSchoolWithClassAndStudent(
      page: typeof pageA,
      school: typeof schoolA
    ): Promise<void> {
      await signUp(page, {
        name: "Tenant Teacher",
        email: school.teacherEmail,
        workspaceName: school.workspaceName,
        password: TEST_PASSWORD,
      });
      await verifyEmail(page, school.teacherEmail);
      await completeOnboarding(page, "teacher", {
        institutionName: school.workspaceName,
        city: "Hyderabad",
      });

      await page.goto(`${BASE_URL}/onboarding/teacher`);
      await page.getByPlaceholder("Grade 5 – Section A").fill(school.className);
      await page.getByRole("button", { name: "Grade 6" }).click();
      await page.getByRole("button", { name: "Create Class" }).click();
      await expect(page.getByText(school.className)).toBeVisible({ timeout: 10000 });

      await page.goto(`${BASE_URL}/onboarding/invite-students`);
      await page.getByRole("button", { name: school.className }).click();
      await page.getByPlaceholder("Riya Gupta").fill(school.studentName);
      await page.getByPlaceholder("parent@email.com").fill(school.parentEmail);
      await page.getByRole("button", { name: "Send Invite" }).click();
      await expect(page.getByText("Invited").first()).toBeVisible({ timeout: 10000 });

      const token = await getLatestInviteToken(school.parentEmail);
      await page.goto(`${BASE_URL}/accept-invite?token=${token}`);
      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.nth(0).fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Create Account" }).click();
      await expect(page).toHaveURL(/.*\/(login|teacher-dashboard)/, { timeout: 10000 });

      // accept-invite never logs the current session out — this browser
      // context's cookie still belongs to the teacher who's driving it, so
      // no re-login is needed before checking their own tenant-scoped pages.
    }

    await test.step("onboard school A: teacher + class + student", async () => {
      await onboardSchoolWithClassAndStudent(pageA, schoolA);
    });

    await test.step("onboard school B: teacher + class + student", async () => {
      await onboardSchoolWithClassAndStudent(pageB, schoolB);
    });

    await test.step("school A's attendance page never shows school B's class or student", async () => {
      await pageA.goto(`${BASE_URL}/attendance`);
      await expect(pageA.getByText(schoolA.studentName)).toBeVisible({ timeout: 10000 });
      await expect(pageA.getByText("Access restricted")).not.toBeVisible();
      await expect(pageA.getByText(schoolB.studentName)).not.toBeVisible();
      await expect(pageA.getByText(schoolB.className)).not.toBeVisible();
    });

    await test.step("school B's attendance page never shows school A's class or student", async () => {
      await pageB.goto(`${BASE_URL}/attendance`);
      await expect(pageB.getByText(schoolB.studentName)).toBeVisible({ timeout: 10000 });
      await expect(pageB.getByText("Access restricted")).not.toBeVisible();
      await expect(pageB.getByText(schoolA.studentName)).not.toBeVisible();
      await expect(pageB.getByText(schoolA.className)).not.toBeVisible();
    });

    await test.step("school A cannot fetch school B's roster via a direct API call", async () => {
      const res = await pageA.request.get(
        `${BASE_URL}/api/attendance/roster?className=${encodeURIComponent(schoolB.className)}`
      );
      // school B's class name doesn't exist within school A's tenant scope,
      // so the roster query (scoped to school A's school_code) comes back
      // empty rather than leaking school B's roster — never a cross-tenant
      // data hit, and never an unscoped fall-through.
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(0);
    });

    await test.step("fees and student-directory: neither school's teacher sees the other's data", async () => {
      // "teacher" role can't reach /fees (App.tsx restricts it to
      // principal/school_admin/admin) — student-directory is teacher-visible
      // though, so check that one for cross-tenant leakage too.
      await pageA.goto(`${BASE_URL}/student-directory`);
      await expect(pageA.getByText("Access restricted")).not.toBeVisible();
      await expect(pageA.getByText(schoolB.studentName)).not.toBeVisible();

      await pageB.goto(`${BASE_URL}/student-directory`);
      await expect(pageB.getByText("Access restricted")).not.toBeVisible();
      await expect(pageB.getByText(schoolA.studentName)).not.toBeVisible();
    });

    await contextA.close();
    await contextB.close();
  });
});
