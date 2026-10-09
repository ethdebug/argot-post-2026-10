// What bin/heights.mjs and bin/posters.mjs share: the assembled site
// served locally, the widths a host may give an embed, the scenes, and
// a scene's embed drawn at a width until it posts its first (ready)
// height
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";

export const app = path.dirname(path.dirname(fileURLToPath(
  import.meta.url)));
export const WIDTHS = [390, 680, 1024, 1360];
export const scenes = () => fs.readdirSync(path.join(app, "scenes"))
  .filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
// (the site as bin/site.sh assembles it: `site`, or ../_site)
export const siteOf = (arg) => path.resolve(arg ?? path.join(app, "..",
  "_site"));

const TYPES = { ".html": "text/html", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json" };
// the site on a free local port: its embeds' base URL, and a close
export async function serve(site) {
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
  return { base: `http://127.0.0.1:${server.address().port}` +
    "/demos/inspector/", close: () => server.close() };
}

// A page with the scene's embed at `width` (and `hash`: theme=…),
// once ready: its height. (The page stays open: the caller closes it.)
export async function drawn(browser, base, scene, width, o = {}) {
  const page = await browser.newPage({ viewport: { width, height: 800 },
    ...o.context });
  const ready = new Promise((ok) => page.exposeFunction("posted",
    (m) => m?.ready && ok(m.height)));
  await page.addInitScript(() => {
    window.parent.postMessage = (m) => window.posted?.(m);
  });
  await page.goto(`${base}embed.html#scene=${scene}${o.hash ?? ""}`);
  const h = await Promise.race([ready, new Promise((r) =>
    setTimeout(() => r(null), 30_000))]);
  if (h === null) throw new Error(`${scene} at ${width}: no height`);
  return { page, height: h };
}
