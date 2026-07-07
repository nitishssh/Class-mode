import { test, expect } from "@playwright/test";
import { signUp, verifyEmail, uniqueEmail, TEST_PASSWORD, BASE_URL } from "./helpers/auth";
import { completeOnboardingAsPrincipal } from "./helpers/onboarding";

// Regression guard for ISSUE-001/010 (Beta Launch Plan, Phase 0/4): a brand
// new school must be able to sign up, verify their email, complete
// onboarding, and land on a working dashboard where the tenant-scoped pages
// (attendance, fees, student directory) load real data or an honest empty
// state — never a silent 403 disguised as "no data yet" (see PR #305 /
// server/lib/tenant.ts's fail-closed resolveTenantScope).
test.describe("School onboarding — signup to dashboard", () => {
  test("fresh signup completes onboarding and reaches a working dashboard with no 403s", async ({
    page,
  }) => {
    const email = uniqueEmail("onboarding-owner");
    const workspaceName = `E2E School ${Date.now()}`;

    await test.step("sign up", async () => {
      await signUp(page, {
        name: "Priya Owner",
        email,
        workspaceName,
        password: TEST_PASSWORD,
      });
    });

    await test.step("verify email via OTP", async () => {
      await verifyEmail(page, email);
    });

    await test.step("complete onboarding wizard", async () => {
      await completeOnboardingAsPrincipal(page, {
        institutionName: workspaceName,
        city: "Bengaluru",
      });
    });

    await test.step("attendance page loads without a 403", async () => {
      await page.goto(`${BASE_URL}/attendance`);
      await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
      await expect(page.getByText("Access restricted")).not.toBeVisible();
    });

    await test.step("fees page loads without a 403", async () => {
      await page.goto(`${BASE_URL}/fees`);
      await expect(page.getByText("Fees", { exact: true }).first()).toBeVisible();
      await expect(page.getByText("Access restricted")).not.toBeVisible();
    });

    await test.step("student directory loads without a 403", async () => {
      await page.goto(`${BASE_URL}/student-directory`);
      await expect(page.getByRole("heading", { name: "Student Directory" }).first()).toBeVisible();
      await expect(page.getByText("Access restricted")).not.toBeVisible();
    });
  });
});
