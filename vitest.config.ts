import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Reset in-memory rate-limit windows before every test.
    setupFiles: ["./tests/helpers/setup.ts"],
    // config.ts validates these at import time; provide test values so importing
    // the app doesn't throw. The DB is mocked, so DATABASE_URL is never dialed.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/taskflow_test",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
    },
  },
});
