// The scene "mid": drawn by its lens from its snapshot (the reader: the
// embed), test/expect.ts's values; tree and dump linked (the shell, from
// its run)
import { test, expect } from "../../page";
import { pick } from "../../pick";
import { expected } from "../../expect";

test("mid: the snapshot's values, as test/expect.ts has them",
  async ({ page }) => {
    await page.goto("./embed.html#scene=mid");
    await expect(page.locator("[data-scene=mid][data-mode=reader]"))
      .toBeAttached();
    for (const [path, , value] of expected.mid) {
      await expect(page.locator(`#tree li[data-path="${path}"] > .row .val`),
        path).toHaveText(value);
    }
    expect(await page.evaluate(() => performance.getEntriesByType(
      "resource").some((e) => e.name.endsWith("/snapshots/mid.json"))))
      .toBe(true);
  });

test("mid: a tree row lights its bytes; a byte selects its value",
  async ({ page }) => {
    await page.goto("./shell.html#scene=mid");
    await pick(page.locator('#tree li[data-path="totalScore"] > .row'));
    await expect(page.locator(".view:not([hidden]) .b.hl")).toHaveCount(16);
    await pick(page.locator(
      '.view:not([hidden]) .b[data-owners="motd"]').first());
    await expect(page.locator("#tree .row.sel")).toHaveText(/motd/);
  });
