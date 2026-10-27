// The raw lens's composition in a real browser (scene reveal, the raw
// figure annotated): storage, the stack and memory on one grid, at the
// page's width, the blog figure's (1024px) and a phone's. One cell size
// (one font, one row height, one width for every panel), edges aligned,
// every panel as wide as its column, one row pitch; bytes a hover leaves
// as they are
import type { Page } from "@playwright/test";
import { test, expect, ready, settle } from "../../page";

// (the stack at the moment: 4 items)
const STACK = 4;

const panels = (page: Page, q: string) => page.evaluate((q) =>
  Object.fromEntries([...document.querySelectorAll<HTMLElement>(
    `${q} .view`)].map((v) => {
    const r = v.querySelector(".rows")!.getBoundingClientRect();
    // (memory's flow lines have no slot: its lines are its rows)
    const w = v.querySelector(".wrow .word > *")!.getBoundingClientRect();
    const b = v.querySelector(".wrow .b, .wrow .ab")!;
    const line = parseFloat(getComputedStyle(v.querySelector(
      ".wrow .word .bytes, .wrow .ab")!).lineHeight);
    return [v.dataset.view!.split(":")[1], { l: r.left, r: r.right,
      t: r.top, b: r.bottom, wordR: w.right,
      font: getComputedStyle(b).fontSize, line,
      row: v.querySelector(".wrow")!.getBoundingClientRect().height }];
  })), q);

// One cell size (one font, one line height), one grid (shared edges:
// from 910px, two columns across the frame, storage a word a row and,
// beside it, the stack over memory, its top level with storage's;
// narrower, one column), every panel as wide as its column
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
  const close = (xs: number[], d: number) =>
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(d);
  close(all.map((x) => x.line), 0.5);
  expect(new Set(all.map((x) => Math.round(x.l))).size)
    .toBe(width >= 910 ? 2 : 1);
  // (every panel spans its column: the stack's box as wide as memory's;
  // storage's rows fill its box)
  expect(p.storage.r - p.storage.wordR).toBeLessThan(24);
  expect(Math.abs(p.stack.r - p.memory.r)).toBeLessThan(1);
  // (one row pitch, in whole pixels)
  if (width >= 910) {
    close(all.map((x) => x.row), 0.5);
    for (const x of all) expect(x.row % 1).toBe(0);
  }
  for (const x of all) {
    expect(x.l).toBeGreaterThanOrEqual(0);
    expect(x.r).toBeLessThanOrEqual(width);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth))
    .toBe(width);
  // (memory under the stack)
  expect(p.memory.t).toBeGreaterThan(p.stack.t);
  if (width >= 910) {
    // (two columns across the frame: storage, a word a row; the stack
    // over memory beside it, their left edges one, its top level with
    // storage's; memory flush with the frame's right, as storage is with
    // its left)
    // (the frame's side room, or a page's margin: the same on both)
    expect(Math.abs(p.storage.l - (width - p.memory.r))).toBeLessThan(2);
    expect(p.storage.l).toBeLessThan(24);
    expect(Math.abs(p.storage.t - p.stack.t)).toBeLessThan(1);
    expect(p.stack.l).toBeGreaterThan(p.storage.r);
    expect(Math.abs(p.memory.l - p.stack.l)).toBeLessThan(1);
  }
};

for (const width of [1360, 1024, 390]) {
  test(`reveal at ${width}px: one cell size, one grid; a hover changes `
    + "nothing", async ({ page }) => {
    await ready(page, { scene: "reveal", width });
    await expect(page.locator(
      '.view[data-view$=":stack"] .wrow[data-slot]')).toHaveCount(STACK);
    // (again until it holds: the cell size settles by timers)
    await expect(() => rules(page, ".lens", width)).toPass();
    const before = await page.locator(".lens").innerHTML();
    await page.locator('.view[data-view$=":storage"] .b').nth(40).hover();
    await settle(page);
    expect(await page.locator(".lens").innerHTML()).toBe(before);
  });
}

// The raw storage dump keeps a word a row (32 bytes, one row a slot)
// wherever it is beside the stack and memory, from 910px; and alone,
// under 910px, its frame's width
test("the raw storage dump: a word a row, beside the right column or " +
  "alone", async ({ page }) => {
    for (const width of [1440, 1280, 1024, 910, 760]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`./embed.html?w=${width}#scene=reveal`);
      const row = page.locator('.view[data-view$=":storage"] ' +
        ".wrow[data-slot]").first();
      await expect(row).toBeVisible({ timeout: 20_000 });
      await settle(page);
      // (its 32 bytes on one line)
      const tops = await row.locator(".b").evaluateAll((bs) =>
        new Set(bs.map((b) => Math.round(b.getBoundingClientRect().top)))
          .size);
      expect(tops, `${width}`).toBe(1);
    }
  });

// In a 1024px frame (the post's figure at 1440×900), the annotated
// figure is at most 720px tall: a host can pin it on a laptop's screen.
// (In a host's frame, as the host gets it: its height message; the
// figure's Raw | Annotated toggle is for a page that stands alone, not
// a frame)
for (const id of ["reveal"]) {
  test(`${id} in a 1024px frame: at most 720px tall`,
    async ({ page, baseURL }) => {
      for (const width of [1024]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("./embed.html");
        await page.setContent(`<body style="margin:0">
          <iframe id="f" src="${baseURL}embed.html?w=${width}#scene=${id}"
            style="border:0;width:${width}px;height:50px"></iframe>
          <script>addEventListener("message", (e) => {
            if (e.data?.type === "ethdebug:height" && e.data.ready) {
              window.h = e.data.height;
            }
          });</script></body>`);
        await expect.poll(() => page.evaluate(() =>
          (window as unknown as { h?: number }).h), { timeout: 20_000 })
          .toBeGreaterThan(0);
        expect(await page.evaluate(() =>
          (window as unknown as { h: number }).h), `${width}`)
          .toBeLessThanOrEqual(720);
      }
    });
}

// The figure's storage folds its all-zero rows into its gaps; the stack
// keeps every item; the inspector's storage keeps its zero rows
test("reveal folds storage's zero rows, nothing else's", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto("./embed.html#scene=reveal");
  const words = (v: string) => page.locator(`.view[data-view$=":${v}"] ` +
    ".wrow[data-slot]").evaluateAll((rs) => rs.map((r) =>
    [...r.querySelectorAll(".b, .ab")].map((b) => b.textContent).join("")));
  await expect.poll(async () => (await words("stack")).length,
    { timeout: 20_000 }).toBe(STACK);
  const st = await words("storage");
  expect(st.length).toBeGreaterThan(5);
  expect(st.filter((w) => /^(00)+$/.test(w))).toEqual([]);
  // (no two gaps in a row)
  expect(await page.locator('.view[data-view$=":storage"] .gap + .gap')
    .count()).toBe(0);
  await ready(page);
  await expect(page.locator('#panel .view[data-side=after] ' +
    '.wrow[data-slot$="0003"]')).toHaveCount(1);
});
