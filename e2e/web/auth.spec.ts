import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should load login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Login");
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "test@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/dashboard");
  });
});
