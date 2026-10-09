// The page on a phone: concrete defects, fixed one by one
import type { Page } from "@playwright/test";
import { test, expect, ready, select, still, type Win } from "../../page";
import { A } from "../../expect";

// (as a phone is: a touch screen, at 3 device pixels a CSS pixel, the
// page's meta viewport honoured; Firefox has no mobile mode, so there
// only the size)
test.use({
  isMobile: async ({ browserName }, use) => use(browserName !== "firefox"),
  hasTouch: async ({ browserName }, use) => use(browserName !== "firefox"),
  deviceScaleFactor: async ({ browserName }, use) =>
    use(browserName === "firefox" ? 1 : 3),
});

const SIZES = [[390, 844], [375, 667]] as const;
const at = (page: Page, width: number, height: number) =>
  ready(page, { width, height });
// (an element cut at its end: its content wider than its box)
const cut = (page: Page, sel: string) => page.locator(sel).evaluate((e) =>
  e.scrollWidth > e.clientWidth + 1);

for (const [w, h] of SIZES) {
  test(`${w}px: the bar shows the selection and its button whole`,
    async ({ page, browserName }) => {
      await at(page, w, h);
      // (the phone's: a coarse pointer, as test.use above asks)
      expect(await page.evaluate(() => matchMedia("(pointer: coarse)")
        .matches)).toBe(browserName !== "firefox");
      await select(page, "mid", A);
      const bar = page.locator("#details");
      expect(await cut(page, "#details .rsel")).toBe(false);
      expect(await cut(page, "#details .rstart")).toBe(false);
      // (Start, a deliberate act, may grow the bar; stepping does not)
      await page.locator('#details button[data-r="start"]').click();
      const h0 = (await bar.boundingBox())!.height;
      await page.locator('#details button[data-r="next"]').click();
      expect((await bar.boundingBox())!.height).toBeCloseTo(h0, 2);
      // (a phone: no count cut short)
      expect(await cut(page, "#details .rcount")).toBe(false);
    });
}

for (const [w, h] of SIZES) {
  test(`${w}px: no scene scrolls sideways; no popover runs out of its box`,
    async ({ page }) => {
      await at(page, w, h);
      const scenes = await page.locator("#picker button[data-snapshot]")
        .evaluateAll((bs) => bs.map((b) => (b as HTMLElement).dataset
          .snapshot!));
      for (const s of scenes) {
        await page.locator(`#picker button[data-snapshot="${s}"]`).click();
        await page.waitForFunction(() => (window as Win).results
          ?.done);
        await still(page);
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
  test(`${w}px: the bar's buttons are tap-sized`,
    async ({ page }) => {
      await at(page, w, h);
      await page.locator('#picker button[data-snapshot="alice"]')
        .click();
      await page.waitForFunction(() => (window as Win).results
        ?.done);
      await select(page, "alice", "totalScore");
      expect(await small(page, "#details button")).toEqual([]);
      await page.locator('#details button[data-r="start"]').click();
      expect(await small(page, "#details.rbar button")).toEqual([]);
    });
}
