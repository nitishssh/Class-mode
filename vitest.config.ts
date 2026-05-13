import { defineConfig } from "vitest/config";
import path from "path";

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
