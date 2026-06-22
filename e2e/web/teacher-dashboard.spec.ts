import { expect, test } from "@playwright/test";

const teacher = {
  email: "teacher.demo@classmode.local",
  password: "ClassModeDemo123!",
};

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="email"]', teacher.email);
  await page.fill('input[name="password"]', teacher.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/teacher-dashboard$/);
}

test.describe("teacher dashboard", () => {
  test("prioritizes grading and exposes grouped teacher navigation", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: /Good morning/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Needs grading" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Review submission/i }).first()).toHaveAttribute(
      "href",
      "/grading"
    );
    await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(page.getByRole("link", { name: "Tests", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Students" }).click();
    await expect(page.getByRole("link", { name: "My Students" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Directory" })).toBeVisible();
  });

  test("renders useful empty states", async ({ page }) => {
    await page.route("**/api/dashboards/teacher", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stats: { activeTests: 0, totalStudents: 0, avgScore: 0, classesCount: 0 },
          tests: [],
          pendingSubmissions: [],
          liveClasses: [],
        }),
      });
    });

    await login(page);

    await expect(page.getByText("You’re caught up")).toBeVisible();
    await expect(page.getByText("No assessments yet")).toBeVisible();
    await expect(page.getByText("No class scheduled today")).toBeVisible();
  });

  test("keeps teacher navigation usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    await page.getByRole("button", { name: "Toggle menu" }).click();
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tests", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Operations" })).toBeVisible();
  });
});
