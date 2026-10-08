import { defineConfig } from "vitest/config";
import path from "node:path";

// Load DATABASE_URL etc. from .env for the integration tests (they skip themselves when it is missing).
const root = import.meta.dirname;
try {
  process.loadEnvFile(path.resolve(root, ".env"));
} catch {
  /* no .env: integration tests are skipped */
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(root, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      AUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      APP_TIMEZONE: "UTC",
      WHATSAPP_DRY_RUN: "true",
      DEFAULT_COUNTRY_CODE: "91",
    },
  },
});
