import { Page, expect } from "@playwright/test";

export interface OnboardingSchoolDetails {
  institutionName: string;
  city: string;
}

type OnboardingRole = "principal" | "teacher";

// Matches the role label rendered in onboarding-v2.tsx's ROLES array.
const ROLE_LABEL: Record<OnboardingRole, RegExp> = {
  principal: /School Owner \/ Principal/,
  // "Spot who needs help before marks drop" is the Teacher card's unique
  // description text (onboarding-v2.tsx ROLES array) — matching on it avoids
  // colliding with "Tutor", which maps to the same server role but a
  // different userType/card and shares no other button text with "Teacher".
  teacher: /Spot who needs help before marks drop/,
};

const DASHBOARD_PATH: Record<OnboardingRole, RegExp> = {
  principal: /.*\/principal-dashboard/,
  teacher: /.*\/teacher-dashboard/,
};

/**
 * Drives client/src/pages/onboarding-v2.tsx (the wizard a fresh self-signup
 * account lands on) to completion for the given role.
 *
 * Role choice matters for which tenant-scoped pages the account can reach
 * without hitting the *client-side* role gate in App.tsx (a different
 * "Access Denied" screen, not the server 403 this suite regression-guards):
 *   - /attendance and /fees allow principal AND school_admin
 *   - /student-directory allows principal (and teacher/admin) but NOT
 *     school_admin
 * "principal" is therefore used wherever a spec needs all three tenant pages
 * reachable; "teacher" is used for the class-creation/invite-student flow.
 */
export async function completeOnboarding(
  page: Page,
  role: OnboardingRole,
  school: OnboardingSchoolDetails
): Promise<void> {
  await expect(page).toHaveURL(/.*\/(dashboard|onboarding)/, { timeout: 15000 });
  if (!page.url().includes("/onboarding")) {
    await page.goto("http://localhost:5001/onboarding");
  }

  // Step 1 — role
  await page.getByRole("button", { name: ROLE_LABEL[role] }).click();

  // Step 2 — institution name + city
  await page.getByLabel("Institution name").fill(school.institutionName);
  await page.getByLabel("City").fill(school.city);
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3 — board + subjects
  await page.getByRole("button", { name: "CBSE", exact: true }).click();
  await page.getByRole("button", { name: "Math", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4 — grades + cohort size
  await page.getByRole("button", { name: "6-8", exact: true }).click();
  await page.getByRole("button", { name: "50-200", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 5 — current tools (optional) — skip
  await page.getByRole("button", { name: "Skip" }).click();

  // Step 6 — discovery source (optional) — finish
  await page.getByRole("button", { name: "Finish and reveal dashboard" }).click();

  // Step 7 — celebration screen: confetti plays for ~2.2s, then the summary +
  // "Enter your workspace" button appear (CelebrationScreen.tsx). Clicking it
  // calls onComplete(), which navigates to the role dashboard.
  const enterWorkspace = page.getByRole("button", { name: "Enter your workspace" });
  await expect(enterWorkspace).toBeVisible({ timeout: 10000 });
  await enterWorkspace.click();

  await expect(page).toHaveURL(DASHBOARD_PATH[role], { timeout: 15000 });
}

export async function completeOnboardingAsPrincipal(
  page: Page,
  school: OnboardingSchoolDetails
): Promise<void> {
  await completeOnboarding(page, "principal", school);
}
