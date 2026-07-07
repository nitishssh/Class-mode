import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // Retries are intentionally 0 even in CI: several new specs sign up real
  // accounts against signupLimiter (5/hour/IP, see server/routes/auth.ts).
  // A retry re-runs signUp too, so enabling retries here would burn through
  // that budget faster and mask the actual failure — root-caused instead by
  // exempting non-production environments from signupLimiter, matching the
  // existing convention for the /api/auth limiter in server/index.ts.
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5001",
    trace: "on-first-retry",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5001",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
