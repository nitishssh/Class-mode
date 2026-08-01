// ── Production guard ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed E2E test accounts in a production environment.");
}

import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectPostgres } from "../server/db-pg";
import {
  pgFindUserByEmail,
  pgCreateUser,
  pgUpdateUserOnboardingComplete,
} from "../server/lib/db/pg-queries";

// Fixed-credential accounts expected by e2e/web/auth.spec.ts and
// e2e/web/grading.spec.ts (admin@test.com / teacher@test.com, password123),
// which predate the e2e-tests CI job and were written assuming these
// accounts already existed in whatever environment ran them manually.
// Idempotent: safe to run against an already-seeded database.
async function seedE2eTestAccounts() {
  await connectPostgres();
  const passwordHash = await bcrypt.hash("password123", 12);

  const accounts = [
    { email: "admin@test.com", username: "e2e_admin", name: "E2E Admin", role: "admin" },
    { email: "teacher@test.com", username: "e2e_teacher", name: "E2E Teacher", role: "teacher" },
  ] as const;

  for (const account of accounts) {
    const existing = await pgFindUserByEmail(account.email);
    if (existing) {
      console.log(`Skipping ${account.email} — already exists (id ${existing.id})`);
      continue;
    }
    const user = await pgCreateUser({
      authProvider: "local",
      authSubject: account.email,
      email: account.email,
      username: account.username,
      passwordHash,
      name: account.name,
      displayName: account.name,
      role: account.role,
      status: "active",
      emailVerified: true,
    });
    // /dashboard's role-router redirects an incomplete account to
    // /onboarding instead of its role dashboard — these fixed-credential
    // accounts must land directly on /admin-dashboard or /teacher-dashboard.
    await pgUpdateUserOnboardingComplete(user.id);
    console.log(`Created ${account.email} (id ${user.id}, role ${account.role})`);
  }

  process.exit(0);
}

seedE2eTestAccounts().catch((err) => {
  console.error("Failed to seed E2E test accounts:", err);
  process.exit(1);
});
