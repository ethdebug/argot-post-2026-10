// The post's figures never move the host's page on their own: from its
// first ready height, each frame's posted height holds (no input, on a
// phone and in the blog's wide frame); the walkthrough's panel frame at
// its tallest from the start, whatever its step
import { test, expect } from "../../page";

const POST = ["reveal", "pitfall-nesting", "pitfall-compiler",
  "real-debugger", "pointer-walkthrough", "optimized-locals"];

for (const width of [390, 1024]) {
  test(`the post's figures at ${width}px: one height from ready on`,
    async ({ page, baseURL, browserName }) => {
      test.skip(browserName !== "chromium", "one browser: a timing run");
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 800 });
      await page.goto("./embed.html");
      for (const scene of POST) {
        const panel = scene === "pointer-walkthrough";
        await page.evaluate(([b, s, p]) => {
          (window as never as { log: unknown[] }).log = [];
          onmessage = (e) => {
            if (e.data?.type !== "ethdebug:height") return;
            const f = [...document.querySelectorAll("iframe")].find((x) =>
              x.contentWindow === e.source);
            // (a frame of the scene before, gone)
            if (!f) return;
            (window as never as { log: unknown[] }).log.push([f.id,
              e.data.height, !!e.data.ready]);
          };
          const ch = p ? "&panel=external&channel=s" : "";
          document.body.style.margin = "0";
          document.body.innerHTML = (p ? `<iframe id="p" src="${b}embed-` +
            `panel.html#scene=${s}&channel=s" style="display:block;` +
            "width:100%;height:10px;border:0\"></iframe>" : "") +
            `<iframe id="f" src="${b}embed.html#scene=${s}${ch}" style="` +
            "display:block;width:100%;height:600px;border:0\"></iframe>";
        }, [baseURL, scene, panel] as const);
        await page.waitForTimeout(6000);
        const log = await page.evaluate(() =>
          (window as never as { log: [string, number, boolean][] }).log);
        for (const id of panel ? ["f", "p"] : ["f"]) {
          const mine = log.filter(([x]) => x === id);
          const first = mine.findIndex(([, , r]) => r);
          expect(first, `${scene} ${id}: ready`).toBeGreaterThanOrEqual(0);
          // (the panel posts nothing before it)
          if (id === "p") expect(first, `${scene} ${id}`).toBe(0);
          expect(new Set(mine.slice(first).map(([, h]) => h)).size,
            `${scene} ${id}: ${mine.map(([, h]) => h).join(" ")}`).toBe(1);
        }
      }
    });
}

// A frame fits its content after the reader acts (a collapse shrinks
// it); a shrink of a few pixels no one caused keeps its room
test("pitfall-nesting: the reader's collapse: the frame fits; a " +
  "spontaneous 2px shrink keeps its room", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const posted: number[] = [];
  await page.exposeFunction("posted", (h: number) => posted.push(h));
  await page.addInitScript(() => {
    window.parent.postMessage = (m: { height: number }) =>
      (window as never as { posted(h: number): void }).posted(m.height);
  });
  await page.goto("./embed.html#scene=pitfall-nesting");
  await expect.poll(() => posted.length, { timeout: 20_000 })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  const ready = posted.at(-1)!;
  // (a spontaneous relayout: 2px more, then 2px less, no input)
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "bump";
    d.style.height = "2px";
    document.querySelector(".lens")!.append(d);
  });
  await expect.poll(() => posted.at(-1)).toBe(ready + 2);
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById("bump")!.remove());
  await page.waitForTimeout(500);
  expect(posted.at(-1)).toBe(ready + 2);
  // (the reader collapses players: it shrinks to fit; opens it again:
  // it grows back)
  await page.locator('.tree li[data-path="players"] > .chev').click();
  await expect.poll(() => posted.at(-1)).toBeLessThan(ready - 20);
  await page.waitForTimeout(600);
  const fit = await page.locator("#embed").evaluate((e) => {
    (e as HTMLElement).style.minHeight = "";
    return Math.ceil(e.getBoundingClientRect().height);
  });
  expect(posted.at(-1)).toBe(fit);
});
