// The embed's heights manifest: every scene (scenes/*.json) drawn by
// embed.html at each width a host may give it, its first (ready) height;
// written as heights.json next to embed.html, { [scene]: { [width]:
// height } }, so a host reserves the space before the frame loads.
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
    const { page, height } = await drawn(browser, base, scene, width);
    out[scene][width] = height;
    await page.close();
  }
  console.log(scene, JSON.stringify(out[scene]));
}
await browser.close();
close();
fs.writeFileSync(path.join(dir, "heights.json"),
  JSON.stringify(out, null, 1) + "\n");
console.log(`heights: ${path.join(dir, "heights.json")}`);
