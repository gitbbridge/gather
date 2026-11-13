import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.GATHER_TEST_ORIGIN || "http://127.0.0.1:8787";
const target = new URL(baseURL);
const allowedHosts = new Set([
  "127.0.0.1",
  "localhost",
  "sandbox.gatherforgood.bid",
]);

if (process.env.GATHER_ENVIRONMENT !== "staging") {
  throw new Error("Browser tests are staging-only. Set GATHER_ENVIRONMENT=staging.");
}
if (!allowedHosts.has(target.hostname)) {
  throw new Error(`Refusing to run browser tests against ${target.hostname}.`);
}

const localTarget = target.hostname === "127.0.0.1" || target.hostname === "localhost";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: true,
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: localTarget
    ? {
        command: "npm run staging:start:local",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
