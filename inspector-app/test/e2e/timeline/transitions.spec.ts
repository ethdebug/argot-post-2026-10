// A step on the timeline (addendum §4): one transition; the bytes the
// step changed marked (chg) until the next; a selection and its
// walkthrough kept, at the same step; none with reduced motion
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const T = "#timeline";
const open = async (page: Page, scene: string) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`./shell.html#scene=${scene}`);
  await expect(page.locator(".view .wrow").first()).toBeVisible();
  await expect(page.locator(`${T} .tmark.cur`)).toHaveCount(1);
};
// (totalScore: slot 2's last byte; 140 = 0x8c, then 170 = 0xaa)
const last = (page: Page) => page.locator(
  '#panel .view .wrow[data-slot$="0002"] .b[data-i="31"]');
// (each view transition started, counted: window.vts)
const COUNT = `window.vts = 0;
  const f = document.startViewTransition;
  if (f) document.startViewTransition = function (x) {
    window.vts++;
    return f.call(document, x);
  };`;
const vts = (page: Page) => page.evaluate(() =>
  (window as unknown as { vts: number }).vts);
const chgd = (page: Page) => page.locator("#panel .view .b.chg")
  .evaluateAll((bs) => bs.map((b) => `${(b.closest(".word") as
    HTMLElement).dataset.slot!.slice(-4)}:${(b as HTMLElement).dataset.i}`)
    .sort());

test.use({ reducedMotion: "no-preference" });

test("a step: one view transition; the step's changes marked, the same " +
  "bytes either way", async ({ page }) => {
  await open(page, "alice");
  // (the transaction's changes, at its after)
  const after = await chgd(page);
  expect(after.length).toBeGreaterThan(0);
  await page.evaluate(COUNT);
  await page.locator(`${T} [data-t="prev"]`).click();
  await expect(last(page)).toHaveText("8c");
  expect(await vts(page)).toBe(1);
  // (stepping back: the bytes it changed, marked at the earlier moment)
  await expect.poll(() => chgd(page)).toEqual(after);
  await expect(last(page)).toHaveClass(/\bchg\b/);
});

test("a walkthrough survives a step, at the same step", async ({ page }) => {
  await open(page, "alice");
  await page.locator('#details button[data-r="start"]').click();
  await page.locator('#details button[data-r="next"]').click();
  const count = await page.locator("#details .rcount").textContent();
  await page.locator(`${T} [data-t="prev"]`).click();
  await expect(last(page)).toHaveText("8c");
  await expect(page.locator("#details.replaying")).toHaveCount(1);
  await expect(page.locator("#details .rcount")).toHaveText(count!);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("a step swaps, with its marks; no transition", async ({ page }) => {
    await open(page, "alice");
    await page.evaluate(COUNT);
    await page.locator(`${T} [data-t="prev"]`).click();
    await expect(last(page)).toHaveText("8c");
    await expect(last(page)).toHaveClass(/\bchg\b/);
    expect(await vts(page)).toBe(0);
  });
});
