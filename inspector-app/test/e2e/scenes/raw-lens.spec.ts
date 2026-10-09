// The raw lens in a real browser: four bare dumps on one grid, at the
// page's width, the blog figure's (1024px) and a phone's. One cell size
// (one font, one row height, one width for every panel), edges aligned,
// boxes that hug their rows; bare bytes, which a hover leaves as they are
import type { Page } from "@playwright/test";
import { test, expect, settle } from "../../page";

const panels = (page: Page, q: string) => page.evaluate((q) =>
  Object.fromEntries([...document.querySelectorAll<HTMLElement>(
    `${q} .view`)].map((v) => {
    const r = v.querySelector(".rows")!.getBoundingClientRect();
    const w = v.querySelector(".wrow[data-slot] .word > *")!
      .getBoundingClientRect();
    const b = v.querySelector(".wrow[data-slot] .b, .wrow .ab")!;
    const line = parseFloat(getComputedStyle(v.querySelector(
      ".wrow[data-slot] .word .bytes, .wrow .ab")!).lineHeight);
    return [v.dataset.view!.split(":")[1], { l: r.left, r: r.right,
      t: r.top, b: r.bottom, wordR: w.right,
      font: getComputedStyle(b).fontSize, line,
      row: v.querySelector(".wrow[data-slot]")!.getBoundingClientRect()
        .height }];
  })), q);

// One cell size (one font, one line height; storage and memory one
// width), one grid (shared edges, the stack beside on a wide page, its
// tops level with storage's), boxes that hug their rows, the
// composition centred
const rules = async (page: Page, q: string, width: number) => {
  // (the stack takes the dumps' font once they have fitted it: the same
  // to a twentieth of a pixel)
  const spread = async () => {
    const fs = Object.values(await panels(page, q)).map((x) =>
      parseFloat(x.font));
    return Math.max(...fs) - Math.min(...fs);
  };
  await expect.poll(spread).toBeLessThan(0.06);
  const p = await panels(page, q);
  expect(Object.keys(p).sort()).toEqual(["memory", "stack", "storage"]);
  const all = Object.values(p);
  const dumps = [p.storage, p.memory];
  const close = (xs: number[], d: number) =>
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(d);
  close(all.map((x) => x.line), 0.5);
  close(dumps.map((x) => x.row), 0.5);
  close(dumps.map((x) => x.r - x.l), 0.5);
  expect(new Set(all.map((x) => Math.round(x.l))).size)
    .toBe(width >= 860 ? 2 : 1);
  for (const x of all) expect(x.r - x.wordR).toBeLessThan(24);
  for (const x of all) {
    expect(x.l).toBeGreaterThanOrEqual(0);
    expect(x.r).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(width);
  if (width >= 860) {
    // (the stack: narrow, beside; storage and the stack centred)
    const mid = (p.storage.l + p.stack.r) / 2;
    expect(Math.abs(mid - width / 2)).toBeLessThan(2);
    expect(Math.abs(p.storage.t - p.stack.t)).toBeLessThan(1);
    expect(p.stack.l).toBeGreaterThan(p.storage.r);
    expect(p.stack.r - p.stack.l).toBeLessThan((p.storage.r - p.storage.l)
      / 3);
  }
};

for (const width of [1360, 1024, 390]) {
  test(`raw-hero at ${width}px: one cell size, one grid; bare`,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("./shell.html#lens=raw-hero");
      await expect(page.locator(
        '.view[data-view$=":stack"] .wrow[data-slot]')).toHaveCount(14);
      await rules(page, ".lens", width);
      const before = await page.locator(".lens").innerHTML();
      await page.locator('.view[data-view$=":storage"] .b').nth(40).hover();
      await settle(page);
      expect(await page.locator(".lens").innerHTML()).toBe(before);
      expect(await page.locator(".pop, .b.hl, .b[data-owners]").count())
        .toBe(0);
    });
}

// The main page's "Raw bytes" scene: first among the scenes, the raw
// lens in place of the storage inspector; the hash keeps it; a storage
// scene brings the inspector back
for (const width of [1360, 390]) {
  test(`the main page's Raw bytes scene at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    await page.waitForFunction(() => (window as unknown as
      { results: { done: boolean } }).results?.done);
    const first = page.locator("#picker button").first();
    await expect(first).toHaveAttribute("data-id", "raw");
    await first.click();
    await expect(page.locator("main")).toHaveAttribute("data-lens", "");
    await expect(page.locator(
      '#rawscene .view[data-view$=":stack"] .wrow[data-slot]'))
      .toHaveCount(14);
    await rules(page, "#rawscene", width);
    expect(await page.evaluate(() => location.hash)).toContain("scene=raw");
    // (the inspector's parts step out; the scene picker stays)
    for (const q of ["#panel", "#tree", "#memory", "#contract"]) {
      await expect(page.locator(q)).toBeHidden();
    }
    await expect(page.locator("#picker button").first()).toBeVisible();
    // (its URL opens it again; in a second page: a reload would cut the
    // first one's prefetches short, which WebKit reports)
    const again = await page.context().newPage();
    await again.goto(page.url());
    await expect(again.locator("#rawscene .lens.raw-hero")).toBeVisible();
    await again.close();
    await page.locator('#picker button[data-id="mid"]').click();
    await expect(page.locator("main")).not.toHaveAttribute("data-lens");
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator("#rawscene .lens")).toHaveCount(0);
  });
}

// The raw storage dump is the storage inspector's on a wide page, layers
// off: at any figure width from 860px, the same width, font, row height,
// cell and fill as the middle of the game's storage dump at 1440px (a
// word a row)
test("the raw storage dump is the inspector's at 1440px, in size",
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("./#ex=mid");
    await page.waitForFunction(() => (window as unknown as
      { results: { done: boolean } }).results?.done);
    const look = (q: string) => page.evaluate((q) => {
      const v = document.querySelector(q)!;
      const r = v.querySelector(".rows")!.getBoundingClientRect();
      const row = v.querySelector(".wrow[data-slot]")!;
      const bs = [...row.querySelectorAll(".b")];
      return { width: r.width, font: getComputedStyle(bs[0]).fontSize,
        row: row.getBoundingClientRect().height,
        cell: bs[1].getBoundingClientRect().left -
          bs[0].getBoundingClientRect().left,
        fill: row.querySelector(".word")!.getBoundingClientRect().right -
          r.left, n: row.querySelectorAll(".b").length };
    }, q);
    const mid = await look("#panel .view[data-side=after]");
    expect(mid.n).toBe(32);
    for (const width of [1440, 1360, 1024, 860]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`./embed.html?w=${width}#scene=raw-hero`);
      await expect(page.locator('.view[data-view$=":storage"] ' +
        ".wrow[data-slot]").first()).toBeVisible({ timeout: 20_000 });
      const raw = await look('.view[data-view$=":storage"]');
      for (const k of ["width", "row", "cell", "fill", "n"] as const) {
        expect(Math.abs(raw[k] - mid[k]), `${width}: ${k}`)
          .toBeLessThan(0.5);
      }
      expect(raw.font).toBe(mid.font);
    }
  });

// The figure's storage folds its all-zero rows into its gaps; the stack
// keeps every item, memory every word; the inspector's storage keeps
// its zero rows
test("raw-hero folds storage's zero rows, nothing else's", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("./embed.html#scene=raw-hero");
  const words = (v: string) => page.locator(`.view[data-view$=":${v}"] ` +
    ".wrow[data-slot]").evaluateAll((rs) => rs.map((r) =>
    [...r.querySelectorAll(".b, .ab")].map((b) => b.textContent).join("")));
  await expect.poll(async () => (await words("stack")).length,
    { timeout: 20_000 }).toBe(14);
  const st = await words("storage");
  expect(st.length).toBeGreaterThan(5);
  expect(st.filter((w) => /^(00)+$/.test(w))).toEqual([]);
  // (no two gaps in a row)
  expect(await page.locator('.view[data-view$=":storage"] .gap + .gap')
    .count()).toBe(0);
  expect((await words("stack")).some((w) => w === "0x00")).toBe(true);
  expect((await words("memory")).length).toBe(3);
  await page.goto("./#ex=mid");
  await expect(page.locator('#panel .view[data-side=after] ' +
    '.wrow[data-slot$="0003"]')).toHaveCount(1);
});
