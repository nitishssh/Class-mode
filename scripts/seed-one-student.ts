import "dotenv/config";
import bcrypt from "bcryptjs";
import { connectPostgres } from "../server/db-pg";
import { storage } from "../server/storage";

async function main() {
  await connectPostgres();

  const email = "student@classmode.dev";
  const plainPassword = "Student123!";
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const existing = await storage.getUserByEmail(email);
  if (existing) {
    console.log(`Student already exists: ${email} (id=${existing.id}, role=${existing.role})`);
    console.log(`Login Email: ${email}`);
    console.log(`Login Password: ${plainPassword}`);
    process.exit(0);
  }

  const user = await storage.createUser({
    username: email,
    email,
    password: passwordHash, // createUser stores this directly into password_hash
    name: "Sample Student",
    role: "student",
    status: "active",
    emailVerified: true,
    grade: "8",
    class: "8-A",
  } as any);

  console.log("Created student:");
  console.log(`  id:    ${user.id}`);
  console.log(`  email: ${email}`);
  console.log(`  role:  ${user.role}`);
  console.log("");
  console.log(`Login Email:    ${email}`);
  console.log(`Login Password: ${plainPassword}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
