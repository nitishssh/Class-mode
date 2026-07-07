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
export async function signUp(
  page: Page,
  account: SignedUpAccount
): Promise<void> {
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
 * KNOWN BUG WORKAROUND (see follow-up task filed against
 * server/lib/pg-queries.ts's pgUpsertSchool): a school's `code` is derived
 * by slicing the owner's uid (== email, for local-password accounts) to its
 * first 20 RAW characters and THEN stripping non-alphanumerics — so two
 * emails sharing the same first-20-raw-characters prefix collide onto the
 * identical school_code, silently merging two schools into one tenant
 * (`ON CONFLICT (code) DO UPDATE` reuses the first school's row). A prefix
 * like "attendance-teacher-" followed by a numeric suffix never reaches
 * that 20-char boundary before the differentiating digits do, so every E2E
 * run collided onto the same code ("ATTENDANCETEACHER1") and accumulated
 * classes/students across runs instead of getting a fresh tenant each time.
 *
 * Putting the random component FIRST keeps every generated email's
 * first-20-raw-characters prefix unique, which sidesteps the collision
 * without needing the product code fixed first.
 */
export function uniqueEmail(prefix: string): string {
  const unique = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  return `e2e${unique}-${prefix}@e2e-classmode.test`;
}
