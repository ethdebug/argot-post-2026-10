// The embeds' posters (addendum §7, Q8: a static figure, the poster
// first): every scene drawn by embed.html at each width a host may give
// it (bin/embeds.mjs WIDTHS), in each theme, once ready, as the host
// shows it before the frame is ready, for RSS and with no script:
// posters/<scene>-<theme>-<width>.webp next to embed.html, at twice the
// pixels, transparent where the embed is (the host's page shows
// through). Its height is the ready height (heights.json's): a poster
// is the space the frame takes.
// Usage: node bin/posters.mjs [<site>] (default ../_site, as
// bin/site.sh assembles it; after bin/heights.mjs, whose heights it
// checks)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { WIDTHS, drawn, scenes, serve, siteOf } from "./embeds.mjs";

export const THEMES = ["light", "dark"];
const site = siteOf(process.argv[2]);
const dir = path.join(site, "demos", "inspector");
const out = path.join(dir, "posters");
fs.mkdirSync(out, { recursive: true });
const heights = JSON.parse(fs.readFileSync(path.join(dir, "heights.json"),
  "utf8"));
const { base, close } = await serve(site);
const browser = await chromium.launch();
// (PNG to WebP by the browser's own encoder, at 0.85: at twice the
// pixels, text stays sharp, a third of lossless's size)
const webp = async (page, png) => Buffer.from(await page.evaluate(
  async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    [c.width, c.height] = [img.naturalWidth, img.naturalHeight];
    c.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/webp",
      0.85));
    if (blob?.type !== "image/webp") throw new Error("no WebP encoder");
    const s = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < s.length; i += 0x8000) {
      bin += String.fromCharCode(...s.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }, png.toString("base64")), "base64");
let bytes = 0;
const wrong = [];
for (const scene of scenes()) {
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const at = () => drawn(browser, base, scene, width,
        { hash: `&theme=${theme}`, context: { deviceScaleFactor: 2,
          colorScheme: theme } });
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
      const png = await page.screenshot({ omitBackground: true,
        clip: { x: 0, y: 0, width, height } });
      const file = path.join(out, `${scene}-${theme}-${width}.webp`);
      const w = await webp(page, png);
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
