// "Show how it was found" brings the bar to the top of the inspector's
// own scroll container, below what the host covers it with (its
// scroll-padding-top), never the window by fixed page offsets
import { test, expect, type Page } from "@playwright/test";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const start = async (page: Page) => {
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: "total" }));
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#details button[data-r="start"]').click();
  // (the smooth scroll, done: the bar still for two frames)
  await page.waitForFunction(() => new Promise((ok) => {
    const y = () => document.querySelector("#details")!
      .getBoundingClientRect().top;
    const a = y();
    setTimeout(() => ok(Math.abs(y() - a) < 0.5), 150);
  }));
};

test("a sticky 80px header: the bar lands whole below it",
  async ({ page }) => {
    await ready(page);
    await page.evaluate(() => {
      const h = document.createElement("header");
      h.id = "host";
      h.style.cssText = "position: sticky; top: 0; height: 80px; " +
        "z-index: 100; background: #888";
      document.body.prepend(h);
      document.documentElement.style.scrollPaddingTop = "80px";
    });
    await start(page);
    const top = await page.evaluate(() => document.querySelector(
      "#details")!.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(79.5);
    expect(top).toBeLessThan(82);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  });

test("inside a scrollable box: that box scrolls, not the window",
  async ({ page }) => {
    await ready(page);
    await page.evaluate(() => {
      const box = document.createElement("div");
      box.id = "host";
      box.style.cssText = "height: 600px; overflow: auto; margin-top: 50px";
      const main = document.querySelector("main")!;
      main.before(box);
      box.append(main);
    });
    await start(page);
    const [win, boxTop, inBox, barTop] = await page.evaluate(() => {
      const b = document.querySelector("#host")!;
      return [scrollY, b.getBoundingClientRect().top, b.scrollTop,
        document.querySelector("#details")!.getBoundingClientRect().top];
    });
    expect(win).toBe(0);
    expect(inBox).toBeGreaterThan(0);
    expect(Math.abs(barTop - boxTop)).toBeLessThan(2);
  });
