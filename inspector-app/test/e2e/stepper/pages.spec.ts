// The stepper's pages (lenses/stepper.tsx, ui/Dump.tsx): each open, or
// shut to its tab, at a moment as the related view has them (a page
// with nothing related shut); a tab is a button that opens or shuts its
// page, the open ones sharing the room; the figure's height never
// changes; the next moment, or Reset, lays them out as the moment has
// them again
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const open = (page: Page) => page.evaluate(() => Object.fromEntries([
  ...document.querySelectorAll<HTMLElement>(".view[data-open]")].map((v) =>
  [v.dataset.location, v.dataset.open === "true"])));
const height = (page: Page) => page.locator("#embed").evaluate((e) =>
  Math.ceil(e.getBoundingClientRect().height));
const box = (page: Page, loc: string) => page.locator(
  `.view[data-location=${loc}] .rows`).evaluate((e) =>
  Math.round(e.getBoundingClientRect().height));
const tab = (page: Page, loc: string) => page.locator(
  `.view[data-location=${loc}] .ptab`);
const rest = (page: Page) => expect(page.locator(".lens"))
  .not.toHaveAttribute("data-playing", "", { timeout: 10_000 });

for (const width of [1024, 390]) {
  test(`optimized-locals at ${width}px: the pages fold and open, one ` +
    "height", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=optimized-locals");
    await expect(page.locator(".mbar .dot.cur, .mbar .rcount").first())
      .toBeVisible();
    // (carol's join: the stack, the call and memory hold her locals;
    // no local reads storage)
    await expect.poll(() => open(page)).toEqual({ stack: true,
      calldata: true, memory: true, storage: false });
    await page.waitForTimeout(800);
    const h = await height(page);
    await expect(tab(page, "storage")).toHaveAttribute("aria-expanded",
      "false");
    // (storage opened by hand: the others give it room; the figure keeps
    // its height)
    const before = await box(page, "memory");
    await tab(page, "storage").click();
    await expect(tab(page, "storage")).toHaveAttribute("aria-expanded",
      "true");
    await page.waitForTimeout(800);
    expect(await box(page, "storage")).toBeGreaterThan(0);
    expect(await box(page, "memory")).toBeLessThanOrEqual(before);
    expect(await height(page)).toBe(h);
    // (every page shut: the tabs alone, the height kept)
    for (const l of ["stack", "calldata", "memory", "storage"]) {
      await tab(page, l).click();
    }
    await expect.poll(() => open(page)).toEqual({ stack: false,
      calldata: false, memory: false, storage: false });
    await page.waitForTimeout(800);
    expect(await height(page)).toBe(h);
    // (the next moment: as it has them, alice's play, memory alone)
    await page.locator('.mbar [data-t="next"]').click();
    await rest(page);
    await expect.poll(() => open(page)).toEqual({ stack: false,
      calldata: false, memory: true, storage: false });
    await page.waitForTimeout(800);
    expect(await height(page)).toBe(h);
    // (the shut ones at the bottom, under the open one: a pile)
    const top = (l: string) => page.locator(`.view[data-location=${l}]`)
      .evaluate((e) => e.getBoundingClientRect().top);
    expect(await top("memory")).toBeLessThan(await top("calldata"));
    expect(await top("calldata")).toBeLessThan(await top("storage"));
    // (a choice, then Reset: the first moment, as it has them)
    await tab(page, "calldata").click();
    await expect(tab(page, "calldata")).toHaveAttribute("aria-expanded",
      "true");
    await page.locator(".reset").click();
    await expect.poll(() => open(page)).toEqual({ stack: true,
      calldata: true, memory: true, storage: false });
    await page.waitForTimeout(800);
    expect(await height(page)).toBe(h);
  });
}
