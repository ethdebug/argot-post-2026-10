import { test, expect } from "@playwright/test";
import { lenses } from "../../src/lenses";

test("picker lists every lens; ] moves on; reload restores",
  async ({ page }) => {
    await page.goto("./shell.html");
    const items = page.locator("[data-shell-picker] [data-lens]");
    await expect(items).toHaveCount(lenses.length);
    await expect(page.locator('[data-shell-picker] [aria-current="page"]'))
      .toHaveCount(1);
    await page.locator("body").press("]");
    await expect(page).toHaveURL(/#lens=/);
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.locator('[data-shell-picker] [aria-current="page"]'))
      .toHaveAttribute("data-lens",
        new URL(url).hash.match(/lens=([^&]+)/)![1]);
  });

test("g opens the list; a lens in it shows that lens", async ({ page }) => {
  await page.goto("./shell.html");
  // (the shell mounts once the project is loaded: a key pressed before
  // that has no shell to go to)
  await expect(page.locator("[data-shell-picker]")).toBeAttached();
  const list = page.locator("[data-shell-list]");
  await expect(list).toBeHidden();
  await page.locator("body").press("g");
  await expect(list).toBeVisible();
  await list.locator(`[data-lens="${lenses[0].id}"]`).click();
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`#lens=${lenses[0].id}(&|$)`));
  await expect(page.locator("#tree li[data-path]").first()).toBeVisible();
});

test("copy link gives the current URL", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { copied: string[] };
    w.copied = [];
    Object.defineProperty(navigator, "clipboard", { value: {
      writeText: async (t: string) => void w.copied.push(t) } });
  });
  await page.goto("./shell.html#lens=inspector");
  // (the lens writes its own keys once its view is shown: a copy before
  // that is of a URL the page then changes)
  await expect(page).toHaveURL(/&ex=/);
  await page.locator("[data-shell-copy]").click();
  expect(await page.evaluate(() =>
    (window as unknown as { copied: string[] }).copied))
    .toEqual([page.url()]);
});
