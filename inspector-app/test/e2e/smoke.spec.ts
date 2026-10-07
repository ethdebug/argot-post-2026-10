import { test, expect } from "@playwright/test";

test("the parity page and the shell load", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("h1")).toBeVisible();
  await page.goto("./shell.html");
  await expect(page.locator("[data-shell-picker]")).toBeAttached();
});
