// Regression: the workspace context fetched /api/workspaces once on mount,
// before anyone had signed in. Three symptoms, one cause:
//   1. anonymous visitors to /login fired a request that could only 401,
//   2. signing in never refetched, so the owner of a workspace was told they
//      had none until a full page reload,
//   3. signing out left the previous account's workspace on screen.
// Found by /qa on 2026-08-23
// Report: .gstack/qa-reports/qa-report-localhost-2026-08-23.md

import { test, expect } from "@playwright/test";
import { BASE_URL, TEST_PASSWORD, signUp, uniqueEmail, verifyEmail } from "./helpers/auth";
import { closeDbPool } from "./helpers/db";

test.afterAll(async () => {
  await closeDbPool();
});

test.describe("workspace context follows the session", () => {
  test("an anonymous login page does not request /api/workspaces", async ({ page }) => {
    const workspaceCalls: string[] = [];
    page.on("request", (req) => {
      if (new URL(req.url()).pathname === "/api/workspaces") {
        workspaceCalls.push(req.url());
      }
    });

    await page.goto(`${BASE_URL}/login`);
    // Wait for the auth probe to settle, so the assertion cannot pass simply
    // by checking before the provider had a chance to fire.
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    await page.waitForTimeout(1500);

    expect(workspaceCalls).toEqual([]);
  });

  test("signing in shows the workspace without needing a page reload", async ({ page }) => {
    const email = uniqueEmail("ws-ctx");
    const workspaceName = `WS Ctx ${Date.now()}`;
    await signUp(page, { name: "WS Ctx", email, workspaceName, password: TEST_PASSWORD });
    await verifyEmail(page, email);

    // Mounting the app while already signed in always worked — that is what
    // hid this bug. Sign out (which leaves us on /login with the app still
    // mounted) and sign back in WITHOUT navigating, so the provider has to
    // react to the session changing under it.
    //
    // Deliberately not using the login() helper: it calls page.goto first,
    // and that reload is precisely what used to paper over the failure.
    await page.locator("button:has(svg.lucide-log-out)").first().click();
    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Login", exact: true }).click();

    await expect(page).toHaveURL(/.*\/(dashboard|onboarding)/, { timeout: 15000 });
    // The assertion that matters: the name is present and the empty state is
    // not. Asserting only "not empty" would pass on a spinner.
    await expect(page.getByTestId("workspace-switcher-name")).toHaveText(workspaceName, {
      timeout: 15000,
    });
    await expect(page.getByTestId("workspace-switcher-empty")).toHaveCount(0);
  });

  test("signing out clears the previous account's workspace", async ({ page }) => {
    const email = uniqueEmail("ws-logout");
    const workspaceName = `WS Logout ${Date.now()}`;
    await signUp(page, { name: "WS Logout", email, workspaceName, password: TEST_PASSWORD });
    await verifyEmail(page, email);

    await expect(page.getByTestId("workspace-switcher-name")).toHaveText(workspaceName, {
      timeout: 15000,
    });

    // The sidebar logout control is icon-only, so there is no accessible name
    // to target; go through the same click the user makes.
    await page.locator("button:has(svg.lucide-log-out)").first().click();

    await expect(page).toHaveURL(/.*\/login/, { timeout: 15000 });
    // On a shared device the next person must not see who was here before.
    await expect(page.getByTestId("workspace-switcher-name")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(workspaceName);
  });
});
