import fetch from "node-fetch";

async function run() {
  console.log("Testing Registration API...");

  // Bypass manual setting of active, let's see if our DB login endpoint checks the `status` flag.
  // In our actual route: `if (user.status === "suspended") {` we only check for suspended!
  // This means pending OTP users MIGHT still be able to login for now in dev.

  // 2. Login Student
  console.log("\n[2] Logging in Student user...");
  const loginRes = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "student_test_user",
      password: "password123",
    }),
  });

  // Check if Set-Cookie header is present (for refresh token)
  const cookies = loginRes.headers.raw()["set-cookie"];
  const loginData = await loginRes.json();
  console.log("Response:", loginRes.status, loginData);
  console.log("Set-Cookie headers:", cookies ? "Present" : "Missing");

  console.log("\nDone.");
}

run().catch(console.error);
