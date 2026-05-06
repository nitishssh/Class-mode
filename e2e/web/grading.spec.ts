import { test, expect } from "@playwright/test";

test.describe("AI Grading", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    // Login logic here
  });

  test("should submit assignment for grading", async ({ page }) => {
    await page.goto("/grading");
    await expect(page.locator("text=Pending Grading")).toBeVisible();
  });
});
