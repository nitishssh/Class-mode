import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// Load test env vars before any test module is imported.
// Module-level guards (e.g. JWT_SECRET checks) fire during ESM static import
// resolution, which happens before setupFiles — so dotenv must run here.
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
    include: ["server/tests/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "e2e/**",
      "features/**",
      "mobile/**",
    ],
  },
});
