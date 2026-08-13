import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// .env.test is gitignored; load it for local dev but fall back to the
// defaults below so CI runners (which don't have the file) still work.
config({ path: path.resolve(process.cwd(), ".env.test") });

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./server/tests/setup.ts"],
    include: ["server/tests/**/*.test.ts", "client/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "features/**"],
    env: {
      NODE_ENV: "test",
      JWT_SECRET: process.env.JWT_SECRET ?? "super_secret_jwt_key_learning_pro_123",
      REFRESH_SECRET: process.env.REFRESH_SECRET ?? "super_secret_jwt_key_learning_pro_123",
      SESSION_SECRET: process.env.SESSION_SECRET ?? "test_session_secret_for_vitest",
    },
  },
});
