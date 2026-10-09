// The embeds' posters (addendum §7, Q8: a static figure, the poster
// first): every scene drawn by embed.html at each width a host may give
// it (bin/embeds.mjs WIDTHS), in each theme, once ready, as the host
// shows it before the frame is ready, for RSS and with no script:
// posters/<scene>-<theme>-<width>.webp next to embed.html, at twice the
// pixels below 1024 (once from 1024), transparent where the embed is
// (the host's page shows through). Its height is the ready height
// (heights.json's): a poster is the space the frame takes. At most
// MAX bytes: a lower quality first; then, for a very tall figure, its
// first screen only (FIRST CSS pixels tall, from the top), the rest of
// the reserved space empty until the frame is ready.
// Usage: node bin/posters.mjs [<site>] (default ../_site, as
// bin/site.sh assembles it; after bin/heights.mjs, whose heights it
// checks)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { WIDTHS, drawn, scenes, serve, siteOf } from "./embeds.mjs";

export const THEMES = ["light", "dark"];
const MAX = 600 * 1024;
const QUALITIES = [0.85, 0.75, 0.65];
const FIRST = 1000;
const scaleAt = (width) => width >= 1024 ? 1 : 2;
const site = siteOf(process.argv[2]);
const dir = path.join(site, "demos", "inspector");
const out = path.join(dir, "posters");
fs.mkdirSync(out, { recursive: true });
const heights = JSON.parse(fs.readFileSync(path.join(dir, "heights.json"),
  "utf8"));
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
for (const scene of scenes()) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const at = () => drawn(browser, base, scene, width,
        { hash: `&theme=${theme}`, context: {
          deviceScaleFactor: scaleAt(width), colorScheme: theme } });
      // (once more, if its ready height is not the manifest's: a rare
      // early ready, seen once in about a hundred loads)
      let { page, height } = await at();
      if (height !== heights[scene]?.[width]) {
        await page.close();
        ({ page, height } = await at());
      }
      if (height !== heights[scene]?.[width]) {
        wrong.push(`${scene} ${theme} ${width}: ${height}, not ${
          heights[scene]?.[width]}`);
      }
      await page.setViewportSize({ width, height });
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
await browser.close();
close();
console.log(`posters: ${out}, ${Math.round(bytes / 1024)} KB`);
// (a theme that changes the ready height: the host's reserve is wrong)
if (wrong.length) {
  console.error(`heights differ from heights.json:\n${wrong.join("\n")}`);
  process.exit(1);
}
