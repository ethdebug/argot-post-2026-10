// The shell's Phase 2 fit lenses get the same interaction rules as the
// page: hover a plain fill (no caps), the rest steps back, caps on a
// selection; chevrons at the row's right end
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const open = async (page: Page, lens: string) => {
  await page.goto(`./shell.html#lens=${lens}`);
  await expect(page.locator(".view .b[data-owners]").first())
    .toBeAttached();
};
const look = (page: Page) => page.evaluate(() => {
  const lit = [...document.querySelectorAll<HTMLElement>(".view .b.hl")];
  const rest = [...document.querySelectorAll<HTMLElement>(
    ".view:not([hidden]) .rows .b:not(.hl):not(.at)")];
  return { lit: lit.length,
    capped: lit.filter((b) => getComputedStyle(b).boxShadow !== "none")
      .length,
    back: rest.length > 0 && rest.every((b) =>
      +getComputedStyle(b).opacity < 0.5) };
});

for (const lens of ["alice-plays", "vyper"]) {
  test(`${lens}: hover plain, the rest steps back; a selection capped`,
    async ({ page }) => {
      await open(page, lens);
      await page.locator(`.tree li[data-path="${A}.score"] > .row`).first()
        .hover();
      const h = await look(page);
      expect(h.lit).toBeGreaterThan(0);
      expect([h.capped, h.back]).toEqual([0, true]);
      await page.locator(`.tree li[data-path="${A}.score"] > .row`).first()
        .click();
      await page.mouse.move(1, 1);
      const s = await look(page);
      expect(s.capped).toBe(s.lit);
    });

  test(`${lens}: a chevron at its row's right end`, async ({ page }) => {
    await open(page, lens);
    const g = await page.evaluate((a) => {
      const li = document.querySelector(`.tree li[data-path="${a}"]`)!;
      const r = li.querySelector(":scope > .row")!.getBoundingClientRect();
      const c = li.querySelector(":scope > .chev")!.getBoundingClientRect();
      return { right: r.right - c.right < 20, middle: Math.abs((c.top +
        c.bottom) / 2 - (r.top + r.bottom) / 2) < 2 };
    }, A);
    expect(g).toEqual({ right: true, middle: true });
  });
}

test("players-walk: opens at step 0 of players, and walks", async ({ page }) => {
  await page.goto("./shell.html#lens=players-walk");
  const count = page.locator(".rbar .rcount");
  await expect(count).toHaveText("start");
  await expect(page.locator(".view .b.hl")).not.toHaveCount(0);
  await page.locator('.rbar button[data-r="next"]').click();
  await expect(count).toHaveText("1 / 10");
  await expect(page.locator(".rbar .rcap")).toContainText("The keys");
});

// Each dump fits its own box; each tree lines up with its own dumps
// (its first row level with their first line; on a wide page, down to
// the last one's bottom); nothing scrolls sideways
const fit = (page: Page) => page.evaluate(() => {
  const r = (e: Element) => e.getBoundingClientRect();
  const wide = document.documentElement.scrollWidth >
    document.documentElement.clientWidth + 1;
  const views = [...document.querySelectorAll<HTMLElement>(
    ".view:not([hidden])")].filter((v) => v.querySelector(".rows .wrow"));
  const over = views.filter((v) => {
    const row = v.querySelector(".rows .wrow")!;
    return r(row).right > r(v.closest(".dump") ?? v).right + 1;
  }).length;
  const trees = [...document.querySelectorAll<HTMLElement>(".tree")]
    .filter((t) => t.offsetHeight);
  const gaps = trees.map((t) => {
    const mine = (t.dataset.align ?? "").split(" ").map((id) =>
      document.querySelector(`[data-view$=":${id}"]`)!).filter(Boolean);
    const boxes = mine.map((m) => r(m.closest(".dump") ?? m));
    return Math.round(Math.max(...boxes.map((b) => b.bottom)) -
      r(t).bottom);
  });
  return { wide, over, gaps };
});

for (const lens of ["alice-plays", "vyper", "players-walk"]) {
  for (const width of [1280, 1440]) {
    test(`${lens} at ${width}: each dump fits its box; each tree as tall `
      + "as its dumps; no sideways scroll", async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, lens);
      await page.waitForTimeout(200);
      const f = await fit(page);
      expect(f.wide).toBe(false);
      expect(f.over).toBe(0);
      // (players-walk has no tree)
      expect(f.gaps.length).toBe(lens === "players-walk" ? 0
        : lens === "vyper" ? 2 : 1);
      for (const g of f.gaps) expect(Math.abs(g)).toBeLessThanOrEqual(2);
    });
  }
}

for (const ex of ["vyper", "motd", "mid"]) test(`the parity page opened at `
  + `${ex}: the tree as tall as the storage dump`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`./#ex=${ex}`);
  await page.waitForFunction(() =>
    (window as unknown as { results?: { done: boolean } }).results?.done);
  await page.waitForTimeout(200);
  const g = await page.evaluate(() =>
    document.querySelector("#dump")!.getBoundingClientRect().bottom -
    document.querySelector("#tree")!.getBoundingClientRect().bottom);
  expect(Math.abs(g)).toBeLessThanOrEqual(2);
});
