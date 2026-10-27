// The vyper lens (scene pitfall-compiler) gets the same interaction
// rules as the storage inspector: hover a plain fill (no caps), the rest
// steps back, caps on a selection
import type { Page } from "@playwright/test";
import { test, expect, ready, stable } from "../../page";

const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const open = async (page: Page) => {
  await ready(page, { scene: "pitfall-compiler" });
  await expect(page.locator(".view .b[data-owners]").first())
    .toBeAttached();
};
const look = (page: Page) => page.evaluate(() => {
  const lit = [...document.querySelectorAll<HTMLElement>(".view .b.hl")];
  const rest = [...document.querySelectorAll<HTMLElement>(
    ".view:not([hidden]) .rows .b:not(.hl):not(.at)")];
  return { lit: lit.filter((b) => !b.classList.contains("chg")).length,
    // (a changed byte's own mark aside: two moments' dumps)
    capped: lit.filter((b) => !b.classList.contains("chg") &&
      getComputedStyle(b).boxShadow !== "none").length,
    back: rest.length > 0 && rest.every((b) =>
      +getComputedStyle(b).opacity < 0.5) };
});

test("pitfall-compiler: hover plain, the rest steps back; a selection "
  + "capped", async ({ page }) => {
    await open(page);
    // (the scene opens with alice's score selected: cleared first)
    // (empty space at the tree's corner: in WebKit, with the tree's
    // type at the cell size, the lens's own, under its negative margin)
    await page.locator(".tree").first().click({ position: { x: 1, y: 1 },
      force: true });
    await page.keyboard.press("Escape");
    await expect(page.locator(".view .b.on, .tree .row.on")).toHaveCount(0);
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

// (the scene, on the storage inspector's lens: its tree, its dump, the
// rows Related shows)
test("pointer-walkthrough: opens at step 0 of players, and walks",
  async ({ page }) => {
  await ready(page, { scene: "pointer-walkthrough" });
  const count = page.locator(".rbar .rcount");
  await expect(count).toHaveText("start");
  await expect(page.locator(".view .b.hl")).not.toHaveCount(0);
  await page.locator('.rbar button[data-r="next"]').click();
  await expect(count).toHaveText("1 / 11");
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

for (const width of [1280, 1440]) {
  test(`pitfall-compiler at ${width}: each dump fits its box; each tree `
    + "as tall as its dumps; no sideways scroll", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const f = await stable(() => fit(page));
    expect(f.wide).toBe(false);
    expect(f.over).toBe(0);
    expect(f.gaps.length).toBe(2);
    for (const g of f.gaps) expect(Math.abs(g)).toBeLessThanOrEqual(2);
  });
}
