import { test, expect } from "@playwright/test";

test.describe("Master Timetable & Conflict Guard", () => {
  test("should authenticate, assign slot, detect conflicts, and delete slot", async ({ page }) => {
    // Register console listeners to capture frontend errors
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

    // 1. Login
    console.log("Navigating to login...");
    await page.goto("http://localhost:5001/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    console.log("Waiting for dashboard redirect...");
    await expect(page).toHaveURL(/.*\/admin-dashboard/);

    // 2. Open Master Timetable Tab
    console.log("Opening Master Timetable Tab...");
    await page.click("text=Master Timetable");
    await expect(page.locator("h2")).toContainText("Master Weekly Timetable");

    // 3. Schedule New Slot
    console.log("Scheduling new slot...");
    await page.click("text=Schedule New Slot");
    await expect(page.locator("text=Schedule Class Period Slot")).toBeVisible();

    // Select Day and Period (Default is Mon & Period 1, but let's select explicitly to be safe)
    await page.getByRole("combobox").nth(0).click();
    await page.locator("role=option").filter({ hasText: "Monday" }).click();

    await page.getByRole("combobox").nth(1).click();
    await page.locator("role=option").filter({ hasText: "Period 1 (08:00)" }).click();

    // Fill details
    await page.fill('input[placeholder="e.g. Advanced Calculus"]', "Mathematics");

    await page.getByRole("combobox").nth(2).click();
    await page.locator("role=option").filter({ hasText: "Math 101" }).click();

    await page.fill('input[placeholder="e.g. Lab 3"]', "Room 101");

    await page.getByRole("combobox").nth(3).click();
    await page.locator("role=option").filter({ hasText: "Jane Teacher" }).click();

    // Confirm no conflict alerts are present initially
    await expect(page.locator("text=Scheduling Conflicts Detected")).not.toBeVisible();

    // Take a screenshot of the filled modal
    console.log("Taking screenshot before assigning slot...");
    await page.screenshot({ path: "test-results/before-assign.png" });

    // Click Assign Slot
    await page.click("text=Assign Slot");

    // Take a screenshot after clicking
    await page.waitForTimeout(1000);
    await page.screenshot({ path: "test-results/after-assign.png" });

    await expect(page.locator("text=Schedule Class Period Slot")).not.toBeVisible();

    // Verify slot in grid
    console.log("Verifying slot is visible in weekly grid...");
    const gridCell = page.locator(".min-w-\\[800px\\]").getByText("Mathematics").first();
    await expect(gridCell).toBeVisible();
    await expect(page.locator("text=Math 101")).toBeVisible();
    await expect(page.locator("text=Jane Teacher")).toBeVisible();
    await expect(page.locator("text=Room 101")).toBeVisible();

    // 4. Test Conflict Detection Engine
    console.log("Testing conflict detection engine...");
    await page.click("text=Schedule New Slot");
    await expect(page.locator("text=Schedule Class Period Slot")).toBeVisible();

    // Select same Day and Period
    await page.getByRole("combobox").nth(0).click();
    await page.locator("role=option").filter({ hasText: "Monday" }).click();

    await page.getByRole("combobox").nth(1).click();
    await page.locator("role=option").filter({ hasText: "Period 1 (08:00)" }).click();

    // Try to book the same Class and Teacher
    await page.fill('input[placeholder="e.g. Advanced Calculus"]', "History");

    await page.getByRole("combobox").nth(2).click();
    await page.locator("role=option").filter({ hasText: "Math 101" }).click();

    await page.fill('input[placeholder="e.g. Lab 3"]', "Room 101");

    await page.getByRole("combobox").nth(3).click();
    await page.locator("role=option").filter({ hasText: "Jane Teacher" }).click();

    // Verify conflict guard warnings appear
    console.log("Checking conflict warnings...");
    await expect(page.locator("text=Scheduling Conflicts Detected")).toBeVisible();
    await expect(
      page.locator("text=Class Conflict: Math 101 is already attending Mathematics")
    ).toBeVisible();
    await expect(
      page.locator("text=Teacher Conflict: Jane Teacher is already scheduled to teach Math 101")
    ).toBeVisible();
    await expect(
      page.locator("text=Room Conflict: Room Room 101 is already occupied by Math 101")
    ).toBeVisible();

    // Verify "Assign Slot" button is disabled due to conflicts
    const assignBtn = page.locator('button:has-text("Assign Slot")');
    await expect(assignBtn).toBeDisabled();

    // Cancel modal
    await page.click("text=Cancel");

    // 5. Delete Slot
    console.log("Deleting slot...");
    const deleteBtn = page.locator("button:has(.lucide-trash2)").first();
    // Hover over grid cell or target parent to reveal the delete button if opacity is 0 in CSS
    await gridCell.hover();
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify slot is removed from grid
    await expect(gridCell).not.toBeVisible();
    console.log("E2E Timetable scheduler test successfully passed.");
  });
});
