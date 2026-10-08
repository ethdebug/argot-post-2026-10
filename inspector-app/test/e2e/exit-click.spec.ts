// With a selection, a click on what it does not light only ends it (the
// pointer's hover shows at once); a click on what it lights selects
// that, as before. The cursor says which: default, or pointer.
import { test, expect, type Page } from "@playwright/test";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: "roster" }));
};
const row = (page: Page, p: string) =>
  page.locator(`#tree li[data-path="${p}"] > .row`);
const sel = (page: Page) => page.evaluate(() =>
  document.querySelector("#tree .row.sel")?.parentElement?.dataset.path
  ?? null);
const settle = (page: Page) => page.evaluate(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(r))));
const V = "#panel .view:not([hidden])";
const cursor = (page: Page, s: string) => page.locator(s).first()
  .evaluate((e) => getComputedStyle(e).cursor);

test("a click on an unlit row only exits; its hover shows; a second " +
  "click selects it", async ({ page }) => {
  await ready(page);
  await row(page, "motd").click();
  await settle(page);
  expect(await sel(page)).toBe(null);
  // (motd's hover: its row and its bytes lit)
  expect(await row(page, "motd").getAttribute("class")).toContain("hl");
  expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
  await row(page, "motd").click();
  expect(await sel(page)).toBe("motd");
});

test("a click on a lit child selects it, from the tree or its bytes",
  async ({ page }) => {
    await ready(page);
    await row(page, "roster[0]").click();
    expect(await sel(page)).toBe("roster[0]");
    await page.evaluate(() => (window as unknown as W).select("mid",
      { sel: "roster" }));
    await page.locator(`${V} .b.hl[data-owners="roster[0]"]`).first()
      .click();
    expect(await sel(page)).toBe("roster[0]");
  });

test("a click on unlit bytes only exits", async ({ page }) => {
  await ready(page);
  await page.locator(`${V} .b[data-owners="total"]`).first().click();
  await settle(page);
  expect(await sel(page)).toBe(null);
  expect(await page.locator(`${V} .b.hl[data-owners="total"]`).count())
    .toBeGreaterThan(0);
});

test("the cursor: default on what a click only exits; pointer on what " +
  "it lights", async ({ page }) => {
  await ready(page);
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("default");
  expect(await cursor(page, '#tree li[data-path="roster[0]"] > .row'))
    .toBe("pointer");
  expect(await cursor(page, `${V} .b[data-owners="total"]`))
    .toBe("default");
  expect(await cursor(page, `${V} .b[data-owners="roster[0]"]`))
    .toBe("pointer");
  // (nothing selected: as before)
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: null }));
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("pointer");
});
