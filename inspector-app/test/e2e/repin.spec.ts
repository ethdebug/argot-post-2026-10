import { test, expect, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";

// A re-pin of the vendored library (vendor/PIN, the lockfile) restarts a
// running dev server, which pre-bundles the library again: no old copy
// stays in its cache (vite.config.ts repin). Its own server, on 5190.
const URL = "http://localhost:5190/demos/inspector-next/";

async function loads(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() =>
    (window as unknown as { results?: { done: boolean } }).results?.done);
  const r = await page.evaluate(() => (window as unknown as
    { results: { errors: string[]; decoded: object } }).results);
  expect([...errors, ...r.errors]).toEqual([]);
  expect(Object.keys(r.decoded).length).toBeGreaterThan(0);
}

test("a re-pin restarts the dev server; the page loads clean after",
  async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "one server, one browser");
    test.setTimeout(90_000);
    const vite = spawn("npx", ["vite", "--port", "5190", "--strictPort"],
      { stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    vite.stdout.on("data", (d) => (log += d));
    vite.stderr.on("data", (d) => (log += d));
    try {
      await expect.poll(() => log, { timeout: 30_000 }).toContain("ready");
      await loads(page);
      const now = new Date();
      fs.utimesSync("vendor/PIN", now, now);
      await expect.poll(() => log, { timeout: 30_000 })
        .toContain("server restarted");
      await loads(page);
    } finally {
      vite.kill();
    }
  });
