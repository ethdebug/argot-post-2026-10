// The storage dump's rows: every moment (a scene of two) lists the same
// slots, ascending,
// with a gap line before the first (unless it is slot 0), wherever the
// addresses jump, and at the end
import { test, expect, ready, select } from "../../page";

test("every scene: the same slots at both moments, in order, gaps marked",
  async ({ page }) => {
    await ready(page);
    for (const id of ["mid", "alice", "motd", "vyper"]) {
      await select(page, id, null);
      const order = (side: string) => page.locator(
        `#panel .view[data-side="${side}"] .word`).evaluateAll((ws) =>
        ws.map((w) => (w as HTMLElement).dataset.slot!));
      const b = await order("after");
      // (a scene of two moments: the earlier's, the same slots)
      if (["alice", "motd"].includes(id)) {
        await page.locator('#timeline [data-t="prev"]').click();
        await expect.poll(() => page.locator("#timeline .tmark.cur")
          .getAttribute("data-k"), id).toBe("0");
        // (the earlier moment, stepped back to: its own dump, the
        // step's changes marked as the earlier side's)
        expect(await order("before"), id).toEqual(b);
      }
      const n = b.map(BigInt);
      expect(n.length, id).toBeGreaterThan(0);
      expect(n.every((x, k) => k === 0 || n[k - 1] < x), id).toBe(true);
      const want: string[] = [];
      n.forEach((x, k) => {
        if ((k === 0 && x !== 0n) || (k && x !== n[k - 1] + 1n)) {
          want.push("gap");
        }
        want.push(b[k]);
      });
      want.push("gap");
      expect(await page.locator("#panel .view .rows")
        // (its lines, through its groups: the runs between gap lines)
        .evaluate((r) => [...r.querySelectorAll(
          ":scope > :not(.run), :scope > .run > *")].filter((c) =>
          !c.classList.contains("room")).map((c) =>
          c.classList.contains("gap") ? "gap"
            : (c as HTMLElement).dataset.slot)), id).toEqual(want);
    }
  });
