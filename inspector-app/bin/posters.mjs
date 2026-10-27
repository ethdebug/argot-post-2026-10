// The embeds' posters (addendum §7, Q8: a static figure, the poster
// first): every scene drawn by embed.html at each width the post's
// frames take (WIDTHS), in each theme, once ready, as the host shows it
// before the frame is ready, for reader views, print, RSS and with no
// script: posters/<scene>-<theme>-<width>.webp next to embed.html, at
// twice the pixels below 1024 (once from 1024), transparent where the
// embed is (the host's page shows through). A scene is drawn as the post
// hosts it (SHOWN): the reveal revealed (its payoff, for a reader who
// can't scroll it), a walkthrough with its panel in a frame of its own
// (panel=external; the panel itself has no poster). Its height is the
// ready height: a poster is the space the frame takes (the same twice).
// At most MAX bytes: a
// lower quality first; then, for a very tall figure, its first screen
// only (FIRST CSS pixels tall, from the top), the rest of the reserved
// space empty until the frame is ready.
// Usage: node bin/posters.mjs [<site>] (default ../_site, as
// bin/site.sh assembles it)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import {
  PHONES, app, drawn, scenes, serve, siteOf,
} from "./embeds.mjs";

export const THEMES = ["light", "dark"];
// the post's frame widths (argot.org's EthdebugFigure): a phone's text
// column (PHONES), a small tablet's, `narrow` at its widest, the text
// column at 960 and at its widest, and `wide` at its widest. (A frame
// between two takes the narrower's poster, at its own size.)
export const WIDTHS = [...PHONES, 680, 790, 960, 1024, 1216];
// the hash the post adds to a scene's embed
const SHOWN = (scene) => scene === "reveal" ? "&reveal=1"
  : JSON.parse(fs.readFileSync(path.join(app, "scenes", `${scene}.json`),
    "utf8")).initial?.walk ? "&panel=external" : "";
const MAX = 600 * 1024;
const QUALITIES = [0.85, 0.75, 0.65];
const FIRST = 1000;
const scaleAt = (width) => width >= 1024 ? 1 : 2;
const site = siteOf(process.argv[2]);
const dir = path.join(site, "demos", "inspector");
const out = path.join(dir, "posters");
fs.mkdirSync(out, { recursive: true });
const { base, close } = await serve(site);
const browser = await chromium.launch();
// (PNG to WebP by the browser's own encoder, lossy: at 0.85, text stays
// sharp, a third of lossless's size)
const webp = async (page, png, q) => Buffer.from(await page.evaluate(
  async ([b64, q]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    [c.width, c.height] = [img.naturalWidth, img.naturalHeight];
    c.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp", q));
    if (blob?.type !== "image/webp") throw new Error("no WebP encoder");
    const s = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < s.length; i += 0x8000) {
      bin += String.fromCharCode(...s.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }, [png.toString("base64"), q]), "base64");
// the smallest quality's file under MAX, else the first screen's
async function encode(page, width, height) {
  const shot = (h) => page.screenshot({ omitBackground: true,
    clip: { x: 0, y: 0, width, height: h } });
  const full = await shot(height);
  for (const q of QUALITIES) {
    const w = await webp(page, full, q);
    if (w.length <= MAX) return { w, cropped: false };
  }
  return { w: await webp(page, await shot(Math.min(height, FIRST)),
    QUALITIES[0]), cropped: true };
}
let bytes = 0;
const wrong = [];
// (a scene's posters; scenes AT_ONCE at a time)
const AT_ONCE = 3;
async function postersOf(scene) {
  const shown = SHOWN(scene);
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const at = () => drawn(browser, base, scene, width,
        { hash: `${shown}&theme=${theme}`, context: {
          deviceScaleFactor: scaleAt(width), colorScheme: theme } });
      // (its height: a first drawing's, at the poster's scale (at twice
      // the pixels, a few px off a drawing at once's); the poster,
      // a second's, and once more if that differs: a rare early ready,
      // seen once in about a hundred loads)
      const first = await at();
      await first.page.close();
      const want = first.height;
      let { page, height } = await at();
      if (height !== want) {
        await page.close();
        ({ page, height } = await at());
      }
      if (height !== want) {
        wrong.push(`${scene} ${theme} ${width}: ${height}, not ${want}`);
      }
      await page.setViewportSize({ width, height });
      // (its transitions done: the reveal's popovers fade in after ready)
      await page.evaluate(() => Promise.all(document.getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {}))));
      const file = path.join(out, `${scene}-${theme}-${width}.webp`);
      const { w, cropped } = await encode(page, width, height);
      if (cropped) console.log(`  ${scene} ${theme} ${width}: its first ` +
        `${FIRST}px only (${height}px tall)`);
      fs.writeFileSync(file, w);
      bytes += w.length;
      await page.close();
    }
  }
  console.log(scene);
}
const queue = scenes();
await Promise.all(Array.from({ length: AT_ONCE }, async () => {
  for (let scene; (scene = queue.shift());) await postersOf(scene);
}));
await browser.close();
close();
console.log(`posters: ${out}, ${Math.round(bytes / 1024)} KB`);
if (wrong.length) {
  console.error(`heights differ:\n${wrong.join("\n")}`);
  process.exit(1);
}
