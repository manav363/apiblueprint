import { defineConfig, devices } from "@playwright/test";

// E2E runs against an already-running stack (docker compose or local dev servers).
// Point at it with E2E_BASE_URL; the backend/mock must be reachable from the
// browser at the URLs the frontend was built with (defaults: :8000 / :4010).
const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
