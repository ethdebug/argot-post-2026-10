// The embed's heights manifest: every scene (scenes/*.json) drawn by
// embed.html at each width a host may give it, its first (ready) height;
// written as heights.json next to embed.html, { [scene]: { [width]:
// height } }, so a host reserves the space before the frame loads.
// Each scene is drawn twice at each width, in fresh pages; two ready
// heights that differ fail the run, so a height measured too early never
// enters the manifest.
// Usage: node bin/heights.mjs [<site>] (default ../_site, as
// bin/site.sh assembles it)
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { WIDTHS, drawn, scenes, serve, siteOf } from "./embeds.mjs";

export { WIDTHS };
const site = siteOf(process.argv[2]);
const dir = path.join(site, "demos", "inspector");
const { base, close } = await serve(site);
const browser = await chromium.launch();
const out = {};
for (const scene of scenes()) {
  out[scene] = {};
  for (const width of WIDTHS) {
    const hs = [];
    for (let k = 0; k < 2; k++) {
      const { page, height } = await drawn(browser, base, scene, width);
      hs.push(height);
      await page.close();
    }
    if (hs[0] !== hs[1]) {
      console.error(`heights: ${scene} at ${width}px drew ${hs.join(" then ")}`);
      process.exit(1);
    }
    out[scene][width] = hs[0];
  }
  console.log(scene, JSON.stringify(out[scene]));
}
await browser.close();
close();
fs.writeFileSync(path.join(dir, "heights.json"),
  JSON.stringify(out, null, 1) + "\n");
console.log(`heights: ${path.join(dir, "heights.json")}`);
