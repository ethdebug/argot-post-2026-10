// During a walkthrough the panel (bar and details) sticks to the top of
// its scroll container, below the container's scroll-padding-top; each
// step brings its lit rows into view under it, scrolling only when they
// are out of view; Start scrolls first, then unfolds; Exit goes back to
// where the reader was
import { test, expect, type Page } from "@playwright/test";
import { C } from "../../expect";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page, w = 1440, h = 900) => {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const select = (page: Page, sel: string) => page.evaluate((x) =>
  (window as unknown as W).select("mid", { sel: x }), sel);
const next = (page: Page) =>
  page.locator('#details button[data-r="next"]').click();
// (the page, still for two readings)
const settled = (page: Page) => page.waitForFunction(() =>
  new Promise((ok) => {
    const a = scrollY;
    setTimeout(() => ok(Math.abs(scrollY - a) < 0.5), 120);
  }));
const geo = (page: Page) => page.evaluate(() => {
  const p = document.querySelector(".wpanel")!.getBoundingClientRect();
  const lit = [...document.querySelectorAll(
    "#panel .view:not([hidden]) .wrow:is(.on, .gut)")].map((r) =>
    r.getBoundingClientRect());
  return { top: p.top, bottom: p.bottom, y: scrollY, h: innerHeight,
    litTop: Math.min(...lit.map((r) => r.top)),
    litBottom: Math.max(...lit.map((r) => r.bottom)) };
});

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`${w}px: the panel sticks; every step's lit rows are in view ` +
    "under it", async ({ page }) => {
    await ready(page, w, h);
    await select(page, `${C}.name`);
    await page.locator('#details button[data-r="start"]').click();
    await settled(page);
    for (let k = 0; k < 20; k++) {
      await settled(page);
      const g = await geo(page);
      expect(g.top, `step ${k}: stuck at the top`).toBeLessThan(1);
      if (k > 0) {
        expect(g.litTop, `step ${k}: lit rows under the panel`)
          .toBeGreaterThanOrEqual(g.bottom - 1);
        expect(g.litTop, `step ${k}: lit rows above the fold`)
          .toBeLessThan(g.h);
      }
      const n = page.locator('#details button[data-r="next"]');
      if (await n.isDisabled()) break;
      await n.click();
    }
  });
}

test("a step whose lit rows are in view does not scroll the page",
  async ({ page }) => {
    await ready(page);
    await select(page, "playerList");
    await page.locator('#details button[data-r="start"]').click();
    await settled(page);
    const y = (await geo(page)).y;
    await next(page);
    await settled(page);
    expect((await geo(page)).y).toBe(y);
  });

test("a host's scroll-padding-top: the panel sticks below it",
  async ({ page }) => {
    await ready(page);
    await page.evaluate(() => {
      const hd = document.createElement("header");
      hd.style.cssText = "position: sticky; top: 0; height: 80px; " +
        "z-index: 100; background: #888";
      document.body.prepend(hd);
      document.documentElement.style.scrollPaddingTop = "80px";
    });
    await select(page, `${C}.name`);
    await page.locator('#details button[data-r="start"]').click();
    await settled(page);
    await page.evaluate(() => scrollBy(0, 500));
    await settled(page);
    const top = (await geo(page)).top;
    expect(top).toBeGreaterThanOrEqual(79.5);
    expect(top).toBeLessThan(81);
  });

test("Start scrolls first, then unfolds; Exit goes back to where the " +
  "reader was", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ready(page);
    await select(page, "players");
    await page.evaluate(() => scrollTo(0, 120));
    await settled(page);
    // (while the page scrolls, the details stay shut: sampled every
    // frame from before the click)
    await page.evaluate(() => {
      const out: number[][] = [];
      (window as unknown as { samples: number[][] }).samples = out;
      const t0 = performance.now();
      const tick = () => {
        out.push([scrollY, document.querySelector<HTMLElement>("#dwrap")!
          .offsetHeight]);
        if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
      };
      tick();
    });
    await page.locator('#details button[data-r="start"]').click();
    await page.waitForTimeout(2700);
    const during = await page.evaluate(() =>
      (window as unknown as { samples: number[][] }).samples);
    // (a smooth scroll's last pixel may land as the details start)
    const moving = during.filter((x, k) => k > 0 &&
      Math.abs(x[0] - during[k - 1][0]) > 0.5 &&
      Math.abs(x[0] - during.at(-1)![0]) > 2);
    expect(moving.length).toBeGreaterThan(0);
    expect(moving.every(([, hh]) => hh === 0)).toBe(true);
    expect(during.at(-1)![1]).toBeGreaterThan(100);
    await page.locator('#details button[data-r="exit"]').click();
    await page.waitForTimeout(1200);
    expect(Math.round(await page.evaluate(() => scrollY))).toBe(120);
  });
