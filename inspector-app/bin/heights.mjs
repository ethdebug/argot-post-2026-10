// The embed's heights manifest: every scene (scenes/*.json) drawn by
// embed.html at each width a host may give it, its first (ready) height;
// written as heights.json next to embed.html, { [scene]: { [width]:
// height } }, so a host reserves the space before the frame loads.
// Usage: node bin/heights.mjs [<site>] (default ../_site, as
// bin/site.sh assembles it)
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const site = path.resolve(process.argv[2] ?? path.join(app, "..", "_site"));
const dir = path.join(site, "demos", "inspector");
export const WIDTHS = [390, 680, 1024, 1360];
const scenes = fs.readdirSync(path.join(app, "scenes"))
  .filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();

const TYPES = { ".html": "text/html", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(site, u);
  if (f.endsWith("/")) f += "index.html";
  if (!f.startsWith(site) || !fs.existsSync(f)) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ??
    "application/octet-stream" });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/demos/inspector/`;

const browser = await chromium.launch();
const out = {};
for (const scene of scenes) {
  out[scene] = {};
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const ready = new Promise((ok) => page.exposeFunction("posted",
      (m) => m?.ready && ok(m.height)));
    await page.addInitScript(() => {
      window.parent.postMessage = (m) => window.posted?.(m);
    });
    await page.goto(`${base}embed.html#scene=${scene}`);
    const h = await Promise.race([ready, new Promise((r) =>
      setTimeout(() => r(null), 30_000))]);
    if (h === null) throw new Error(`${scene} at ${width}: no height`);
    out[scene][width] = h;
    await page.close();
  }
  console.log(scene, JSON.stringify(out[scene]));
}
await browser.close();
server.close();
fs.writeFileSync(path.join(dir, "heights.json"),
  JSON.stringify(out, null, 1) + "\n");
console.log(`heights: ${path.join(dir, "heights.json")}`);
