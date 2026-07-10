// Global test setup (registered via vitest.config.ts `setupFiles`). Clears all
// rate-limit windows before every test so suites that register/log in
// repeatedly from the same IP don't trip the limiter. Runs before each test
// file's own beforeEach, so a fresh window is guaranteed when tests start.
import { beforeEach } from "vitest";
import { resetRateLimits } from "../../src/middleware/rateLimit.js";

beforeEach(() => {
  resetRateLimits();
});
