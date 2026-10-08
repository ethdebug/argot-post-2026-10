import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "5181";
// (a test tagged @chromium runs in Chromium only: the oracle, the dev
// server's re-pin)
const others = { grepInvert: /@chromium/ };

export default defineConfig({
  testDir: "test/e2e",
  // (a quarter of the cores: the machines these run on are often busy,
  // and a starved browser misses its timing; E2E_WORKERS to change it)
  workers: process.env.E2E_WORKERS ?? (process.env.CI ? 2 : "25%"),
  // (GitHub's runners are slow with WebKit: a walkthrough there takes
  // 15–30 s)
  timeout: process.env.CI ? 90_000 : 30_000,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    // (motion only where a test asks for it)
    reducedMotion: "reduce",
    baseURL: process.env.PAGE ??
      `http://localhost:${PORT}/demos/inspector/`,
    trace: "retain-on-failure",
  },
  webServer: process.env.PAGE ? undefined : {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/demos/inspector/`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, ...others },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, ...others },
  ],
});
