// The storage walkthroughs as the post's walkthrough figure shows them
// (embed.html#scene=pointer-walkthrough), exactly as recorded: for every
// value in its tree, every step's place, title, caption, form, construct
// line, the pointer's band, the focus picker, and the dump's labels (the
// popovers' text). The record is test/golden/walkthrough-dom.json, made
// by running this spec with UPDATE_GOLDEN=1; any difference fails. (The
// engine's own record is src/engine/walkthrough/golden.test.ts's.)
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, ready, select, selected, V } from "../../page";

// (from the app's folder, where the tests run)
const FILE = path.resolve("test/golden/walkthrough-dom.json");

// (its row in reach: each shut group over it opened)
const reach = async (page: Page, p: string) => {
  for (;;) {
    const shut = page.locator("#tree li.collapsed[data-path]").filter({
      has: page.locator(`li[data-path="${p}"]`) });
    if (!await shut.count()) return;
    await shut.first().locator(":scope > .chev").click();
  }
};

test("every storage walkthrough in the post's figure, exactly as " +
  "recorded @chromium @slow", async ({ page }) => {
  test.setTimeout(900_000);
  await ready(page, { scene: "pointer-walkthrough", width: 1440 });
  // (out of the walkthrough the figure opens in, and no selection: the
  // tree whole: Escape in the figure, twice)
  await page.locator("#tree .row.sel").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("#details.replaying")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect.poll(() => selected(page)).toBe(null);
  const paths = await page.locator("#tree li[data-path]")
    .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.path!));
  const got: Record<string, unknown> = {};
  for (const p of paths) {
    await reach(page, p);
    await select(page, p);
    const start = page.locator('#details button[data-r="start"]');
    if (!await start.count() || await start.isDisabled()) continue;
    await start.click();
    const steps = [];
    for (let k = 0; k < 30; k++) {
      await page.mouse.move(1, 1);
      // (one reading a step, once two frames are drawn)
      const { step, last } = await page.evaluate((v) =>
        new Promise<{ step: Record<string, unknown>; last: boolean }>(
          (ok) => requestAnimationFrame(() => requestAnimationFrame(
            () => {
              const all = (q: string) => [...document
                .querySelectorAll(q)].map((e) => (e as HTMLElement)
                .textContent!.replace(/\s+/g, " ").trim());
              ok({ step: {
                place: all("#details .rcount")[0],
                title: all("#details .rtitle")[0],
                cap: all("#details .rcap")[0],
                form: all("#dtext .rform")[0],
                construct: all(".wpanel .rsrc")[0],
                band: all("#ptr .line.on"),
                focus: all("#dpick button"),
                pops: all(`${v} .pop`).sort() },
              last: !!document.querySelector<HTMLButtonElement>(
                '#details button[data-r="next"]')?.disabled });
            }))), V);
      steps.push(step);
      if (last) break;
      await page.locator('#details button[data-r="next"]').click();
    }
    got[p] = steps;
    // (out of the walkthrough: Escape, as a reader leaves it)
    await page.keyboard.press("Escape");
    await expect(page.locator("#details.replaying")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect.poll(() => selected(page)).toBe(null);
  }
  if (process.env.UPDATE_GOLDEN) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, `{\n${Object.keys(got).sort().map((k) =>
      `${JSON.stringify(k)}: ${JSON.stringify(got[k])}`).join(",\n")}\n}\n`);
  }
  const want = JSON.parse(fs.readFileSync(FILE, "utf8"));
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  for (const k of Object.keys(want)) expect(got[k], k).toEqual(want[k]);
});
