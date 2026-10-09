// The annotated raw figure (scene raw-annotated, the post's first
// before/after) in a real browser: raw, then revealed in place, in the
// inspector's own looks: every value lit at once in its child colour,
// with its caps, and the inspector's popovers, each badged in its
// value's colour. Every popover placed, none over another or over
// another value's digits; nothing moves when they appear; a hover mutes
// the others; the hand-written ones said so; the host's message
// reveals it
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";
import { rawAnnotated } from "../../../src/lenses/raw";

// (its dumps: raw-hero's composition, storage and the stack at least)
const DUMPS = rawAnnotated.views.filter((v) => v.kind === "dump").length;

type R = { l: number; r: number; t: number; b: number };
// every popover, and the bytes it must not hide
const geometry = (page: Page) => page.evaluate(() => {
  const box = (e: Element): R => {
    const r = e.getBoundingClientRect();
    return { l: r.left + scrollX, r: r.right + scrollX, t: r.top + scrollY,
      b: r.bottom + scrollY };
  };
  const pops = [...document.querySelectorAll<HTMLElement>(".pop.note")]
    .map((e) => ({ ...box(e), text: e.textContent!,
      units: e.dataset.units!.split(" ") }));
  const digits = [...document.querySelectorAll<HTMLElement>(
    ".wrow[data-slot] .b[data-unit]:not(.z)")].map((e) => ({ ...box(e),
    unit: e.dataset.unit! }));
  // (to a tenth of a pixel: a scroll's float noise is no move)
  const tenth = (r: R) => Object.fromEntries(Object.entries(r).map(
    ([k, v]) => [k, Math.round(v * 10) / 10]));
  const rows = [...document.querySelectorAll(".wrow[data-slot]")]
    .map((e) => tenth(box(e)));
  return { pops, digits, rows, width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight };
});
const over = (a: R, b: R) => a.l < b.r - 0.5 && b.l < a.r - 0.5 &&
  a.t < b.b - 0.5 && b.t < a.b - 0.5;

for (const width of [1360, 1024, 390]) {
  test(`raw-annotated at ${width}px: the inspector's popovers, over no ` +
    "value's digits; nothing moves on the reveal", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=raw-annotated");
    await expect(page.locator(".view")).toHaveCount(DUMPS);
    // (storage: playerList, motd, the totals, three records; the stack)
    await expect.poll(async () => (await geometry(page)).pops.length)
      .toBeGreaterThanOrEqual(7);
    await page.evaluate(() => document.fonts.ready);
    const raw = await geometry(page);
    // (raw: no tints, no popovers to see)
    expect(await page.locator(".view.revealed").count()).toBe(0);
    expect(await page.locator(".pop.note").evaluateAll((es) => es.every(
      (e) => getComputedStyle(e).opacity === "0"))).toBe(true);
    expect(await page.locator(".view .b.hl, .view.chosen").count()).toBe(0);
    // (the toggle pressed in place: a click would scroll to it)
    await page.getByRole("radio", { name: "Annotated" })
      .dispatchEvent("click");
    await expect(page.locator(".view.revealed")).toHaveCount(DUMPS);
    const on = await geometry(page);
    expect(on.rows).toEqual(raw.rows);
    expect([on.width, on.height]).toEqual([raw.width, raw.height]);
    expect(on.width).toBe(width);
    for (const [i, a] of on.pops.entries()) {
      expect(a.r, a.text).toBeLessThanOrEqual(width);
      for (const b of on.pops.slice(i + 1)) {
        expect(over(a, b), `${a.text} / ${b.text}`).toBe(false);
      }
      for (const d of on.digits) {
        if (!a.units.includes(d.unit)) {
          expect(over(a, d), a.text).toBe(false);
        }
      }
    }
    // every value lit, active: its child colour, its caps; never the
    // selection's yellow
    const lit = await page.locator(".view .b[data-unit], .view .ab[data-unit]")
      .evaluateAll((es) => es.map((e) => ({ cls: e.className,
        cap: getComputedStyle(e).boxShadow })));
    for (const x of lit) {
      expect(x.cls).toMatch(/\bhl\b.*\bpk[1-9]\b/);
      expect(x.cap).not.toBe("none");
    }
    await expect(page.locator(".view.chosen")).toHaveCount(DUMPS);
    // one colour language: each popover badged; each badge in the
    // colour its value's bytes are lit in
    const badges = await page.evaluate(() => [...document.querySelectorAll<
      HTMLElement>(".pop.note")].map((p) => {
      const view = p.closest(".view")!;
      return [...p.querySelectorAll<HTMLElement>(".pbadge")].map((b) => {
        const u = b.dataset.unit;
        const byte = view.querySelector(`[data-unit="${u}"].hl`);
        const k = (c: string) => c.match(/\bpk[1-9]\b/)?.[0];
        return [p.textContent!.slice(0, 20), u, k(b.className),
          byte && k(byte.className)];
      });
    }));
    for (const bs of badges) expect(bs.length).toBeGreaterThan(0);
    for (const [text, u, a, b] of badges.flat()) {
      expect(u, String(text)).toBeDefined();
      expect(a, String(text)).toBe(b);
    }
    // the stack's (and memory's): written by hand, said so, once a panel
    await expect(page.locator(".view.hand .handmade")).toHaveCount(
      DUMPS - 1);
    await expect(page.locator(".view:not(.hand) .handmade")).toHaveCount(0);
    // a hover on carol's bytes: the others muted, their popovers light
    const carol = page.locator(".pop.note").filter({ hasText:
      /^players\[carol\]/ });
    const u = (await carol.getAttribute("data-units"))!;
    await page.locator(`.wrow[data-slot] .b[data-unit="${u}"]`).first()
      .hover();
    await expect(page.locator(`.view .b.hl.muted[data-unit="${u}"]`))
      .toHaveCount(0);
    expect(await page.locator(".view .b.hl.muted").count())
      .toBeGreaterThan(0);
    await expect(carol).not.toHaveClass(/\bkept\b/);
    expect(await page.locator(".view[data-location=storage] .pop.note.kept")
      .count()).toBe(5);
    // (the pointer gone: none muted)
    const far = await page.locator(".reveal").boundingBox();
    await page.mouse.move(far!.x + far!.width + 40, far!.y + 4);
    await expect(page.locator(".view .b.hl.muted")).toHaveCount(0);
    // carol's record, its popover with her score
    expect(on.pops.map((l) => l.text)).toContainEqual(
      expect.stringMatching(/^players\[carol\].*score 100 · combo 0/));
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
