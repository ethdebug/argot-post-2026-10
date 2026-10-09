// During a walkthrough the panel (bar and details) sticks to the top of
// its scroll container, below the container's scroll-padding-top; each
// step brings its lit rows into view under it, scrolling only when they
// are out of view; Start scrolls first, then unfolds; Exit goes back to
// where the reader was
import type { Page } from "@playwright/test";
import { test, expect, ready, select } from "../../page";
import { C } from "../../expect";

const at = (page: Page, width = 1440, height = 900) =>
  ready(page, { width, height });
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
    "#panel .view[data-side=after] .wrow:is(.on, .gut)")].map((r) =>
    r.getBoundingClientRect());
  return { top: p.top, bottom: p.bottom, y: scrollY, h: innerHeight,
    litTop: Math.min(...lit.map((r) => r.top)),
    litBottom: Math.max(...lit.map((r) => r.bottom)) };
});

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`${w}px: the panel sticks; every step's lit rows are in view ` +
    "under it", async ({ page }) => {
    await at(page, w, h);
    await select(page, "mid", `${C}.name`);
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
    await at(page);
    await select(page, "mid", "playerList");
    await page.locator('#details button[data-r="start"]').click();
    await settled(page);
    const y = (await geo(page)).y;
    await next(page);
    await settled(page);
    expect((await geo(page)).y).toBe(y);
  });

test("a host's scroll-padding-top: the panel sticks below it",
  async ({ page }) => {
    await at(page);
    await page.evaluate(() => {
      const hd = document.createElement("header");
      hd.style.cssText = "position: sticky; top: 0; height: 80px; " +
        "z-index: 100; background: #888";
      document.body.prepend(hd);
      document.documentElement.style.scrollPaddingTop = "80px";
    });
    await select(page, "mid", `${C}.name`);
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
    await at(page);
    await select(page, "mid", "players");
    await page.evaluate(() => scrollTo(0, 120));
    await settled(page);
    // (while the page scrolls, the details stay shut: sampled every
    // frame from before the click, until the details are open and still)
    type S = { samples: number[][]; sampled?: boolean };
    await page.evaluate(() => {
      const w = window as unknown as S;
      const out: number[][] = w.samples = [];
      const tick = () => {
        out.push([scrollY, document.querySelector<HTMLElement>("#dwrap")!
          .offsetHeight]);
        const [a, b] = [out.at(-1)!, out.at(-10)];
        if (out.length > 10 && a[1] > 100 && a[0] === b![0] &&
          a[1] === b![1]) w.sampled = true;
        else requestAnimationFrame(tick);
      };
      tick();
    });
    await page.locator('#details button[data-r="start"]').click();
    await page.waitForFunction(() => (window as unknown as S).sampled);
    const during = await page.evaluate(() =>
      (window as unknown as S).samples);
    // (once the details start to open, the page is where it scrolls to;
    // a smooth scroll's last pixel may land as they start)
    const end = during.at(-1)![0];
    expect(end).toBeGreaterThan(120);
    expect(during.filter(([y, hh]) => hh > 0 && Math.abs(y - end) > 2))
      .toEqual([]);
    expect(during.at(-1)![1]).toBeGreaterThan(100);
    await page.locator('#details button[data-r="exit"]').click();
    await expect.poll(async () => Math.round(await page.evaluate(() =>
      scrollY))).toBe(120);
  });

// (a bug report: one ✕ Exit click sometimes left the walkthrough on for
// the next selection. An Exit while the details unfold was dropped; now
// it waits for them, then exits)
test("one ✕ Exit, even while the details unfold, ends the walkthrough",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ready(page);
    // (the Exit at four moments of the unfold: the waits are the test)
    for (const wait of [0, 150, 400, 1500]) {
      await select(page, "mid", "players");
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('#details button[data-r="start"]').click();
      await page.waitForTimeout(wait);
      await page.locator('#details button[data-r="exit"]').click();
      // (real signals, not a quiet page: the walkthrough ends; then the
      // next click lands, and no walkthrough comes back for it)
      await expect(page.locator("#details.replaying"), `${wait}`)
        .toHaveCount(0);
      await page.locator('#tree li[data-path="totalScore"] > .row')
        .dispatchEvent("click");
      // (a click outside the selection ends it: the click has landed)
      await expect(page.locator("#tree .row.sel")).toHaveCount(0);
      expect(await page.locator("#details.replaying").count(), `${wait}`)
        .toBe(0);
      await page.keyboard.press("Escape");
    }
  });

for (const [w, h] of [[1440, 900], [390, 844]]) {
  test(`${w}px: at every step, nothing covers a lit byte; the panel's `
    + "parts keep to their room", async ({ page }) => {
    await at(page, w, h);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    for (let k = 0; k < 20; k++) {
      await settled(page);
      // (each lit row's byte, in the middle of the view under the stuck
      // panel: what the pointer finds there is that byte)
      const covered = await page.evaluate(async () => {
        const out: string[] = [];
        for (const c of [...document.querySelectorAll<HTMLElement>(
          "#panel .view[data-side=after] .wrow")].map((r) =>
          r.querySelector<HTMLElement>(".b.hl")).filter(Boolean)) {
          c!.scrollIntoView({ block: "center" });
          const pb = document.querySelector(".wpanel")!
            .getBoundingClientRect().bottom;
          scrollBy(0, c!.getBoundingClientRect().top -
            (pb + (innerHeight - pb) / 2));
          const r = c!.getBoundingClientRect();
          const e = document.elementFromPoint(r.left + r.width / 2,
            r.top + r.height / 2);
          if (e !== c && !c!.contains(e)) {
            out.push(c!.closest<HTMLElement>(".wrow")!.dataset.slot!
              .slice(-4));
          }
        }
        return out;
      });
      expect(covered, `step ${k}: covered`).toEqual([]);
      const over = await page.evaluate(() => {
        // (the whole panel: the bar, with the step's values under its
        // caption, and the pointer under it)
        const dp = document.querySelector(".wpanel")!;
        const parts = [...dp.querySelectorAll<HTMLElement>(".rcap, .rform, " +
          ".rsrc, .dpick, .ptrscroll")]
          .filter((e) => e.offsetHeight);
        const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 &&
          b.left < a.right - 0.5 && a.top < b.bottom - 0.5 &&
          b.top < a.bottom - 0.5;
        const out = parts.filter((e) => !e.matches(".chips, .ptrscroll") &&
          e.scrollHeight > e.clientHeight + 1).map((e) => e.className);
        const rs = parts.map((e) => e.getBoundingClientRect());
        const box = dp.getBoundingClientRect();
        rs.forEach((r, i) => {
          if (r.bottom > box.bottom + 0.5) out.push(`${parts[i].className} out`);
          rs.slice(i + 1).forEach((q, j) => {
            if (hit(r, q)) out.push(`${parts[i].className} on ${
              parts[i + 1 + j].className}`);
          });
        });
        return out;
      });
      expect(over, `step ${k}: parts`).toEqual([]);
      const n = page.locator('#details button[data-r="next"]');
      if (await n.isDisabled()) break;
      await n.click();
    }
  });
}
