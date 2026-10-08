// Screenshots of each state in a manifest (bin/manifest.mjs), in
// Chromium: <id>.png, or <id>-walk<k>.png per walkthrough step.
// Usage: PAGE=<url> OUT=<dir> [JOBS=4] node bin/shots.mjs <manifest>
// Prints one JSON line per state ({ id, files } or { id, error }), then
// the count of PNGs written; exits 1 if any state failed.
import { chromium, devices } from "playwright";
import path from "node:path";
import fs from "node:fs";

const PAGE = process.env.PAGE;
const OUT = process.env.OUT;
const JOBS = Number(process.env.JOBS ?? 4);
if (!PAGE || !OUT || !process.argv[2]) {
  console.error("usage: PAGE=<url> OUT=<dir> node bin/shots.mjs <manifest>");
  process.exit(2);
}
const { states } = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const DEVICE = {
  desktop: { viewport: { width: 1280, height: 900 } },
  phone: devices["iPhone 15"],
};

// Two frames, so the last change is painted
const frames = (page) => page.evaluate(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(r))));

// The part of the page each section is: in the vanilla page the
// storage section (#storage) holds only the bookmarks, and its bar,
// walkthrough details, dump and tree follow it, up to the end of .scols
const SPAN = { storage: ["#storage", ".scols"], memory: ["#memory"] };

// The section's box on the page, with every scroll position in it (a
// scroll or a resize after a click can take some frames)
const measure = (page, section) => page.evaluate((qs) => {
  const els = qs.map((q) => document.querySelector(q));
  const rs = els.map((e) => e.getBoundingClientRect());
  const [x, y] = [Math.min(...rs.map((r) => r.left)),
    Math.min(...rs.map((r) => r.top))];
  const scrolls = [...document.querySelectorAll("*")]
    .filter((e) => e.scrollTop || e.scrollLeft)
    .map((e) => [e.id || e.className, e.scrollTop, e.scrollLeft]);
  return { clip: { x: x + scrollX, y: y + scrollY,
    width: Math.max(...rs.map((r) => r.right)) - x,
    height: Math.max(...rs.map((r) => r.bottom)) - y },
  scrolls, animations: document.getAnimations().length,
  // (a load a click starts shows the bar, fixed on the view, until done)
  loading: window.loading.busy() ||
    !document.querySelector("#loadbar").hidden };
}, SPAN[section]);

// Wait until nothing loads and the box and the scrolls stay the same
// for three readings (at most 6 s), then screenshot the box
async function shoot(page, section, file) {
  let last = "";
  let same = 0;
  let m;
  for (let k = 0; k < 120 && same < 3; k++) {
    await frames(page);
    m = await measure(page, section);
    const now = JSON.stringify(m);
    same = now === last && !m.animations && !m.loading ? same + 1 : 0;
    last = now;
  }
  await page.screenshot({ path: path.join(OUT, file), fullPage: true,
    clip: m.clip, animations: "disabled" });
  return file;
}

async function capture(ctx, s) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${PAGE}#${s.hash}`);
    await page.waitForFunction(() => window.results?.done &&
      window.memResults?.done && !window.loading?.busy(), null,
    { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    for (const a of s.actions) {
      if (a.click) await page.locator(a.click).first().dispatchEvent("click");
      else if (a.focus) await page.locator(a.focus).first().focus();
      else await page.keyboard.press(a.key);
    }
    if (s.walk !== "all") {
      return [await shoot(page, s.section, `${s.id}.png`)];
    }
    const files = [];
    const walkFile = () => `${s.id}${files.length + 1}.png`;
    if (s.section === "memory") {
      const steps = page.locator("#mhow li[data-region]");
      const n = await steps.count();
      for (let k = 0; k < n; k++) {
        await steps.nth(k).focus();
        files.push(await shoot(page, s.section, walkFile()));
      }
      return files;
    }
    const start = page.locator('#details button[data-r="start"]');
    if (!await start.count()) return files;
    await start.dispatchEvent("click");
    files.push(await shoot(page, s.section, walkFile()));
    const next = page.locator('#details button[data-r="next"]');
    while (await next.count() && !await next.isDisabled()) {
      await next.dispatchEvent("click");
      files.push(await shoot(page, s.section, walkFile()));
    }
    return files;
  } finally {
    await page.close();
  }
}

// (scrollbars hidden: the system's setting, overlay or classic, can
// change between two captures and would move the tree's contents)
const browser = await chromium.launch({ args: ["--hide-scrollbars"] });
const contexts = new Map();
const contextFor = async (s) => {
  const k = `${s.device} ${s.scheme}`;
  if (!contexts.has(k)) {
    contexts.set(k, browser.newContext({ ...DEVICE[s.device],
      colorScheme: s.scheme, reducedMotion: "reduce" }));
  }
  return contexts.get(k);
};

let written = 0;
let failed = 0;
const queue = [...states];
await Promise.all(Array.from({ length: JOBS }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try {
      const files = await capture(await contextFor(s), s);
      written += files.length;
      console.log(JSON.stringify({ id: s.id, files: files.length }));
    } catch (e) {
      failed++;
      console.log(JSON.stringify({ id: s.id,
        error: String(e?.message ?? e).split("\n")[0] }));
    }
  }
}));
await browser.close();
console.log(`${written} PNGs from ${states.length} states, ${failed} failed`);
process.exit(failed ? 1 : 0);
