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

test("raw-sheets: memory's card leaves storage's last row in view",
  async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.goto("./shell.html#lens=raw-sheets");
    await expect(page.locator('[data-area="storage"] .gap').last())
      .toBeVisible();
    const [gap, mem] = await page.evaluate(() => [
      [...document.querySelectorAll('[data-area="storage"] .gap')].at(-1)!
        .getBoundingClientRect().bottom,
      document.querySelector('[data-area="memory"]')!
        .getBoundingClientRect().top]);
    expect(mem).toBeGreaterThanOrEqual(gap - 0.5);
  });

// The main page's "Raw bytes" scene: first among the scenes, the raw
// lens in place of the storage inspector, its three compositions by a
// toggle; the hash keeps it; a storage scene brings the inspector back
for (const width of [1360, 390]) {
  test(`the main page's Raw bytes scene at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./");
    await page.waitForFunction(() => (window as unknown as
      { results: { done: boolean } }).results?.done);
    const first = page.locator("#picker button").first();
    await expect(first).toHaveAttribute("data-id", "raw");
    await first.click();
    await expect(page.locator("main")).toHaveAttribute("data-lens", "");
    for (const v of ["hero", "spine", "sheets"]) {
      await page.locator(`#rawscene button[data-raw="${v}"]`).click();
      await expect(page.locator(`#rawscene .lens.raw-${v}`)).toBeVisible();
      await expect(page.locator(
        '#rawscene [data-area="stack"] .wrow[data-slot]')).toHaveCount(14);
      expect(await page.evaluate(() => location.hash))
        .toContain(`scene=raw&raw=${v}`);
    }
    // (the inspector's parts step out; the scene picker stays)
    for (const q of ["#panel", "#tree", "#memory", "#contract"]) {
      await expect(page.locator(q)).toBeHidden();
    }
    await expect(page.locator("#picker button").first()).toBeVisible();
    // (a reload keeps it)
    await page.reload();
    await expect(page.locator("#rawscene .lens.raw-sheets")).toBeVisible();
    await page.locator('#picker button[data-id="mid"]').click();
    await expect(page.locator("main")).not.toHaveAttribute("data-lens");
    await expect(page.locator("#panel")).toBeVisible();
    await expect(page.locator("#rawscene .lens")).toHaveCount(0);
  });
}
