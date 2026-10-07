import { test, expect, type Page } from "@playwright/test";

const lit = (page: Page) => page.locator(
  "#panel .view:not([hidden]) .b.hl:not(.cmp *)").evaluateAll((bs) =>
  bs.map((b) => `${(b.closest(".word") as HTMLElement).dataset.slot!
    .slice(-2)}:${(b as HTMLElement).dataset.i}`));

test("total's row lights bytes 16-31 of slot 2", async ({ page }) => {
  await page.goto("./shell.html#lens=inspector");
  await page.locator('#tree li[data-path="total"] > .row').click();
  expect(await lit(page)).toEqual(Array.from({ length: 16 },
    (_, i) => `02:${16 + i}`));
  await expect(page.locator('#tree li[data-path="total"] > .row'))
    .toHaveAttribute("aria-pressed", "true");
});

test("byte 31 of slot 2 selects total", async ({ page }) => {
  await page.goto("./shell.html#lens=inspector");
  await page.locator(
    '.view:not([hidden]) .b[data-owners="total"][data-i="31"]').click();
  await expect(page.locator("#tree .row.sel")).toHaveText(/total/);
  expect(await lit(page)).toEqual(Array.from({ length: 16 },
    (_, i) => `02:${16 + i}`));
});

test("hovering total's row lights its bytes; the rest mutes",
  async ({ page }) => {
    await page.goto("./shell.html#lens=inspector");
    // (the scene selects alice's record; a click on it clears)
    await page.locator("#tree .row.sel").click();
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    await page.locator('#tree li[data-path="total"] > .row').hover();
    expect(await lit(page)).toHaveLength(16);
    await expect(page.locator("#panel")).toHaveClass(/\bactive\b/);
    await expect(page.locator('#tree li[data-path="rounds"] > .row'))
      .not.toHaveClass(/\bhl\b/);
  });

test("hover, selection and clearing move nothing", async ({ page }) => {
  await page.goto("./shell.html#lens=inspector");
  await page.locator(
    '.view:not([hidden]) .b[data-owners="total"]').first().waitFor();
  const boxes = () => page.locator(
    "#panel .wrow, #panel .b, #tree .row").evaluateAll((es) =>
    es.map((e) => JSON.stringify(e.getBoundingClientRect())));
  const rest = await boxes();
  await page.locator(
    '.view:not([hidden]) .b[data-owners="rounds"]').first().hover();
  expect(await boxes()).toEqual(rest);
  await page.locator('#tree li[data-path="total"] > .row').click();
  expect(await boxes()).toEqual(rest);
  await page.locator('#tree li[data-path="total"] > .row').click();
  expect(await boxes()).toEqual(rest);
});
