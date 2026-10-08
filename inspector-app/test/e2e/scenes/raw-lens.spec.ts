// The raw lens's compositions in a real browser: at the blog figure's
// width and at a phone's, four dumps, none past the page's edge, the
// stack beside or under storage; bare bytes, which a hover leaves as
// they are
import { test, expect, settle } from "../../page";

for (const lens of ["raw-hero", "raw-spine", "raw-sheets"]) {
  for (const width of [1360, 390]) {
    test(`${lens} at ${width}px: four dumps in the page; bare`,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`./shell.html#lens=${lens}`);
        await expect(page.locator(
          '[data-area="stack"] .wrow[data-slot]')).toHaveCount(14);
        const boxes: Record<string, number[]> = await page.evaluate(() =>
          Object.fromEntries(
          [...document.querySelectorAll<HTMLElement>(".lens [data-area]")]
            .map((a) => { const r = a.querySelector(".rows")!
              .getBoundingClientRect();
            return [a.dataset.area, [r.left, r.right, r.top]]; })));
        expect(Object.keys(boxes).sort()).toEqual(["calldata", "memory",
          "stack", "storage"]);
        for (const [l, r] of Object.values(boxes)) {
          expect(l).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(width);
        }
        expect(await page.evaluate(() =>
          document.documentElement.scrollWidth)).toBe(width);
        // (wide: the stack to the side of storage; narrow: under it)
        const [st, sk] = [boxes.storage, boxes.stack];
        if (width > 760) expect(sk[0] >= st[1] - 60 || sk[1] <= st[0])
          .toBe(true);
        else expect(sk[2]).toBeGreaterThan(st[2]);
        const before = await page.locator(".lens").innerHTML();
        await page.locator('[data-area="storage"] .b').nth(40).hover();
        await settle(page);
        expect(await page.locator(".lens").innerHTML()).toBe(before);
        expect(await page.locator(".pop, .b.hl, .b[data-owners]").count())
          .toBe(0);
      });
  }
}
