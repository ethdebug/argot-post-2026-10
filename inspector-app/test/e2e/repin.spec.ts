import { test, expect, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A re-pin of the vendored library (vendor/PIN, the lockfile) restarts a
// running dev server, which pre-bundles the library again: no old copy
// stays in its cache (vite.config.ts repin). Its own server, on 5190,
// watching a stand-in for vendor/PIN (REPIN_FILES): touching the real
// one would restart every dev server on this checkout.
const URL = "http://localhost:5190/demos/inspector/";

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
    // (not in test-results/, which Vite does not watch)
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "repin-"));
    const pin = path.join(dir, "PIN");
    fs.copyFileSync("vendor/PIN", pin);
    const vite = spawn("npx", ["vite", "--port", "5190", "--strictPort"],
      { stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, REPIN_FILES: pin } });
    let log = "";
    vite.stdout.on("data", (d) => (log += d));
    vite.stderr.on("data", (d) => (log += d));
    try {
      await expect.poll(() => log, { timeout: 30_000 }).toContain("ready");
      await loads(page);
      fs.appendFileSync(pin, "\n");
      await expect.poll(() => log, { timeout: 30_000 })
        .toContain("server restarted");
      await loads(page);
    } finally {
      vite.kill();
      fs.rmSync(dir, { recursive: true });
    }
  });
