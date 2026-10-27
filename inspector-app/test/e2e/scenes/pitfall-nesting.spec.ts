// The scene "pitfall-nesting": drawn by its lens from its snapshot,
// test/expect.ts's values; tree and dump linked. And the storage
// inspector's dump and tree, always shown (pointer-walkthrough too)
import { test, expect, ready, select } from "../../page";
import { pick } from "../../pick";
import { expected } from "../../expect";

test("pitfall-nesting: the snapshot's values, as test/expect.ts has them",
  async ({ page }) => {
    await ready(page);
    await expect(page.locator(
      "[data-scene=pitfall-nesting][data-mode=reader]")).toBeAttached();
    // (every variable: none selected, the related view shows them all)
    await select(page, null);
    for (const [path, , value] of expected["pitfall-nesting"]) {
      // (an address shown short: its whole value in data-full)
      const val = page.locator(`#tree li[data-path="${path}"] > .row .val`);
      await expect.poll(() => val.evaluate((e) => (e.querySelector(
        "[data-full]") as HTMLElement | null)?.dataset.full ??
        e.textContent), path).toBe(value);
    }
    expect(await page.evaluate(() => performance.getEntriesByType(
      "resource").some((e) => /\/snapshots\/pitfall-nesting\.json$/
      .test(e.name)))).toBe(true);
  });

test("pitfall-nesting: a tree row lights its bytes; a byte selects its " +
  "value", async ({ page }) => {
  await ready(page);
  await select(page, null);
  await pick(page.locator('#tree li[data-path="totalScore"] > .row'));
  await expect(page.locator(".view:not([hidden]) .b.hl")).toHaveCount(16);
  await select(page, null);
  await pick(page.locator(
    '.view:not([hidden]) .b[data-owners="motd"]').first());
  await expect(page.locator("#tree .row.sel")).toHaveText(/motd/);
});

test("the dump and the tree are always shown: at rest, with a selection, "
  + "in a walkthrough", async ({ page }) => {
  const shown = () => page.evaluate(() => ["#panel .view[data-side=after] " +
    ".rows", "#tree"].every((q) => {
    const r = document.querySelector(q)?.getBoundingClientRect();
    return !!r && r.width > 50 && r.height > 50;
  }));
  await ready(page);
  expect(await shown(), "as first shown").toBe(true);
  await select(page, null);
  expect(await shown(), "at rest").toBe(true);
  await select(page, "totalScore");
  expect(await shown(), "selected").toBe(true);
  // (pointer-walkthrough's walkthrough, stepped)
  await ready(page, { scene: "pointer-walkthrough" });
  expect(await shown(), "its walkthrough at its start").toBe(true);
  await page.locator('#details button[data-r="next"]').click();
  expect(await shown(), "walking").toBe(true);
});
