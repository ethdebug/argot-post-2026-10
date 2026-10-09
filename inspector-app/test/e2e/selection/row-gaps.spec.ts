// A dump row's own space (the gaps between its groups of eight, the
// ends, the space above and below its bytes) is its slot: the pointer
// there shows what pointing at the row's address shows. A gap between
// two bytes of one value is that value's.
import type { Page } from "@playwright/test";
import { test, expect, ready, select, settle, box, V } from "../../page";

const at = async (page: Page, scene: string) => {
  await ready(page);
  await select(page, scene, null);
};
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

test("a gap between two values, and the row's ends: the address's hover",
  async ({ page }) => {
    await at(page, "alice");
    const slot = await rowOf(page, "lastBlock", "hits");
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
    // (in from a byte of lastBlock: the gap, then hits's byte)
    await page.mouse.move(b7.x + b7.width / 2, y);
    await settle(page);
    expect(await state(page)).toContain("pbadge");
    const b0 = await box(page, `${row} .b[data-i="0"]`);
    const ad = await box(page, `${row} > .addr`);
    // (the gap, the row's end, between the address and the bytes, and
    // the 1px above and below its bytes: rows are 2px apart)
    expect(b7.y - r.y).toBeGreaterThanOrEqual(0.9);
    expect(r.y + r.height - (b7.y + b7.height)).toBeGreaterThanOrEqual(0.9);
    const b31 = await box(page, `${row} .b[data-i="31"]`);
    const end = b31.x + b31.width;
    for (const [x, yy] of [[(b7.x + b7.width + b8.x) / 2, y],
      [(ad.x + ad.width + b0.x) / 2, y],
      // (the whole pixels over this row but not its bytes: where a
      // pointer can be)
      ...(await page.evaluate(([x, top, bottom, slot]) => {
        const ys: number[] = [];
        for (let t = Math.floor(top); t <= Math.ceil(bottom); t++) {
          const e = document.elementFromPoint(x, t);
          if (e && !e.closest(".b") &&
            e.closest<HTMLElement>(".wrow")?.dataset.slot === slot) {
            ys.push(t);
          }
        }
        return ys;
      }, [b7.x + b7.width / 2, r.y, r.y + r.height, slot] as const))
        .map((t) => [b7.x + b7.width / 2, t]),
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
    expect(s).toMatch(/pbadge[^>]*>hits</);
    expect(await rects(page)).toBe(still);
  });

test("a gap inside one value is that value's (slot 0: `length`)",
  async ({ page }) => {
    await at(page, "mid");
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
  await at(page, "mid");
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
    await at(page, "mid");
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

test("16 bytes a line: 2px between a word's lines where two values meet; " +
  "joined where one goes on", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await at(page, "mid");
  const geo = (slot: string, i: number) => page.evaluate(([v, s, i]) => {
    const r = document.querySelector(`${v} .wrow[data-slot$="${s}"]`)!;
    const a = r.querySelector(`.b[data-i="${i}"]`)!;
    const b = r.querySelector(`.b[data-i="${+i + 16}"]`)!;
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    const after = getComputedStyle(a, "::after");
    return { gap: br.top - ar.bottom, joined: a.classList.contains("jd"),
      fill: after.content !== "none" && after.content !== "normal" };
  }, [V, slot, String(i)] as const);
  // (slot 0: playerList's length, one value over both lines)
  const len = await geo("0000", 0);
  expect(len.gap).toBeCloseTo(2, 0);
  expect([len.joined, len.fill]).toEqual([true, true]);
  // (alice's record: lastBlock over plays, two values)
  const rec = await page.evaluate((v) => [...document.querySelectorAll(
    `${v} .wrow[data-slot]`)].find((r) => r.querySelector(
    '.b[data-i="0"]')?.getAttribute("data-owners")?.endsWith(
    "lastBlock"))!.getAttribute("data-slot")!.slice(-4), V);
  const two = await geo(rec, 0);
  expect([two.joined, two.fill]).toEqual([false, false]);
  // (the gap under a joined byte is the value's: its popover badged)
  const c = (await page.locator(`${V} .wrow[data-slot$="0000"] .b[data-i="3"]`)
    .boundingBox())!;
  await page.mouse.move(c.x + c.width / 2, c.y + c.height + 1);
  await page.evaluate(() => new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.locator("#panel .pop .pbadge").allInnerTexts())
    .toEqual(["length"]);
});
