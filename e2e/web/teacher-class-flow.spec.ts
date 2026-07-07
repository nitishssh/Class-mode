import { test, expect } from "@playwright/test";
import { signUp, verifyEmail, uniqueEmail, TEST_PASSWORD, BASE_URL } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";
import { getLatestInviteToken } from "./helpers/db";

// Regression guard for ISSUE-008 (Beta Launch Plan, Phase 0/4): a teacher
// must be able to create a class, invite a student, and have that student
// actually land in the class roster after accepting the invite — the
// class-creation + invite endpoints (server/routes/onboarding.ts POST
// /classes, POST /invite/student, POST /invite/accept) are exercised
// end-to-end rather than just unit-tested in isolation.
test.describe("Teacher class flow — create class, invite student, student joins", () => {
  test("teacher creates a class, invites a student, and the student appears in the roster", async ({
    page,
  }) => {
    const teacherEmail = uniqueEmail("teacher-flow");
    const workspaceName = `E2E Teacher School ${Date.now()}`;
    const className = `E2E Class ${Date.now()}`;
    const parentEmail = uniqueEmail("parent-flow");
    const studentName = "Riya Student";

    await test.step("teacher signs up and completes onboarding", async () => {
      await signUp(page, {
        name: "Tara Teacher",
        email: teacherEmail,
        workspaceName,
        password: TEST_PASSWORD,
      });
      await verifyEmail(page, teacherEmail);
      await completeOnboarding(page, "teacher", {
        institutionName: workspaceName,
        city: "Pune",
      });
    });

    await test.step("teacher creates a class", async () => {
      await page.goto(`${BASE_URL}/onboarding/teacher`);
      await page.getByPlaceholder("Grade 5 – Section A").fill(className);
      await page.getByRole("button", { name: "Grade 6" }).click();
      await page.getByRole("button", { name: "Create Class" }).click();
      await expect(page.getByText(className)).toBeVisible({ timeout: 10000 });
    });

    await test.step("teacher invites a student to the class", async () => {
      await page.goto(`${BASE_URL}/onboarding/invite-students`);
      await page.getByRole("button", { name: className }).click();
      await page.getByPlaceholder("Riya Gupta").fill(studentName);
      await page.getByPlaceholder("parent@email.com").fill(parentEmail);
      await page.getByRole("button", { name: "Send Invite" }).click();
      await expect(page.getByText("Invited").first()).toBeVisible({ timeout: 10000 });
    });

    await test.step("student accepts the invite via the emailed link", async () => {
      const token = await getLatestInviteToken(parentEmail);
      // Accepting doesn't establish a session (server redirects to /login),
      // so this is safe to do in the same browser context as the teacher.
      await page.goto(`${BASE_URL}/accept-invite?token=${token}`);
      await expect(page.getByRole("heading", { name: `Welcome, ${studentName}!` })).toBeVisible();
      // accept-invite.tsx's <Label> elements aren't wired to their <Input>s via
      // htmlFor/id, so getByLabel doesn't resolve them — target the password
      // fields by type instead (Display name / Email / Password / Confirm).
      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.nth(0).fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Create Account" }).click();
      // invite/accept doesn't establish a session for the new (student)
      // account — the page navigates to /login. Since this browser context
      // still holds the teacher's own session cookie, /login's "already
      // logged in" redirect immediately bounces to /teacher-dashboard —
      // expected, and convenient: the next step reuses that same session.
      await expect(page).toHaveURL(/.*\/(login|teacher-dashboard)/, { timeout: 10000 });
    });

    await test.step("student now appears as Enrolled in the teacher's class roster", async () => {
      // The teacher's own session cookie is still active in this browser
      // context (accept-invite never logged us out), so no re-login needed —
      // just navigate back to the invite list.
      await page.goto(`${BASE_URL}/onboarding/invite-students`);
      await page.getByRole("button", { name: className }).click();
      const rosterRow = page
        .locator("div")
        .filter({ hasText: studentName })
        .filter({ hasText: "Enrolled" });
      await expect(rosterRow.first()).toBeVisible({ timeout: 10000 });
    });
  });
});
