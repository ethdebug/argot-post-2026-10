// The run in the browser (addendum §2.4, §2.5): the shell runs each
// scene's build in a worker, which loads the EVM's chunk; its digests
// are digests.json's (the same trace as in Node); the page (the
// reader) never loads the EVM
import fs from "node:fs";
import { test, expect, usable } from "../../page";
import { expected } from "../../expect";

const digests = JSON.parse(fs.readFileSync(
  "scenarios/arcade/digests.json", "utf8")) as Record<string, string>;
type Win = { runDigest(s: string, b: string): Promise<string> };

test("the shell's runs, in a worker: digests.json's digests",
  async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("./shell.html#scene=mid");
    await expect(page.locator("#tree li[data-path]").first()).toBeVisible();
    for (const [b, want] of Object.entries(digests)) {
      expect(await page.evaluate(([x]) => (window as unknown as Win)
        .runDigest("arcade", x), [b] as const), b).toBe(want);
    }
    // (the scene's values, from its run)
    for (const [path, , value] of expected.mid) {
      // (an address shown short: its whole value in data-full)
      const val = page.locator(`#tree li[data-path="${path}"] > .row .val`);
      await expect.poll(() => val.evaluate((e) => (e.querySelector(
        "[data-full]") as HTMLElement | null)?.dataset.full ?? e.textContent), path)
        .toBe(value);
    }
    // (the shell reads no snapshot: it runs)
    expect(await page.evaluate(() => performance.getEntriesByType(
      "resource").some((e) => e.name.includes("/snapshots/")))).toBe(false);
  });

test("the page never loads the EVM, the worker or a build",
  async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (r) => asked.push(r.url()));
    await page.goto("./");
    await usable(page);
    await page.locator('#picker button[data-id="alice"]').click();
    await page.waitForTimeout(500);
    const evm = /ethereumjs|@ethdebug\/evm|run\/evm|worker|build\.json/;
    expect(asked.filter((u) => evm.test(u) || u.includes("scenario.json")))
      .toEqual([]);
  });
