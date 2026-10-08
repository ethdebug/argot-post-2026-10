// With a selection, a click on what it does not light only ends it (the
// hover waits for the pointer to move); a click on the selection clears
// it (its hover at once); a click on what it lights selects that. The cursor says which: default, or pointer.
import { test, expect, type Page } from "@playwright/test";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: "playerList" }));
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

test("a click on an unlit row only exits; no hover until the pointer " +
  "moves; then its hover; a second click selects it", async ({ page }) => {
  await ready(page);
  const r = (await row(page, "motd").boundingBox())!;
  const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await settle(page);
  expect(await sel(page)).toBe(null);
  // (settled: nothing lit, the hover held back)
  expect(await row(page, "motd").getAttribute("class")).not.toContain("hl");
  expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
  // (a nudge under 3px: still none)
  await page.mouse.move(x + 2, y);
  await settle(page);
  expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
  // (a move: motd's hover)
  await page.mouse.move(x + 6, y, { steps: 2 });
  await settle(page);
  expect(await row(page, "motd").getAttribute("class")).toContain("hl");
  expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
  await row(page, "motd").click();
  expect(await sel(page)).toBe("motd");
});

test("a click on the selection itself clears it; its hover at once",
  async ({ page }) => {
    await ready(page);
    await row(page, "playerList").click();
    await settle(page);
    expect(await sel(page)).toBe(null);
    expect(await row(page, "playerList").getAttribute("class")).toContain("hl");
    expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
  });

test("Escape clears; no hover until the pointer moves", async ({ page }) => {
  await ready(page);
  const r = (await row(page, "motd").boundingBox())!;
  await page.mouse.move(r.x + 20, r.y + r.height / 2);
  // (Escape in the lens: its focus there)
  await row(page, "motd").focus();
  await page.keyboard.press("Escape");
  await settle(page);
  expect(await sel(page)).toBe(null);
  expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
  await page.mouse.move(r.x + 30, r.y + r.height / 2, { steps: 2 });
  await settle(page);
  expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
});

test("a click on a lit child selects it, from the tree or its bytes",
  async ({ page }) => {
    await ready(page);
    await row(page, "playerList[0]").click();
    expect(await sel(page)).toBe("playerList[0]");
    await page.evaluate(() => (window as unknown as W).select("mid",
      { sel: "playerList" }));
    await page.locator(`${V} .b.hl[data-owners="playerList[0]"]`).first()
      .click();
    expect(await sel(page)).toBe("playerList[0]");
  });

test("a click on unlit bytes only exits; no hover until a move",
  async ({ page }) => {
    await ready(page);
    await page.locator(`${V} .b[data-owners="totalScore"]`).first().click();
    await settle(page);
    expect(await sel(page)).toBe(null);
    expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
    const b = (await page.locator(`${V} .b[data-owners="totalScore"]`).first()
      .boundingBox())!;
    await page.mouse.move(b.x + 1, b.y + 1, { steps: 2 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2,
      { steps: 2 });
    await settle(page);
    expect(await page.locator(`${V} .b.hl[data-owners="totalScore"]`).count())
      .toBeGreaterThan(0);
  });

test("the cursor: default on what a click only exits; pointer on what " +
  "it lights", async ({ page }) => {
  await ready(page);
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("default");
  expect(await cursor(page, '#tree li[data-path="playerList[0]"] > .row'))
    .toBe("pointer");
  expect(await cursor(page, `${V} .b[data-owners="totalScore"]`))
    .toBe("default");
  expect(await cursor(page, `${V} .b[data-owners="playerList[0]"]`))
    .toBe("pointer");
  // (nothing selected: as before)
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: null }));
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("pointer");
});
