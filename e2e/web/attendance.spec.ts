import { test, expect } from "@playwright/test";
import { signUp, verifyEmail, uniqueEmail, TEST_PASSWORD, BASE_URL } from "./helpers/auth";
import { completeOnboarding } from "./helpers/onboarding";
import { getLatestInviteToken } from "./helpers/db";

// Regression guard for the attendance → parent-alert loop (Beta Launch Plan
// Phase 4): marking a student absent must record the mark AND dispatch (or,
// with no WhatsApp credentials configured in dev/test, simulate — see
// server/services/whatsapp.ts's fail-loud-in-prod-only behavior) a parent
// alert. POST /api/attendance responds with { written, notified } — notified
// is the number of absentees whose parent was actually messaged, which is
// the most direct observable signal the app exposes for "alert dispatched"
// (there is no separate in-app notification row for this event; see
// server/routes/attendance.ts and services/notifications-consumer.ts).
test.describe("Attendance — mark absent dispatches a parent alert", () => {
  test("marking a student absent records attendance and notifies their parent", async ({
    page,
  }) => {
    const teacherEmail = uniqueEmail("attendance-teacher");
    const workspaceName = `E2E Attendance School ${Date.now()}`;
    const className = `E2E Attendance Class ${Date.now()}`;
    const parentEmail = uniqueEmail("attendance-parent");
    const studentName = "Absent Student";
    const parentPhone = "+919876543210";

    await test.step("teacher signs up, onboards, creates a class, invites a student", async () => {
      await signUp(page, {
        name: "Attendance Teacher",
        email: teacherEmail,
        workspaceName,
        password: TEST_PASSWORD,
      });
      await verifyEmail(page, teacherEmail);
      await completeOnboarding(page, "teacher", {
        institutionName: workspaceName,
        city: "Chennai",
      });

      await page.goto(`${BASE_URL}/onboarding/teacher`);
      await page.getByPlaceholder("Grade 5 – Section A").fill(className);
      await page.getByRole("button", { name: "Grade 6" }).click();
      await page.getByRole("button", { name: "Create Class" }).click();
      await expect(page.getByText(className)).toBeVisible({ timeout: 10000 });

      await page.goto(`${BASE_URL}/onboarding/invite-students`);
      await page.getByRole("button", { name: className }).click();
      await page.getByPlaceholder("Riya Gupta").fill(studentName);
      await page.getByPlaceholder("parent@email.com").fill(parentEmail);
      await page.getByRole("button", { name: "Send Invite" }).click();
      await expect(page.getByText("Invited").first()).toBeVisible({ timeout: 10000 });

      const token = await getLatestInviteToken(parentEmail);
      await page.goto(`${BASE_URL}/accept-invite?token=${token}`);
      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.nth(0).fill(TEST_PASSWORD);
      await passwordInputs.nth(1).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: "Create Account" }).click();
      await expect(page).toHaveURL(/.*\/(login|teacher-dashboard)/, { timeout: 10000 });
    });

    await test.step("teacher records the student's parent phone number", async () => {
      await page.goto(`${BASE_URL}/attendance`);
      // attendance.tsx auto-selects the first class once the classes list
      // loads (there's exactly one for this fresh teacher), so no dropdown
      // interaction is needed — just wait for the roster to populate.
      await expect(page.getByText(studentName)).toBeVisible({ timeout: 10000 });
      await page.getByText("Add parent phone").click();
      await page.locator('input[placeholder="+91 98765 43210"]').fill(parentPhone);
      // "Save" also matches the (disabled) main attendance save-attendance
      // button ("Save (0/1)") — scope to the small inline phone-edit Save.
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText(parentPhone)).toBeVisible({ timeout: 10000 });
    });

    await test.step("marking the student absent saves attendance and notifies the parent", async () => {
      const attendanceResponse = page.waitForResponse(
        (res) => res.url().includes("/api/attendance") && res.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Absent" }).click();
      await page.getByTestId("save-attendance").click();
      const response = await attendanceResponse;
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.written).toBe(1);
      // No WhatsApp credentials are configured in this test environment, so
      // the send is simulated (server/services/whatsapp.ts) rather than a
      // live Graph API call — but `notified` still counts it, which is the
      // regression guard: the absence-alert pipeline ran end to end.
      expect(body.notified).toBe(1);

      await expect(page.getByText("Attendance saved")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("1 parent(s) notified on WhatsApp")).toBeVisible();
    });
  });
});
