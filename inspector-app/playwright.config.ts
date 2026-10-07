import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_PORT ?? "5181";

export default defineConfig({
  testDir: "test/e2e",
  use: {
    // (as bin/run.mjs: motion only where a test asks for it)
    reducedMotion: "reduce",
    baseURL: process.env.PAGE ??
      `http://localhost:${PORT}/demos/inspector-next/`,
  },
  webServer: process.env.PAGE ? undefined : {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/demos/inspector-next/`,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
