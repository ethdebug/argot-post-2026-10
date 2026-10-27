// The storage dump's rows: its slots, ascending, with a gap line before
// the first (unless it is slot 0), wherever the addresses jump, and at
// the end
import { test, expect, ready, select } from "../../page";

test("pitfall-nesting: the slots in order, gaps marked",
  async ({ page }) => {
    await ready(page);
    // (every row: none selected)
    await select(page, null);
    const b = await page.locator("#embed .view[data-location=storage] " +
      ".word").evaluateAll((ws) => ws.map((w) =>
      (w as HTMLElement).dataset.slot!));
    const n = b.map(BigInt);
    expect(n.length).toBeGreaterThan(0);
    expect(n.every((x, k) => k === 0 || n[k - 1] < x)).toBe(true);
    const want: string[] = [];
    n.forEach((x, k) => {
      if ((k === 0 && x !== 0n) || (k && x !== n[k - 1] + 1n)) {
        want.push("gap");
      }
      want.push(b[k]);
    });
    want.push("gap");
    expect(await page.locator("#embed .view[data-location=storage] .rows")
      // (its lines, through its groups: the runs between gap lines)
      .evaluate((r) => [...r.querySelectorAll(
        ":scope > :not(.run), :scope > .run > *")].filter((c) =>
        !c.classList.contains("room")).map((c) =>
        c.classList.contains("gap") ? "gap"
          : (c as HTMLElement).dataset.slot))).toEqual(want);
  });
