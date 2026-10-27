// The figures on a phone: concrete defects, fixed one by one
import type { Page } from "@playwright/test";
import { test, expect, ready, still } from "../../page";

// (as a phone is: a touch screen, at 3 device pixels a CSS pixel, the
// page's meta viewport honoured; Firefox has no mobile mode, so there
// only the size)
test.use({
  isMobile: async ({ browserName }, use) => use(browserName !== "firefox"),
  hasTouch: async ({ browserName }, use) => use(browserName !== "firefox"),
  deviceScaleFactor: async ({ browserName }, use) =>
    use(browserName === "firefox" ? 1 : 3),
});

// (a phone's figure: its text column inside the page's gutters)
const SIZES = [[358, 844], [343, 667]] as const;
const at = (page: Page, width: number, height: number, scene?: string) =>
  ready(page, { scene, width, height });
// (an element cut at its end: its content wider than its box)
const cut = (page: Page, sel: string) => page.locator(sel).evaluate((e) =>
  e.scrollWidth > e.clientWidth + 1);

for (const [w, h] of SIZES) {
  test(`${w}px: the walkthrough's bar shows its count whole; stepping ` +
    "keeps its height", async ({ page, browserName }) => {
    await at(page, w, h, "pointer-walkthrough");
    // (the phone's: a coarse pointer, as test.use above asks)
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)")
      .matches)).toBe(browserName !== "firefox");
    const bar = page.locator("#details");
    await page.locator('#details button[data-r="next"]').click();
    const h0 = (await bar.boundingBox())!.height;
    await page.locator('#details button[data-r="next"]').click();
    expect((await bar.boundingBox())!.height).toBeCloseTo(h0, 2);
    // (a phone: no count cut short)
    expect(await cut(page, "#details .rcount")).toBe(false);
  });
}

for (const [w, h] of SIZES) {
  test(`${w}px: no storage figure is wider than its frame; no popover ` +
    "runs out of its box", async ({ page }) => {
    for (const scene of ["pitfall-nesting", "pointer-walkthrough",
      "pitfall-compiler"]) {
      await at(page, w, h, scene);
      await still(page);
      expect(await page.evaluate(() => [document.documentElement
        .scrollWidth, ...[...document.querySelectorAll(".pop")]
        .filter((p) => p.scrollWidth > p.clientWidth + 1)
        .map((p) => (p as HTMLElement).innerText)]), scene)
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
  test(`${w}px: the walkthrough bar's buttons are tap-sized`,
    async ({ page }) => {
      await at(page, w, h, "pointer-walkthrough");
      expect(await small(page, "#details button")).toEqual([]);
      await page.locator('#details button[data-r="next"]').click();
      expect(await small(page, "#details button")).toEqual([]);
    });
}
