// The storage section in two columns (the dump | the variables) from
// 660px: a phone in landscape and the blog's 1024px frame get them; a
// phone upright, one. The dump's bytes a line come from its own width
// (16 in a narrow column), never the window's
import { test, expect, type Page } from "@playwright/test";

type W = { results: { done: boolean } };
const look = async (page: Page, w: number, h: number) => {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
  return page.evaluate(() => {
    const d = document.querySelector("#panel")!.getBoundingClientRect();
    const t = document.querySelector("#tree")!.getBoundingClientRect();
    const word = document.querySelector(
      "#panel .view:not([hidden]) .word .bytes")!;
    const lines = new Set([...word.querySelectorAll(".b")].map((b) =>
      Math.round(b.getBoundingClientRect().top))).size;
    return { two: t.left >= d.right - 1 && Math.abs(t.top - d.top) < 200,
      perLine: 32 / lines,
      sideways: document.documentElement.scrollWidth >
        document.documentElement.clientWidth };
  });
};

for (const [w, h, two, perLine] of [[844, 390, true, 16],
  [667, 375, true, 16], [1024, 900, true, 16], [1600, 900, true, 32],
  [659, 900, false, 32], [390, 844, false, 16]] as const) {
  test(`${w}x${h}: ${two ? "two columns" : "one column"}, ${perLine} ` +
    "bytes a line", async ({ page }) => {
    expect(await look(page, w, h)).toEqual({ two, perLine,
      sideways: false });
  });
}
