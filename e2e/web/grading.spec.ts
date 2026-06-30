import { test, expect } from "@playwright/test";

test.describe("AI Grading View", () => {
  test.beforeEach(async ({ page }) => {
    // Log in as teacher
    await page.goto("http://localhost:5001/login");
    await page.fill('input[name="email"]', "teacher@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for redirect to teacher dashboard
    await expect(page).toHaveURL(/.*\/teacher-dashboard/);
  });

  test("should load the pending grading page successfully", async ({ page }) => {
    await page.goto("http://localhost:5001/grading");
    await expect(page.getByRole("heading", { name: "Pending Grading" })).toBeVisible();
  });
});
