// A run of bytes no value owns is its own item in the slot's popover,
// "(unmapped)", in byte order; pointing at those bytes badges it
// in a neutral style and lights them in a neutral one.
import { test, expect, type Page } from "@playwright/test";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const V = "#panel .view:not([hidden])";
const ROW = `${V} .wrow[data-slot$="7528"]`;
const ready = async (page: Page) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: null }));
};
const settle = (page: Page) => page.evaluate(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(r))));
const box = async (page: Page, sel: string) =>
  (await page.locator(sel).boundingBox())!;
// the popover's names: [text, classes]
const names = (page: Page) => page.evaluate(() =>
  [...document.querySelectorAll("#panel .pop .pname")].map((e) =>
    [e.textContent, e.className]));
const rects = (page: Page) => page.evaluate((v) => JSON.stringify(
  [...document.querySelectorAll(`${v} .wrow, ${v} .b, ${v} .rows`)]
    .map((e) => {
      const r = e.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height];
    })), V);

test("the row's unmapped run: an item in byte order, plain",
  async ({ page }) => {
    await ready(page);
    await page.locator(`${ROW} > .addr`).hover();
    await settle(page);
    const n = await names(page);
    expect(n.map(([t]) => t)).toEqual(["name", "(unmapped)",
      "name.length"]);
    expect(n[1][1]).toBe("pname pfree");
    expect(n.some(([, c]) => /pbadge/.test(c!))).toBe(false);
  });

test("a row with no unmapped bytes has no such item", async ({ page }) => {
  await ready(page);
  await page.locator(`${V} .wrow[data-slot$="0000"] > .addr`).hover();
  await settle(page);
  expect((await names(page)).map(([t]) => t))
    .not.toContain("(unmapped)");
});

test("pointing at unmapped bytes badges the item neutrally",
  async ({ page }) => {
    await ready(page);
    await page.locator(`${ROW} > .addr`).hover();
    await settle(page);
    const still = await rects(page);
    const b10 = await box(page, `${ROW} .b[data-i="10"]`);
    await page.mouse.move(b10.x + b10.width / 2, b10.y + b10.height / 2,
      { steps: 2 });
    await settle(page);
    const n = await names(page);
    expect(n.map(([t, c]) => [t, /pbadge/.test(c!)])).toEqual([
      ["name", false], ["(unmapped)", true], ["name.length", false]]);
    expect(n[1][1]).toBe("pname pfree pbadge pnone");
    // (its bytes lit neutrally, and only those)
    const lit = await page.evaluate((r) => [...document.querySelectorAll(
      `${r} .b`)].map((c) => c.classList.contains("fl") ? 1 : 0).join(""),
    ROW);
    expect(lit).toBe("000" + "1".repeat(28) + "0");
    expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
    const look = await page.evaluate((r) => {
      const c = getComputedStyle(document.querySelector(
        `${r} .b[data-i="10"]`)!);
      const p = getComputedStyle(document.querySelector(
        "#panel .pop .pname.pfree")!);
      return [c.backgroundColor, c.opacity, p.fontStyle, p.backgroundColor];
    }, ROW);
    expect(look[0]).not.toBe("rgba(0, 0, 0, 0)");
    expect(look[1]).toBe("1");
    expect(look[2]).toBe("italic");
    expect(look[3]).not.toBe("rgba(0, 0, 0, 0)");
    // (a gap inside the run is the run's)
    const b15 = await box(page, `${ROW} .b[data-i="15"]`);
    const b16 = await box(page, `${ROW} .b[data-i="16"]`);
    await page.mouse.move((b15.x + b15.width + b16.x) / 2, b10.y +
      b10.height / 2, { steps: 2 });
    await settle(page);
    expect(await names(page)).toEqual(n);
    // (no layout shift)
    expect(await rects(page)).toBe(still);
    // (the gap between name and the run: the slot's hover)
    const b2 = await box(page, `${ROW} .b[data-i="2"]`);
    const b3 = await box(page, `${ROW} .b[data-i="3"]`);
    if (b3.x - (b2.x + b2.width) > 1) {
      await page.mouse.move((b2.x + b2.width + b3.x) / 2, b10.y + 1);
      await settle(page);
      expect((await names(page)).some(([, c]) => /pbadge/.test(c!)))
        .toBe(false);
    }
  });

const sel = (page: Page) => page.evaluate(() =>
  document.querySelector("#tree .row.sel")?.parentElement?.dataset.path
  ?? null);
const unmappedShown = (page: Page) => page.evaluate((r) => [
  document.querySelectorAll(`${r} .b.fl`).length,
  document.querySelector("#panel .pop .pname.pfree")?.className], ROW);

test("with a selection, a click on unmapped bytes clears it; no hover " +
  "until a move, then the run's", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: "totalScore" }));
  const c = page.locator(`${ROW} .b[data-i="10"]`);
  await c.scrollIntoViewIfNeeded();
  const b = (await c.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await settle(page);
  expect(await sel(page)).toBe(null);
  expect(await unmappedShown(page)).toEqual([0, undefined]);
  await page.mouse.move(b.x + b.width / 2 + 5, b.y + b.height / 2,
    { steps: 2 });
  await settle(page);
  expect(await unmappedShown(page)).toEqual([28,
    "pname pfree pbadge pnone"]);
});

test("with nothing selected, a click on unmapped bytes changes nothing: " +
  "the hover stays", async ({ page }) => {
  await ready(page);
  const c = page.locator(`${ROW} .b[data-i="10"]`);
  await c.hover();
  await settle(page);
  const before = await unmappedShown(page);
  expect(before).toEqual([28, "pname pfree pbadge pnone"]);
  await c.click();
  await settle(page);
  expect(await unmappedShown(page)).toEqual(before);
});

test("with a selection, a click in a gap of the run clears it; no hover " +
  "until a move", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => (window as unknown as W).select("mid",
    { sel: "totalScore" }));
  await page.locator(ROW).scrollIntoViewIfNeeded();
  const b7 = await box(page, `${ROW} .b[data-i="7"]`);
  const b8 = await box(page, `${ROW} .b[data-i="8"]`);
  const [x, y] = [(b7.x + b7.width + b8.x) / 2, b7.y + b7.height / 2];
  await page.mouse.click(x, y);
  await settle(page);
  expect(await sel(page)).toBe(null);
  expect(await unmappedShown(page)).toEqual([0, undefined]);
  await page.mouse.move(x, y + 5, { steps: 2 });
  await page.mouse.move(x, y, { steps: 2 });
  await settle(page);
  expect(await unmappedShown(page)).toEqual([28,
    "pname pfree pbadge pnone"]);
});

const REC = "players[0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc]";
const pops = (page: Page) => page.locator("#panel .view:not([hidden]) .pop")
  .allInnerTexts();

test("every popover lists a row's unmapped run: the selection's",
  async ({ page }) => {
    await ready(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    // (the record, two slots: the run is cut first, and leaves its "…")
    await page.evaluate((s) => (window as unknown as W).select("mid",
      { sel: s }), REC);
    await settle(page);
    const p = (await pops(page)).find((t) => t.includes("2 slots"));
    expect(p).toContain("/ name · … · name.length, 2 slots");
    // (its name, one slot: it fits; not lit: plain)
    await page.evaluate((s) => (window as unknown as W).select("mid",
      { sel: s }), `${REC}.name`);
    await settle(page);
    expect(await pops(page)).toContain(
      "keccak(0x3c44…93bc, slot 3) + 1 : name · (unmapped) · name.length");
    expect(await page.locator("#panel .pop .pname.pfree").first()
      .getAttribute("class")).toBe("pname pfree");
  });

// (not in a walkthrough, which is about where bytes are: the review's W7)
test("a walkthrough step's popovers list no unmapped run",
  async ({ page }) => {
    await ready(page);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator(`#tree li[data-path="${REC}"] > .row`).click();
    await page.mouse.move(1, 1);
    await page.locator('#details button[data-r="start"]').click();
    const seen: string[] = [];
    // (all but the last step, found: the resting view, which has them)
    for (let k = 0; k < 20; k++) {
      const next = page.locator('#details button[data-r="next"]');
      if (await next.isDisabled()) break;
      seen.push(...await pops(page));
      await next.click();
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.some((t) => t.includes("(unmapped)"))).toBe(false);
  });
