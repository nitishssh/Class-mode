import { Page, expect } from "@playwright/test";
import { getLatestRegistrationOtp } from "./db";

export const BASE_URL = "http://localhost:5001";

/** A password satisfying registerPasswordSchema (8+ chars, letter + number). */
export const TEST_PASSWORD = "TestPass123";

export interface SignedUpAccount {
  name: string;
  email: string;
  workspaceName: string;
  password: string;
}

/**
 * Fills and submits the "Create an account" tab of the shared
 * FirebaseAuthDialog (client/src/components/auth/firebase-auth-dialog.tsx).
 * Self-signup always creates a school_admin-role workspace owner — the
 * onboarding wizard is where they pick principal/teacher/school_admin as
 * their onboarding role (see canChooseOnboardingRole).
 */
export async function signUp(page: Page, account: SignedUpAccount): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole("button", { name: "Register now" }).click();
  await page.locator('input[name="name"]').fill(account.name);
  await page.locator('input[name="email"]').fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.locator('input[name="confirmPassword"]').fill(account.password);
  await page.locator('input[name="workspaceName"]').fill(account.workspaceName);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/.*\/verify-email/, { timeout: 15000 });
}

/**
 * Reads the 4-digit registration OTP back from the DB (no SMTP is configured
 * in test/dev — server/lib/mailer.ts logs mail instead of sending it) and
 * completes the /verify-email step.
 */
export async function verifyEmail(page: Page, email: string): Promise<void> {
  const otp = await getLatestRegistrationOtp(email);
  const digitInputs = page.locator('input[inputMode="numeric"]');
  await expect(digitInputs).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await digitInputs.nth(i).fill(otp[i]);
  }
  // A freshly-verified self-signup account has not finished onboarding yet,
  // so /dashboard's role-router redirects to /onboarding rather than landing
  // on a role dashboard directly.
  await expect(page).toHaveURL(/.*\/(dashboard|onboarding)/, { timeout: 15000 });
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

/**
 * Generates an email guaranteed unique across test runs.
 *
 * Putting the random component first keeps every generated email visually
 * distinct at a glance in test output/DB queries. This previously also
 * worked around a pgUpsertSchool school-code collision (fixed: school codes
 * now strip non-alphanumerics before slicing, with a collision-retry
 * suffix — see server/lib/pg-queries.ts's makeUniqueSchoolCode), so it's no
 * longer load-bearing for tenant isolation, just a readability nicety.
 */
export function uniqueEmail(prefix: string): string {
  const unique = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  return `e2e${unique}-${prefix}@e2e-classmode.test`;
}
