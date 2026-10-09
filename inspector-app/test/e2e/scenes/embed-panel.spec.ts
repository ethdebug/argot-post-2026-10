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
    // (each panel told whether it is stuck at the top, as it changes, as
    // the post's host does)
    const was = new Map();
    const tell = () => document.querySelectorAll(".panel").forEach((p) => {
      const stuck = Math.abs(p.getBoundingClientRect().top) < 0.5 &&
        p.parentElement.getBoundingClientRect().top < 0;
      if (was.get(p) === stuck) return;
      was.set(p, stuck);
      p.contentWindow.postMessage({ type: "ethdebug:stuck", stuck }, "*");
    });
    addEventListener("scroll", tell);
    // (and a panel's frame, once it loads: the state as it is then)
    document.querySelectorAll(".panel").forEach((p) =>
      p.addEventListener("load", () => { was.delete(p); tell(); }));
    addEventListener("message", (e) => {
      const f = [...document.querySelectorAll("iframe")].find((x) =>
        x.contentWindow === e.source);
      if (!f) return;
      if (e.data?.type === "ethdebug:height") {
        f.style.height = e.data.height + "px";
        heights.push([f.parentElement.id, f.className, e.data.height]);
      }
      // (a step's lit rows into view, under the panel: as the post's
      // host does, whenever asked)
      if (e.data?.type === "ethdebug:scroll-to") {
        window.asked = (window.asked ?? 0) + 1;
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
  // (the figure's top in view: the panel in its place, not stuck)
  await expect.poll(() => page.locator("#a .figure").evaluate((f) =>
    f.getBoundingClientRect().height)).toBeGreaterThan(600);
  await page.evaluate(() => {
    const a = document.querySelector("#a")!.getBoundingClientRect();
    scrollTo(0, scrollY + a.top - 100);
  });
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
  // (the panel not stuck: no step asks the host to scroll)
  expect(await page.evaluate(() => (window as unknown as
    { asked?: number }).asked ?? 0)).toBe(0);
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
  // (stuck: a step's lit rows, the host asked to bring them into view)
  await pa.locator('#details button[data-r="next"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as
    { asked?: number }).asked ?? 0)).toBeGreaterThan(0);
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

// (▶ under a still pointer: every click a step, the panel stuck or not
// yet; a step never moves it. ← → in the panel's frame step too; no
// step moves the focus out of the frame the reader is in)
for (const stuck of [false, true]) {
  test(`rapid ▶ clicks at one point, the panel ${stuck ? "stuck" : "in " +
    "its place"}: each a step; ← → in the panel`, async ({ page, baseURL,
    browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("./embed.html");
    await page.setContent(host(baseURL!, "mid"));
    const pa = page.frameLocator("#a .panel");
    await expect(pa.locator('#details button[data-r="start"]'))
      .toBeEnabled();
    // (the figure drawn, at its height)
    await expect.poll(() => page.locator("#a .figure").evaluate((f) =>
      f.getBoundingClientRect().height)).toBeGreaterThan(600);
    // (the figure's top in view, or above it: the panel stuck)
    await page.evaluate((dy) => {
      const a = document.querySelector("#a")!.getBoundingClientRect();
      scrollTo(0, scrollY + a.top + dy);
    }, stuck ? 400 : -60);
    const at = async (q: string) => {
      const r = (await pa.locator(q).boundingBox())!;
      return [r.x + r.width / 2, r.y + r.height / 2] as const;
    };
    const p0 = await page.locator("#a .panel").evaluate((f) =>
      f.getBoundingClientRect().top);
    expect(p0 === 0, `stuck: top ${p0}`).toBe(stuck);
    const [sx, sy] = await at('#details button[data-r="start"]');
    await page.mouse.click(sx, sy);

    await expect(pa.locator("#details .rcount")).toHaveText(/^(start|1 \/)/);
    await expect(pa.locator("#details.replaying")).toHaveCount(1);
    // (once the details have unfolded)
    await page.waitForTimeout(400);
    const [x, y] = await at('#details button[data-r="next"]');
    const place = () => pa.locator("#details .rcount").textContent();
    const n0 = parseInt((await place())!) || 0;
    for (let k = 1; k <= 5; k++) {
      await page.mouse.click(x, y);
      await expect(pa.locator("#details .rcount"), `click ${k}`)
        .toHaveText(new RegExp(`^${n0 + k} /`));
    }
    // (the frame the reader clicked keeps the focus)
    expect(await page.evaluate(() => (document.activeElement as
      HTMLIFrameElement)?.className)).toBe("panel");
    for (const [key, d] of [["ArrowRight", 1], ["ArrowRight", 1],
      ["ArrowLeft", -1]] as const) {
      const n = parseInt((await place())!);
      await page.keyboard.press(key);
      await expect(pa.locator("#details .rcount"), `${key} (${browserName})`)
        .toHaveText(new RegExp(`^${n + d} /`));
    }
  });
}
