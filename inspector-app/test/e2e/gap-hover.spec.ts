// A dump row's own space (the gaps between its groups of eight, the
// ends, the space above and below its bytes) is its slot: the pointer
// there shows what pointing at the row's address shows. A gap between
// two bytes of one value is that value's.
import { test, expect, type Page } from "@playwright/test";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page, scene: string) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
  await page.evaluate((s) => (window as unknown as W).select(s,
    { sel: null }), scene);
};
const V = "#panel .view:not([hidden])";
// the row whose bytes `a` (byte 7) and `b` (byte 8) own
const rowOf = (page: Page, a: string, b: string) => page.evaluate(
  ([v, a, b]) => [...document.querySelectorAll<HTMLElement>(
    `${v} .wrow[data-slot]`)].find((r) => {
    const o = (i: number) => r.querySelector<HTMLElement>(
      `.b[data-i="${i}"]`)?.dataset.owners?.split("|")[0] ?? "";
    return o(7).endsWith(a) && o(8).endsWith(b);
  })?.dataset.slot, [V, a, b]);
// what the pointer shows: the view's bytes and rows, and the popovers
const state = (page: Page) => page.evaluate((v) => {
  const view = document.querySelector(v)!;
  return JSON.stringify({
    view: view.className,
    b: [...view.querySelectorAll(".b[data-i]")].map((e) => e.className),
    rows: [...view.querySelectorAll(".wrow, .addr")].map((e) =>
      [e.className, getComputedStyle(e).color]),
    pops: [...document.querySelectorAll("#panel .pop")].map((e) =>
      e.innerHTML) });
}, V);
const rects = (page: Page) => page.evaluate((v) => JSON.stringify(
  [...document.querySelectorAll(`${v} .wrow, ${v} .b`)].map((e) => {
    const r = e.getBoundingClientRect();
    return [r.left, r.top, r.width, r.height];
  })), V);
const box = async (page: Page, sel: string) =>
  (await page.locator(sel).boundingBox())!;
const settle = (page: Page) => page.evaluate(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(r))));

test("a gap between two values, and the row's ends: the address's hover",
  async ({ page }) => {
    await ready(page, "alice");
    const slot = await rowOf(page, "lastBlock", "hitCount");
    expect(slot).toBeTruthy();
    const row = `${V} .wrow[data-slot="${slot}"]`;
    await page.locator(`${row} > .addr`).hover();
    await settle(page);
    const gutter = await state(page);
    expect(gutter).toContain("pop");
    expect(gutter).not.toContain("pbadge");
    const still = await rects(page);
    const b7 = await box(page, `${row} .b[data-i="7"]`);
    const b8 = await box(page, `${row} .b[data-i="8"]`);
    const r = await box(page, row);
    const y = b7.y + b7.height / 2;
    // (in from a byte of lastBlock: the gap, then hitCount's byte)
    await page.mouse.move(b7.x + b7.width / 2, y);
    await settle(page);
    expect(await state(page)).toContain("pbadge");
    const b0 = await box(page, `${row} .b[data-i="0"]`);
    const ad = await box(page, `${row} > .addr`);
    // (the gap, the row's end, between the address and the bytes. The
    // bytes fill the row's height: no space above or below them)
    expect([b7.y, b7.height]).toEqual([r.y, r.height]);
    const b31 = await box(page, `${row} .b[data-i="31"]`);
    const end = b31.x + b31.width;
    for (const [x, yy] of [[(b7.x + b7.width + b8.x) / 2, y],
      [(ad.x + ad.width + b0.x) / 2, y],
      // (past the last byte, where the row goes on: not in every browser)
      ...r.x + r.width - end > 1 ? [[(end + r.x + r.width) / 2, y]] : []]) {
      await page.mouse.move(x, yy, { steps: 2 });
      await settle(page);
      expect(await state(page)).toBe(gutter);
      expect(await rects(page)).toBe(still);
    }
    await page.mouse.move(b8.x + b8.width / 2, y, { steps: 2 });
    await settle(page);
    const s = await state(page);
    expect(s).toContain("pbadge");
    expect(s).toMatch(/pbadge[^>]*>hitCount</);
    expect(await rects(page)).toBe(still);
  });

test("a gap inside one value is that value's (slot 0: `length`)",
  async ({ page }) => {
    await ready(page, "alice");
    const slot = "0x" + "0".repeat(64);
    const row = `${V} .wrow[data-slot="${slot}"]`;
    const b0 = await box(page, `${row} .b[data-i="0"]`);
    const y = b0.y + b0.height / 2;
    await page.mouse.move(b0.x + b0.width / 2, y);
    await settle(page);
    const on = await state(page);
    expect(on).toMatch(/pbadge[^>]*>length</);
    for (const i of [7, 15, 23]) {
      const a = await box(page, `${row} .b[data-i="${i}"]`);
      const b = await box(page, `${row} .b[data-i="${i + 1}"]`);
      await page.mouse.move((a.x + a.width + b.x) / 2, y, { steps: 2 });
      await settle(page);
      expect(await state(page)).toBe(on);
    }
  });

test("between two rows there is no point with no hover", async ({ page }) => {
  await ready(page, "alice");
  const rows = page.locator(`${V} .wrow[data-slot]`);
  const a = (await rows.nth(0).boundingBox())!;
  const x = a.x + a.width - 1;
  for (let y = a.y + 1; y < a.y + 2 * a.height - 1; y += 1) {
    await page.mouse.move(x, y);
    expect(await page.evaluate(() =>
      document.querySelectorAll("#panel .pop").length)).toBeGreaterThan(0);
  }
});

test("a gap inside one value is clickable as its bytes, with their cursor",
  async ({ page }) => {
    await ready(page, "mid");
    const row = `${V} .wrow[data-slot="0x${"1".padStart(64, "0")}"]`;
    const owners = await page.locator(`${row} .b[data-i="7"]`)
      .getAttribute("data-owners");
    expect(owners).toBe("motd#length");
    const b7 = await box(page, `${row} .b[data-i="7"]`);
    const b8 = await box(page, `${row} .b[data-i="8"]`);
    const [x, y] = [(b7.x + b7.width + b8.x) / 2, b7.y + b7.height / 2];
    await page.mouse.move(x, y, { steps: 2 });
    expect(await page.locator(row).evaluate((r) =>
      getComputedStyle(r).cursor)).toBe("pointer");
    await page.mouse.click(x, y);
    expect(await page.evaluate(() => document.querySelector(
      "#tree .row.sel")?.parentElement?.dataset.path)).toBe("motd");
  });
