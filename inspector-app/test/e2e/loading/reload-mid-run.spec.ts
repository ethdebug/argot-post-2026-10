// A page left (a reload) while its run is in the worker, loading the
// EVM, logs nothing: the browser cancels the worker's loads (WebKit's
// "Importing a module script is canceled", Firefox's error), and a run
// cut short by the page leaving is not a failed run (run/client.ts).
// (CI's shell.spec reload hit this on a cold dev server.)
import { test, expect } from "../../page";

test("a reload during a run logs nothing", async ({ page }) => {
  // (the EVM's chunk, slow until the reload: the run under way then)
  await page.route(/evm/, async (r) => {
    await new Promise((x) => setTimeout(x, 1500));
    await r.fallback().catch(() => {});
  });
  await page.goto("./shell.html#scene=reveal");
  await page.waitForTimeout(400);
  await page.unroute(/evm/);
  await page.reload();
  await expect(page.locator(".view .wrow").first()).toBeVisible({
    timeout: 30_000 });
});
