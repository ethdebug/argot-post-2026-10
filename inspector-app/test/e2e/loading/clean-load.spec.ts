import { pick } from "../../pick";
import { test, expect } from "@playwright/test";

test("the parity page and the shell load", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toBeVisible();
  await page.goto("./shell.html");
  await expect(page.locator("[data-shell-picker]")).toBeAttached();
});

for (const url of ["./", "./shell.html"]) {
  test(`${url}: no console errors on load, nor once a pointer is coloured`,
    async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" &&
        errors.push(m.text()));
      await page.goto(url);
      await expect(page.locator("#tree li[data-path]").first())
        .toBeAttached();
      // (a selection shows its pointer: the colouring loads)
      await pick(page.locator('#tree li[data-path="players"] > .row'));
      await page.locator('#details button[data-r="start"]').click();
      await expect(page.locator("#ptr .line span[style]").first())
        .toBeAttached();
      // (and none the page caught: an old copy of the library in the dev
      // server's cache fails here, "failure to recognize kind of
      // expression", see repin.spec.ts)
      const caught = await page.evaluate(() => (window as unknown as
        { results?: { errors: string[] } }).results?.errors ?? []);
      expect([...errors, ...caught]).toEqual([]);
    });
}
