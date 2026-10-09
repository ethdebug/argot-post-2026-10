// The annotated raw figure (scene raw-annotated, the post's first
// before/after) in a real browser: raw, then revealed in place. Every
// label placed, none over another or over another value's bytes or any
// lit digit; nothing moves when they appear; the hand-written ones said
// so; the host's message reveals it
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";
import { rawAnnotated } from "../../../src/lenses/raw";

// (its dumps: raw-hero's composition, storage and the stack at least)
const DUMPS = rawAnnotated.views.filter((v) => v.kind === "dump").length;

type R = { l: number; r: number; t: number; b: number };
// every label, and the cells it must not cover: lit digits, and the
// bytes of a unit other than its own
const geometry = (page: Page) => page.evaluate(() => {
  const box = (e: Element): R => {
    // (in the page: a click may scroll it)
    const r = e.getBoundingClientRect();
    return { l: r.left + scrollX, r: r.right + scrollX, t: r.top + scrollY,
      b: r.bottom + scrollY };
  };
  const labels = [...document.querySelectorAll<HTMLElement>(".alabel")]
    .map((e) => ({ ...box(e), unit: e.dataset.unit!, text: e.textContent!,
      view: e.closest<HTMLElement>(".view")!.dataset.view!,
      hand: e.classList.contains("hand"), kind: e.dataset.kind! }));
  const cells = [...document.querySelectorAll<HTMLElement>(".b.an")]
    .map((c) => ({ ...box(c), unit: c.dataset.unit!,
      zero: c.classList.contains("z"),
      view: c.closest<HTMLElement>(".view")!.dataset.view! }));
  // (to a tenth of a pixel: a scroll's float noise is no move)
  const tenth = (r: R) => Object.fromEntries(Object.entries(r).map(
    ([k, v]) => [k, Math.round(v * 10) / 10]));
  const rows = [...document.querySelectorAll(".wrow[data-slot]")]
    .map((e) => tenth(box(e)));
  return { labels, cells, rows, width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight };
});
const over = (a: R, b: R) => a.l < b.r - 0.5 && b.l < a.r - 0.5 &&
  a.t < b.b - 0.5 && b.t < a.b - 0.5;

for (const width of [1360, 1024, 390]) {
  test(`raw-annotated at ${width}px: labels in unlit space, nothing ` +
    "moves on the reveal", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=raw-annotated");
    await expect(page.locator(".view")).toHaveCount(DUMPS);
    await expect.poll(async () => (await geometry(page)).labels.length)
      .toBeGreaterThanOrEqual(13);
    await page.evaluate(() => document.fonts.ready);
    const raw = await geometry(page);
    // (raw: no colours, no labels to see)
    expect(await page.locator(".view.revealed").count()).toBe(0);
    expect(await page.locator(".alabel").evaluateAll((es) => es.every((e) =>
      getComputedStyle(e).opacity === "0"))).toBe(true);
    // (the toggle pressed where it is: a click would scroll the page
    // to it, and a browser's scroll may land between pixels)
    await page.getByRole("radio", { name: "Annotated" })
      .dispatchEvent("click");
    await expect(page.locator(".view.revealed")).toHaveCount(DUMPS);
    const on = await geometry(page);
    // nothing moved, nothing grew
    expect(on.rows).toEqual(raw.rows);
    expect([on.width, on.height]).toEqual([raw.width, raw.height]);
    expect(on.width).toBe(width);
    // every label: not over another, nor another unit's bytes, nor a
    // lit digit; inside the page
    for (const [i, a] of on.labels.entries()) {
      expect(a.r, a.text).toBeLessThanOrEqual(width);
      for (const b of on.labels.slice(i + 1)) {
        expect(over(a, b), `${a.text} / ${b.text}`).toBe(false);
      }
      for (const c of on.cells) {
        if (c.view !== a.view) continue;
        if (c.unit === a.unit && c.zero) continue;
        expect(over(a, c), a.text).toBe(false);
      }
    }
    // the stack's and memory's: hand-written, and only they
    for (const l of on.labels) {
      expect(l.hand, l.text).toBe(!l.view.endsWith(":storage"));
    }
    await expect(page.locator(".view.hand .hand-note")).toHaveCount(DUMPS - 1);
    // carol's record, labelled with her score
    expect(on.labels.map((l) => l.text)).toContainEqual(
      expect.stringMatching(/^players\[carol\]: score 100 · combo 0/));
  });
}

test("raw-annotated in a host page: revealed by its message; its " +
  "height says it reveals", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html");
  await page.setContent(`<body style="margin:0">
    <iframe id="f" src="${baseURL}embed.html#scene=raw-annotated"
      style="border:0;width:100%;height:50px;display:block"></iframe>
    <script>addEventListener("message", (e) => {
      if (e.data?.type !== "ethdebug:height") return;
      document.getElementById("f").style.height = e.data.height + "px";
      window.got = e.data;
    });</script></body>`);
  const frame = page.frameLocator("#f");
  await expect.poll(() => page.evaluate(() =>
    (window as unknown as { got?: { reveal?: boolean } }).got?.reveal))
    .toBe(true);
  // (in a frame: no toggle; the host's scroll reveals it)
  await expect(frame.locator(".reveal")).toHaveCount(0);
  await expect(frame.locator(".view.revealed")).toHaveCount(0);
  const tell = (on: boolean) => page.evaluate((on) => (document
    .getElementById("f") as HTMLIFrameElement).contentWindow!.postMessage(
    { type: "ethdebug:reveal", on }, "*"), on);
  await tell(true);
  await expect(frame.locator(".view.revealed")).toHaveCount(DUMPS);
  await tell(false);
  await expect(frame.locator(".view.revealed")).toHaveCount(0);
});
