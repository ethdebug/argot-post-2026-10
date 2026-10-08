// The page on a phone: concrete defects, fixed one by one
import type { Page } from "@playwright/test";
import { test, expect, ready, select, type Win } from "../../page";

const SIZES = [[390, 844], [375, 667]] as const;
const at = (page: Page, width: number, height: number) =>
  ready(page, { width, height });
// (an element cut at its end: its content wider than its box)
const cut = (page: Page, sel: string) => page.locator(sel).evaluate((e) =>
  e.scrollWidth > e.clientWidth + 1);

for (const [w, h] of SIZES) {
  test(`${w}px: the bar shows the selection and its button whole`,
    async ({ page }) => {
      await at(page, w, h);
      await select(page, "mid", "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]");
      const bar = page.locator("#details");
      expect(await cut(page, "#details .rsel")).toBe(false);
      expect(await cut(page, "#details .rstart")).toBe(false);
      const h0 = (await bar.boundingBox())!.height;
      await page.locator('#details button[data-r="start"]').click();
      expect((await bar.boundingBox())!.height).toBeCloseTo(h0, 2);
    });
}

for (const [w, h] of SIZES) {
  test(`${w}px: no scene scrolls sideways; no popover runs out of its box`,
    async ({ page }) => {
      await at(page, w, h);
      const scenes = await page.locator("#picker button[data-fixture]")
        .evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset
          .fixture!));
      for (const s of scenes) {
        await page.locator(`#picker button[data-fixture="${s}"]`).click();
        await page.waitForFunction(() => (window as Win).results
          ?.done);
        await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
        expect(await page.evaluate(() => [document.documentElement
          .scrollWidth, ...[...document.querySelectorAll(".pop")]
          .filter((p) => p.scrollWidth > p.clientWidth + 1)
          .map((p) => (p as HTMLElement).innerText)]), s)
          .toEqual([await page.evaluate(() => document.documentElement
            .clientWidth)]);
      }
    });
}

// (a tap target: 32px at least each way)
const small = (page: Page, sel: string) => page.locator(sel).evaluateAll(
  (es) => es.filter((e) => (e as HTMLElement).offsetParent).map((e) => {
    const r = e.getBoundingClientRect();
    return r.width < 32 || r.height < 32 ? `${(e as HTMLElement).innerText
      } ${Math.round(r.width)}x${Math.round(r.height)}` : "";
  }).filter(Boolean));

for (const [w, h] of SIZES) {
  test(`${w}px: the bar's buttons and Before | After are tap-sized`,
    async ({ page }) => {
      await at(page, w, h);
      await page.locator('#picker button[data-fixture="arcade-alice"]')
        .click();
      await page.waitForFunction(() => (window as Win).results
        ?.done);
      expect(await small(page, "#mode button")).toEqual([]);
      await select(page, "alice", "totalScore");
      const bar = page.locator("#details");
      const h0 = (await bar.boundingBox())!.height;
      expect(await small(page, "#details button")).toEqual([]);
      await page.locator('#details button[data-r="start"]').click();
      expect(await small(page, "#details .rbar button")).toEqual([]);
      expect((await bar.boundingBox())!.height).toBeCloseTo(h0, 2);
    });
}
