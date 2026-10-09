// The storage dump's rows: both moments (a scene of two) list the same
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
      // (a scene of two moments: the earlier's dump, the same slots)
      if (["alice", "motd"].includes(id)) {
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
      expect(await page.locator('#panel .view[data-side=after] .rows')
        .evaluate((r) => [...r.children].filter((c) =>
          !c.classList.contains("room")).map((c) =>
          c.classList.contains("gap") ? "gap"
            : (c as HTMLElement).dataset.slot)), id).toEqual(want);
    }
  });
