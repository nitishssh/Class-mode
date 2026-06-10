import { test, expect } from "@playwright/test";

test.describe("Authentication Flows", () => {
  test("should load login page successfully", async ({ page }) => {
    await page.goto("http://localhost:5001/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should login with admin credentials and redirect to admin dashboard", async ({ page }) => {
    await page.goto("http://localhost:5001/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/admin-dashboard/);
  });

  test("should login with teacher credentials and redirect to teacher dashboard", async ({ page }) => {
    await page.goto("http://localhost:5001/login");
    await page.fill('input[name="email"]', "teacher@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/teacher-dashboard/);
  });
});
