// The storage section in two columns (the dump | the variables) from
// 900px: the blog's 1024px frame gets them; one column below
import { test, expect, type Page } from "@playwright/test";

type W = { results: { done: boolean } };
const sides = async (page: Page, w: number) => {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
  return page.evaluate(() => {
    const d = document.querySelector("#panel")!.getBoundingClientRect();
    const t = document.querySelector("#tree")!.getBoundingClientRect();
    return t.left >= d.right - 1 && Math.abs(t.top - d.top) < 200;
  });
};

for (const [w, two] of [[1024, true], [900, true], [899, false]] as const) {
  test(`${w}px: ${two ? "two columns" : "one column"}`, async ({ page }) => {
    expect(await sides(page, w)).toBe(two);
  });
}
