import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: __dirname,
  test: {
    environment: "node",
    include: ["tests/**/*.ts"],
    exclude: ["tests/setup.ts", "tests/microservices-integration.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    alias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
});
