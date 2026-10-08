// One tint per owner: every byte of a value has its colour, wherever
// its bytes fall (a region that crosses rows, or a word's two lines)
import type { Page } from "@playwright/test";
import { test, expect, ready, select } from "../../page";

const at = async (page: Page, width: number, scene: string) => {
  await ready(page, { width });
  await select(page, scene, null);
};
// each owner's tint classes (at rest, and lit by its selection)
const tints = (page: Page, panel: string) => page.evaluate((q) => {
  const by: Record<string, string[]> = {};
  for (const b of document.querySelectorAll<HTMLElement>(
    `${q} .view:not([hidden]) .b[data-owners]`)) {
    const k = [...b.classList].filter((c) => /^(t|pk)\d$/.test(c)).join();
    const o = b.dataset.owners!;
    by[o] = [...new Set([...(by[o] ?? []), k])];
  }
  return by;
}, panel);
const one = (by: Record<string, string[]>) =>
  Object.entries(by).filter(([, ks]) => ks.length !== 1);

test("calldata: each part one tint across its rows, at rest and lit",
  async ({ page }) => {
    await at(page, 1600, "motd");
    const rest = await tints(page, "#cpanel");
    expect(Object.keys(rest).length).toBeGreaterThanOrEqual(4);
    expect(one(rest)).toEqual([]);
    // (the selector and the offset, which meet in row 0x0000: two)
    expect(rest["selector"]).not.toEqual(rest["text.offset"]);
    await page.locator('#ctree li[data-part="m"] > .row').click();
    expect(one(await tints(page, "#cpanel"))).toEqual([]);
  });

test("storage, 16 bytes a line: each value one tint", async ({ page }) => {
  await at(page, 390, "mid");
  expect(one(await tints(page, "#panel"))).toEqual([]);
  await select(page, "mid", "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]");
  expect(one(await tints(page, "#panel"))).toEqual([]);
});
