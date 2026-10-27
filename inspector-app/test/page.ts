// The embed (embed.html: one scene, by its lens alone), as the e2e
// specs drive it: its ready signal and a reader's selection, in one
// place
import { test as base, expect, type Page } from "@playwright/test";
import { pick } from "./pick";

// Every spec's page: no request leaves the page's host (the page is
// self-contained, as GitHub Pages serves it), and nothing logs an error
// or throws; a test that expects one says so with `quiet: false`
export const test = base.extend<{ quiet: boolean }>({
  quiet: [true, { option: true }],
  page: async ({ page, baseURL, quiet }, use) => {
    const problems: string[] = [];
    const host = new URL(baseURL!).host;
    page.on("request", (r) => {
      const u = new URL(r.url());
      // (the loader imports the decoder bundle it fetched from a blob:)
      if (/^https?:$/.test(u.protocol) && u.host !== host) {
        problems.push(`request to ${u.href}`);
      }
    });
    // (WebKit's own line for a module load a navigation cut off, as a
    // reload mid-load does: the browser's, not the page's)
    page.on("console", (m) => m.type() === "error" &&
      !/^Cannot load \S+ due to access control checks\.$/.test(m.text()) &&
      problems.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => {
      // (WebKit reports a fetch that a navigation cut off, as the idle
      // prefetch's can be, as a page error; the page catches the fetch.
      // Matched on the error's text too: on CI's Linux WebKit the message
      // alone missed it, shown as "Fetch API cannot load http: /…")
      if (!/Fetch API cannot load \S.* due to access control checks/
        .test(`${e.message} ${e}`)) problems.push(`pageerror: ${e}`);
    });
    await use(page);
    if (quiet) expect(problems).toEqual([]);
  },
});
export { expect };

export type Win = Window & typeof globalThis & {
  fitDumps(): void;
  embedReady?: boolean;
};

// The storage dump at the moment shown (a scene of two: the later)
export const V = '#panel .view[data-side=after]';

// Opens scene `scene`'s embed (embed.html#scene=<scene>, and `hash`:
// "&theme=dark", …; at `width` x `height`) and waits until it posts its
// first ready height (src/embed/main.tsx: drawn, its fonts in)
export async function ready(page: Page, { scene = "pitfall-nesting",
  hash = "", width, height = 900 }: { scene?: string; hash?: string;
  width?: number; height?: number } = {}) {
  if (width) await page.setViewportSize({ width, height });
  await page.addInitScript(() => addEventListener("message", (e) => {
    if (e.data?.type === "ethdebug:height" && e.data.ready) {
      (window as Win).embedReady = true;
    }
  }));
  // (a new page each time: the embed reads its hash once)
  await page.goto("about:blank");
  await page.goto(`./embed.html#scene=${scene}${hash}`);
  await page.waitForFunction(() => (window as Win).embedReady);
}

// Selects `sel` in the storage tree as a reader does, a click (null:
// none, Escape on the selected row; and first, for a row the related
// view leaves out of the tree); nothing if it is so already
export async function select(page: Page, sel: string | null) {
  if (await selected(page) === sel) return;
  if (sel === null || !await row(page, sel).count()) {
    await page.locator("#tree .row.sel").focus();
    await page.keyboard.press("Escape");
    await expect.poll(() => selected(page)).toBe(null);
  }
  if (sel === null) return;
  await pick(row(page, sel));
  await expect.poll(() => selected(page)).toBe(sel);
}

// The storage tree's row for `path`
export const row = (page: Page, path: string) =>
  page.locator(`#tree li[data-path="${path}"] > .row`);

// The selected path in the storage tree, or null
export const selected = (page: Page) => page.evaluate(() =>
  (document.querySelector("#tree .row.sel")?.parentElement as
    HTMLElement | null)?.dataset.path ?? null);

// Two frames: what a pointer move or a click changed is painted
export const settle = (page: Page) => page.evaluate(() =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// The box of what `sel` finds (one element)
export const box = async (page: Page, sel: string) =>
  (await page.locator(sel).boundingBox())!;

// Each element's box, in the page's coordinates (pointing may scroll the
// window): for "nothing moves"
export const boxes = (page: Page, sel: string) => page.locator(sel)
  .evaluateAll((es) => es.map((e) => {
    const r = e.getBoundingClientRect();
    return [r.left + scrollX, r.top + scrollY, r.width, r.height]
      .map(Math.round).join();
  }));

// Waits until nothing moves: no animation or transition running (one
// that loops for ever aside), and the window's scroll the same, for
// `frames` frames in a row (a smooth scroll comes before an animation)
export const still = (page: Page, frames = 10) => page.evaluate((n) =>
  new Promise<void>((ok) => {
    let quiet = 0;
    let y = scrollY;
    const tick = () => {
      const busy = document.getAnimations().some((a) =>
        (a.playState === "running" || a.pending) &&
        a.effect?.getComputedTiming().iterations !== Infinity);
      quiet = !busy && scrollY === y ? quiet + 1 : 0;
      y = scrollY;
      if (quiet >= n) ok();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), frames);

// What `read` gives once it gives the same twice in a row
export async function stable<T>(read: () => Promise<T>): Promise<T> {
  let last: string | undefined;
  await expect.poll(async () => {
    const now = JSON.stringify(await read());
    const same = now === last;
    last = now;
    return same;
  }, { intervals: [50] }).toBe(true);
  return JSON.parse(last!) as T;
}
