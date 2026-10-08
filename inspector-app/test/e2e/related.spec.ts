// The related view: All | Related over the storage dump, its context
// rows, the hash, the tree, and a walkthrough in it
import { test, expect, type Page } from "@playwright/test";
import { A } from "../expect";

type W = { results: { done: boolean } };
const open = async (page: Page, hash: string) => {
  await page.goto(`./#${hash}`);
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
// the storage dump's rows shown, by name
const rows = (page: Page) => page.locator(
  "#panel .view:not([hidden]) .wrow[data-slot]").evaluateAll((rs) =>
  rs.map((r) => (r as HTMLElement).dataset.name));
const tree = (page: Page) => page.locator("#tree li[data-path]")
  .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.path));
const rel = (page: Page) => page.evaluate(() =>
  new URLSearchParams(location.hash.slice(1)).get("rel"));
const ROSTER0 = "keccak(slot 0)";
const RECORD = "keccak(0x7099…79c8, slot 3)";

test("All | Related: on, ± 1 row, off; in the hash", async ({ page }) => {
  await open(page, `ex=mid&sel=${A}.score`);
  const all = await rows(page);
  expect(all.length).toBeGreaterThan(10);
  expect(await rel(page)).toBe(null);
  await page.locator('#related button[data-rows="related"]').click();
  await expect.poll(() => rows(page)).toEqual(["slot 3", ROSTER0, RECORD]);
  expect(await rel(page)).toBe("0");
  await page.locator("#related input[data-context]").check();
  await expect.poll(() => rows(page)).toEqual(["slot 2", "slot 3", ROSTER0,
    `${ROSTER0} + 1`, RECORD, `${RECORD} + 1`]);
  expect(await rel(page)).toBe("1");
  await page.locator('#related button[data-rows="all"]').click();
  await expect.poll(() => rows(page)).toEqual(all);
  expect(await rel(page)).toBe(null);
});

test("the hash: a reload keeps the view and its context", async ({ page }) => {
  await open(page, `ex=mid&sel=${A}.score&rel=1`);
  await expect(page.locator('#related button[data-rows="related"]'))
    .toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#related input[data-context]")).toBeChecked();
  await expect.poll(() => rows(page)).toHaveLength(6);
});

test("the tree: the selection's path, and where its key came from",
  async ({ page }) => {
    await open(page, `ex=mid&sel=${A}.score&rel=0`);
    await expect.poll(() => tree(page)).toEqual(["roster", "roster[0]",
      "players", A, `${A}.score`]);
  });

test("nothing selected: every row, and a hint", async ({ page }) => {
  await open(page, "ex=mid&sel=");
  const all = await rows(page);
  await page.locator('#related button[data-rows="related"]').click();
  await expect(page.locator("#related .relhint")).toBeVisible();
  expect(await rows(page)).toEqual(all);
});

test("hover moves nothing; a click selects, and the rows follow",
  async ({ page }) => {
    await open(page, `ex=mid&sel=${A}.score&rel=0`);
    await expect.poll(() => rows(page)).toHaveLength(3);
    await page.locator('#tree li[data-path="roster"] > .row').hover();
    await page.locator('#tree li[data-path="roster[0]"] > .row').hover();
    expect(await rows(page)).toEqual(["slot 3", ROSTER0, RECORD]);
    await page.locator('#tree li[data-path="roster[0]"] > .row').click();
    await expect.poll(() => rows(page)).toEqual(["slot 0", ROSTER0]);
  });

test("a walkthrough in the related view: step 0 to found, the same rows",
  async ({ page }) => {
    await open(page, `ex=mid&sel=${A}&rel=0`);
    const shown = await rows(page);
    expect(shown).toEqual(["slot 3", ROSTER0, RECORD, `${RECORD} + 1`]);
    await page.locator('#details button[data-r="start"]').click();
    await expect(page.locator("#details .rcount")).toHaveText(/^0\s*\/\s*12$/);
    // (step 0: the record's slots lit, in rows that are shown)
    const lit = () => page.locator(
      "#panel .view:not([hidden]) .wrow:has(.b.hl)").evaluateAll((rs) =>
      rs.map((r) => (r as HTMLElement).dataset.name));
    await expect.poll(lit).toEqual(["slot 3", RECORD, `${RECORD} + 1`]);
    await page.locator("#details").focus();
    for (let i = 1; i <= 12; i++) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("#details .rcount"))
        .toHaveText(new RegExp(`^${i}\\s*/\\s*12$`));
      expect(await rows(page)).toEqual(shown);
    }
    await expect(page.locator("#details .rshort")).toHaveText(/found/);
  });
