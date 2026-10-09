// The embed's ready height is its drawn height, every time: one scene
// loaded again and again, in fresh pages, posts the same first ready
// height (a ready posted before the tree and the dumps filled in, or
// before the fit pass, was once 399 for 1718), on a slowed CPU
import { test, expect } from "../../page";

test("embed.html#scene=alice: 30 loads, one ready height",
  async ({ browser, baseURL, browserName }) => {
    test.skip(browserName !== "chromium", "one browser: a stress run");
    test.setTimeout(240_000);
    const seen: number[] = [];
    for (let k = 0; k < 30; k++) {
      const ctx = await browser.newContext({ deviceScaleFactor: 2,
        viewport: { width: 680, height: 800 } });
      const page = await ctx.newPage();
      // (a slow machine, as a busy runner: the CPU at a quarter)
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const ready = new Promise<number>((ok) => void page.exposeFunction(
        "posted", (m: { ready?: boolean; height: number }) =>
          m?.ready && ok(m.height)));
      await page.addInitScript(() => {
        window.parent.postMessage = (m: unknown) =>
          (window as never as { posted?(m: unknown): void }).posted?.(m);
      });
      await page.goto(`${baseURL}embed.html#scene=alice&theme=light`);
      seen.push(await ready);
      // (and it stays: the height drawn a moment later is the same)
      await page.waitForTimeout(300);
      expect(await page.locator("#embed").evaluate((e) =>
        Math.ceil(e.getBoundingClientRect().height))).toBe(seen.at(-1));
      await ctx.close();
    }
    expect(new Set(seen).size, seen.join(" ")).toBe(1);
  });
