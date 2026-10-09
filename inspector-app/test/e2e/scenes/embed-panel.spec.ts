// The post's figure with its walkthrough panel in a frame of its own: a
// host page holds, for each figure, a wrapper with the panel's frame
// (embed-panel.html, sticky at the top) and the figure's (embed.html,
// panel=external), one channel each. The panel sticks while its figure
// is in view and leaves with its end; ▶ in the panel steps the figure;
// two figures of one scene keep apart; each frame posts its height
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const host = (base: string, scene: string) => `<body style="margin:0">
  <div style="height:900px"></div>
  ${["a", "b"].map((ch) => `<div class="fig" id="${ch}">
    <iframe class="panel" src="${base}embed-panel.html#scene=${scene}&channel=${
      ch}" style="position:sticky;top:0;z-index:1;border:0;width:100%;
      height:40px;display:block;background:#fff"></iframe>
    <iframe class="figure" src="${base}embed.html#scene=${scene
      }&panel=external&channel=${ch}" style="border:0;width:100%;
      height:40px;display:block"></iframe></div>
    <div style="height:1200px"></div>`).join("")}
  <script>
    window.heights = [];
    addEventListener("message", (e) => {
      const f = [...document.querySelectorAll("iframe")].find((x) =>
        x.contentWindow === e.source);
      if (!f) return;
      if (e.data?.type === "ethdebug:height") {
        f.style.height = e.data.height + "px";
        heights.push([f.parentElement.id, f.className, e.data.height]);
      }
      if (e.data?.type === "ethdebug:scroll-to") {
        window.scrolled = (window.scrolled ?? 0) + 1;
        const p = f.parentElement.querySelector(".panel");
        scrollTo(0, scrollY + f.getBoundingClientRect().top + e.data.y -
          p.offsetHeight - 16);
      }
    });
  </script></body>`;

// the figure's lit rows (their addresses)
const lit = (page: Page, ch: string) => page.frameLocator(`#${ch} .figure`)
  .locator(".view:not([hidden]) .wrow.on").evaluateAll((rs) =>
    rs.map((r) => (r as HTMLElement).dataset.slot).join());
const box = (page: Page, q: string) => page.locator(q).evaluate((e) => {
  const r = e.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom };
});

test("the panel in a frame of its own: sticky in its figure, ▶ steps " +
  "the figure, two figures apart, heights posted",
async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("./embed.html");
  await page.setContent(host(baseURL!, "mid"));
  const pa = page.frameLocator("#a .panel");
  const pb = page.frameLocator("#b .panel");
  // (at rest: the selection and the way in, in each panel)
  await expect(pa.locator('#details button[data-r="start"]')).toBeEnabled();
  await expect(pb.locator('#details button[data-r="start"]')).toBeEnabled();
  // (each frame posts its height; the figure draws no panel of its own)
  await expect.poll(() => page.evaluate(() => new Set((window as unknown as
    { heights: string[][] }).heights.map((h) => `${h[0]} ${h[1]}`)).size))
    .toBe(4);
  await expect(page.frameLocator("#a .figure").locator(".wpanel"))
    .toHaveCount(0);
  await page.locator("#a").scrollIntoViewIfNeeded();
  const b0 = await lit(page, "b");
  await pa.locator('#details button[data-r="start"]').click();
  await expect(pa.locator("#details.replaying")).toHaveCount(1);
  // (the other figure's panel: still at rest)
  await expect(pb.locator("#details.replaying")).toHaveCount(0);
  const l0 = await lit(page, "a");
  await pa.locator('#details button[data-r="next"]').click();
  await expect(pa.locator("#details .rcount")).toHaveText(/^1 \//);
  await expect.poll(() => lit(page, "a")).not.toBe(l0);
  expect(await lit(page, "b")).toBe(b0);
  // (the step's lit rows: the host asked to bring them into view)
  await expect.poll(() => page.evaluate(() => (window as unknown as
    { scrolled?: number }).scrolled ?? 0)).toBeGreaterThan(0);
  // (the panel's frame grew to its walkthrough's height)
  const ph = await page.locator("#a .panel").evaluate((f) =>
    f.getBoundingClientRect().height);
  expect(ph).toBeGreaterThan(200);
  // (scrolled into the figure: the panel at the top of the view)
  await page.evaluate(() => {
    const a = document.querySelector("#a")!.getBoundingClientRect();
    scrollTo(0, scrollY + a.top + 300);
  });
  const p1 = await box(page, "#a .panel");
  expect(Math.abs(p1.top)).toBeLessThan(1);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT });
  // (past the figure's end: the panel leaves with it)
  await page.evaluate(() => {
    const a = document.querySelector("#a")!.getBoundingClientRect();
    scrollTo(0, scrollY + a.bottom - 100);
  });
  const p2 = await box(page, "#a .panel");
  const f2 = await box(page, "#a");
  expect(p2.top).toBeLessThan(0);
  expect(p2.bottom).toBeLessThanOrEqual(f2.bottom + 0.5);
});
