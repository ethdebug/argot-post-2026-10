// The storage inspector's figure in two columns (the dump | the
// variables) from 910px, where the dump keeps 580px; narrower, the tree
// over the dump, each the frame's width (embed.css). The dump's bytes a
// line come from its own width, never the window's
import type { Page } from "@playwright/test";
import { test, expect, ready } from "../../page";

const look = async (page: Page, w: number, h: number) => {
  await ready(page, { width: w, height: h });
  return page.evaluate(() => {
    const d = document.querySelector("#panel")!.getBoundingClientRect();
    const t = document.querySelector("#tree")!.getBoundingClientRect();
    const word = document.querySelector(
      "#panel .view[data-side=after] .word .bytes")!;
    const lines = new Set([...word.querySelectorAll(".b")].map((b) =>
      Math.round(b.getBoundingClientRect().top))).size;
    return { two: t.left >= d.right - 1 && Math.abs(t.top - d.top) < 200,
      perLine: 32 / lines,
      sideways: document.documentElement.scrollWidth >
        document.documentElement.clientWidth };
  });
};

for (const [w, h, two, perLine] of [[390, 844, false, 16],
  [790, 900, false, 32], [909, 900, false, 32], [910, 900, true, 32],
  [1216, 900, true, 32], [1600, 900, true, 32]] as const) {
  test(`${w}x${h}: ${two ? "two columns" : "one column"}, ${perLine} ` +
    "bytes a line", async ({ page }) => {
    expect(await look(page, w, h)).toEqual({ two, perLine,
      sideways: false });
  });
}
