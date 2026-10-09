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
// (and a phone's figure, its text column inside the page's gutters: an
// iPhone's 390px less 2 × 16px, a 375px one's)
export const PHONES = [343, 358];
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

// A scene's walkthrough panel, in its frame of its own beside its figure's
// (embed-panel.html, as the host lays them out), at `width`: its ready
// height, the tallest at any step; null if it draws none
export async function panelDrawn(browser, base, scene, width) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  await page.goto(`${base}embed.html`);
  const ready = page.evaluate(() => new Promise((ok) =>
    addEventListener("message", (e) => {
      const p = document.getElementById("p");
      if (e.data?.type === "ethdebug:height" && e.data.ready &&
        e.source === p?.contentWindow) ok(e.data.height);
    })));
  await page.evaluate(([b, s]) => {
    document.body.innerHTML = `<iframe id="p" style="display:block;` +
      `width:100%;height:10px;border:0" src="${b}embed-panel.html#scene=` +
      `${s}&channel=h"></iframe><iframe style="display:block;width:100%;` +
      `height:600px;border:0" src="${b}embed.html#scene=${s}` +
      "&panel=external&channel=h\"></iframe>";
    document.body.style.margin = "0";
  }, [base, scene]);
  const h = await Promise.race([ready, new Promise((r) =>
    setTimeout(() => r(null), 15_000))]);
  await page.close();
  return h;
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
