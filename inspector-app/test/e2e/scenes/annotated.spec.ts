// The annotated raw figure (scene reveal, the post's first
// before/after) in a real browser: raw, then revealed in place, in the
// inspector's own looks: every value lit at once in its child colour,
// with its caps, and the inspector's popovers, each badged in its
// value's colour. Every popover placed, none over another, over any
// value's bytes or an address, nor out of its panel; nothing moves when they appear; a hover mutes
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
  // (every lit byte, any value's, and every address label)
  const digits = [...document.querySelectorAll<HTMLElement>(
    ".rows .word :is(.b, .ab)[data-unit], .rows .addr .a")].map((e) =>
    ({ ...box(e), unit: e.dataset.unit ?? "addr" }));
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
  test(`reveal at ${width}px: the inspector's popovers, over no ` +
    "value's digits; nothing moves on the reveal", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=reveal");
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
    // (a colour mixed to nothing: rgba(…, 0), or color(srgb … / 0))
    expect(await page.locator(".view .b.hl").evaluateAll((es) => es.every(
      (e) => /(, 0\)|\/ 0\))$/.test(getComputedStyle(e).backgroundColor))))
      .toBe(true);
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
      // (never over what it explains, nor anything else lit, nor an
      // address)
      for (const d of on.digits) {
        expect(over(a, d), `${a.text} over ${d.unit}`).toBe(false);
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
    // caps per region, as a lit selection's leaves: carol's packed slot
    // six (its six fields), slot 2 two (totalHits, totalScore), each
    // stack item one; a region's run never past its own bytes
    const segs = (q: string) => page.locator(q).evaluateAll((es) =>
      es.filter((e) => e.classList.contains("gs")).length);
    expect(await segs('.view[data-location=storage] .word[data-slot$="9978"]' +
      " .b.hl")).toBe(6);
    expect(await segs(`.view[data-location=storage] .word[data-slot="0x${
      "2".padStart(64, "0")}"] .b.hl`)).toBe(2);
    expect(await segs(".view[data-location=stack] .ab.hl")).toBe(4);
    // (written by hand: the caption says so; no ink in the figure)
    await expect(page.locator(".view .handmade")).toHaveCount(0);
    // every card inside its figure, and its storage cards inside storage
    const sto = await page.locator(".view[data-location=storage] .rows")
      .evaluate((e) => { const r = e.getBoundingClientRect();
        return [r.left + scrollX, r.right + scrollX]; });
    for (const t of await page.locator(
      ".view[data-location=storage] .pop.note").evaluateAll((es) =>
      es.map((e) => { const r = e.getBoundingClientRect();
        return [r.left + scrollX, r.right + scrollX]; }))) {
      expect(t[0]).toBeGreaterThanOrEqual(sto[0] - 8.5);
      expect(t[1]).toBeLessThanOrEqual(sto[1] + 0.5);
    }
    // never cut: every value's parts named whole
    expect(await page.locator(".pop.note .pcut").count()).toBe(0);
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

test("reveal in a host page: revealed by its message; its " +
  "height says it reveals", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html");
  await page.setContent(`<body style="margin:0">
    <iframe id="f" src="${baseURL}embed.html#scene=reveal"
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
  // scroll-linked: { progress }, each value over its slice of it, in
  // reading order: halfway, storage's first value in, the last panel's
  // last not yet; back to 0, raw again
  const post = (progress: number) => page.evaluate((progress) => (document
    .getElementById("f") as HTMLIFrameElement).contentWindow!.postMessage(
    { type: "ethdebug:reveal", on: progress > 0, progress }, "*"), progress);
  // (each panel: its first value's fill, its last value's popover)
  const vars = () => frame.locator(".view.annot").evaluateAll((vs) =>
    vs.map((v) => { const n = Number((v as HTMLElement).dataset.units);
      const f = v.querySelector<HTMLElement>('.rows [data-r="0"]');
      const p = v.querySelector<HTMLElement>(`.pop.note[data-r="${n - 1}"]`)
        ?? v.querySelector<HTMLElement>(".pop.note:last-of-type");
      return [f?.style.getPropertyValue("--tf"),
        p?.style.getPropertyValue("--tp")].map(Number); }));
  await post(0.5);
  await expect.poll(async () => (await vars())[0][0]).toBe(1);
  expect((await vars()).at(-1)![1]).toBe(0);
  await post(0);
  await expect.poll(async () => (await vars()).flat().every((x) => x === 0))
    .toBe(true);
  await expect(frame.locator(".view.revealed")).toHaveCount(0);
});
