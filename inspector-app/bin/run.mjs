// The built site's smoke: what only the site GitHub Pages serves can
// show (bin/site.sh's _site, the app built, served here gzipped), in
// Chromium, Firefox and WebKit. The page's behaviour is the e2e specs'
// (test/e2e/, on the dev server); this checks that the build is that
// page: the loader's sizes are current; a session logs no error or
// warning and requests no other host; every scene and the memory section
// decode; a load that fails shows its error and Retry, which loads it;
// in Chromium, the slow link, and screenshots/desktop-packed.png.
// Usage: npm run check (it builds and runs bin/site.sh first);
// STATIC_PORT: the server's port (default: any free one).
import { chromium, firefox, webkit } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";
import { current as sizesCurrent } from "./sizes.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const demo = path.join(path.dirname(root), "demos", "inspector");
const shot = (name) => path.join(demo, "screenshots", name);
// (the storage inspector's scenes, each its snapshot; another lens's,
// "Raw bytes", has its lens)
const index = JSON.parse(fs.readFileSync(path.join(demo, "fixtures",
  "index.json"), "utf8")).filter((s) => !s.lens);
const scenes = index.map((s) => s.id);
const FIRST = scenes[0];

let failed = 0;
// The loader's file sizes are current (bin/sizes.mjs)
if (!sizesCurrent()) {
  console.log("index.html: file sizes are stale; run node bin/sizes.mjs");
  failed++;
}

// A static server like GitHub Pages: the site, text gzipped
const site = path.join(path.dirname(root), "_site");
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
  const body = zlib.gzipSync(fs.readFileSync(f));
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ??
    "application/octet-stream", "content-encoding": "gzip",
  "content-length": body.length, "cache-control": "max-age=600" });
  res.end(body);
});
await new Promise((r) => server.listen(Number(process.env.STATIC_PORT ?? 0),
  "127.0.0.1", r));
const PAGE = `http://127.0.0.1:${server.address().port}/demos/inspector/`;

// A load that fails shows its error and a Retry button; Retry loads it
// again. `url`: the file that fails (HTTP 503, or a network error) until
// Retry. `pick`: the scene to pick first (its data then fails). `via`:
// the Retry button to click (the bar's, or the one by the error).
async function retryCheck(browser, url,
  { pick, abort, throttle, via = "#loadbar button" } = {}) {
  const out = [];
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 } });
  let broken = true;
  await ctx.route(`**/${url}`, (route) => !broken ? route.continue()
    : abort ? route.abort() : route.fulfill({ status: 503, body: "" }));
  const p = await ctx.newPage();
  if (throttle) await throttle(p);
  p.on("pageerror", (e) => out.push(`pageerror: ${e}`));
  // (the browser reports the failed request itself)
  p.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/
      .test(m.text())) out.push(`console: ${m.text()}`);
  });
  await p.goto(PAGE);
  if (pick) {
    await p.waitForFunction(() => window.results?.done, null,
      { timeout: 60000 });
    await p.locator(`#picker button[data-id="${pick}"]`).click();
  }
  const bar = p.locator("#loadbar.failed");
  await bar.waitFor({ timeout: 60000 });
  const text = (await bar.innerText()).replace(/\s+/g, " ").trim();
  const reason = abort ? "the network request failed" : "HTTP 503";
  if (text !== `Could not load ${url} (${reason}).Retry` ||
    await p.locator("#loadbar button").innerText() !== "Retry") {
    out.push(`error text: ${text}`);
  }
  broken = false;
  await p.locator(via).click();
  await p.waitForFunction((x) => window.results?.done &&
    document.querySelector("#tree li[data-path]") &&
    (!x || document.querySelector(`#picker [aria-checked="true"]`)
      ?.dataset.id === x), pick, { timeout: 60000 });
  if (await p.locator("#loadbar.failed").count()) out.push("still failed");
  if (pick && !(await p.evaluate((x) => x in window.results.decoded,
    pick))) out.push(`${pick} not shown`);
  await ctx.close();
  return out.map((x) => `retry ${url}: ${x}`);
}

// On a slow link (Chromium's "Slow 3G" over CDP: 400 ms latency, 400
// kbit/s): progress shows within 1 s, the first scene is usable, only its
// data has loaded by then (the others come idle-time after), nothing
// moves, and nothing logs an error. Also prints each request with its
// size on the wire and its size.
async function slowLink(browser) {
  const out = [];
  const throttle = async (p) => {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false,
      latency: 400, downloadThroughput: 400 * 1000 / 8,
      uploadThroughput: 400 * 1000 / 8 });
  };
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await throttle(p);
  p.on("pageerror", (e) => out.push(`pageerror: ${e}`));
  p.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) {
      out.push(`console: ${m.text()}`);
    }
  });
  // (each shift, with what moved: its elements, by tag, id and class,
  // and where they were and went; printed with a failure)
  await p.addInitScript(() => {
    window.shifts = 0;
    window.moved = [];
    const name = (n) => !n || !n.tagName ? String(n?.nodeName ?? "?")
      : `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${
        typeof n.className === "string" && n.className
          ? `.${n.className.trim().split(/\s+/).join(".")}` : ""}`;
    const at = (r) => `${Math.round(r.y)}+${Math.round(r.height)}`;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.hadRecentInput) continue;
        window.shifts += e.value;
        window.moved.push(`${e.value.toFixed(4)} at ${Math.round(
          e.startTime)} ms: ${e.sources.map((s) => `${name(s.node)} ${
          at(s.previousRect)} → ${at(s.currentRect)}`).join("; ")}`);
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  // (when the progress first shows: polled in the page, every frame)
  await p.addInitScript(() => {
    const t0 = performance.now();
    const tick = () => {
      const bar = document.querySelector("#loadbar");
      const msg = bar?.querySelector(".msg");
      if (bar && /\d+ KB of \d+ KB/.test(bar.textContent) && msg &&
        getComputedStyle(msg).display !== "none" && msg.offsetHeight) {
        window.progress = performance.now() - t0;
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await p.goto(PAGE, { waitUntil: "commit" });
  await p.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const t = await p.evaluate(() => {
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    const { usable } = window.results;
    return { paint: Math.round(paint?.startTime ?? -1),
      usable: Math.round(usable), progress: Math.round(window.progress),
      fixtures: performance.getEntriesByType("resource")
        .filter((e) => e.startTime < usable &&
          /\/(fixtures|snapshots)\//.test(e.name))
        .map((e) => e.name.split("/inspector/")[1]).sort().join() };
  });
  if (!(t.progress <= 1000)) out.push(`progress shown at ${t.progress} ms`);
  if (!(t.paint <= 1000)) out.push(`first paint at ${t.paint} ms`);
  if (t.fixtures !== ["fixtures/index.json",
    `snapshots/${FIRST}.json`].join()) {
    out.push(`fetched before usable: ${t.fixtures}`);
  }
  // the others, idle-time
  const others = scenes.slice(1);
  await p.waitForFunction((ids) => ids.every((id) => performance
    .getEntriesByType("resource").some((e) =>
      e.name.endsWith(`snapshots/${id}.json`))), others,
  { timeout: 30000 }).catch(() => out.push("no prefetch"));
  await p.waitForFunction(() => window.memResults?.done);
  const shifts = await p.evaluate(() => window.shifts);
  if (shifts > 0.01) {
    out.push(`layout shift ${shifts.toFixed(3)}: ${(await p.evaluate(() =>
      window.moved)).join(" | ")}`);
  }
  // a prefetched scene shows at once
  const t1 = Date.now();
  await p.locator('#picker button[data-id="vyper"]').click();
  await p.waitForFunction(() => "vyper" in window.results.decoded &&
    document.querySelector('#picker [aria-checked="true"]')?.dataset.id ===
    "vyper");
  const pick = Date.now() - t1;
  const rows = await p.evaluate(() => [performance.getEntriesByType(
    "navigation")[0], ...performance.getEntriesByType("resource")]
    .filter((e) => !e.name.startsWith("blob:"))
    .map((e) => [e.name.replace(/^.*\/demos\/inspector\//, "")
      .replace(/^.*\/shared\//, "../../shared/") || "index.html",
      e.encodedBodySize, e.decodedBodySize]));
  const kb = (n) => (n / 1024).toFixed(1).padStart(6);
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  console.log(`  slow link: progress ${t.progress} ms, first paint ${
    t.paint} ms, usable ${t.usable} ms, layout shift ${shifts.toFixed(4)
  }, prefetched pick ${pick} ms`);
  for (const [n, gz, raw] of rows) {
    console.log(`  ${kb(gz)} KB gzip ${kb(raw)} KB  ${n}`);
  }
  console.log(`  ${kb(sum(1))} KB gzip ${kb(sum(2))} KB  total`);
  await ctx.close();
  // a failure on the slow link: Retry loads it
  out.push(...await retryCheck(browser, "snapshots/motd.json",
    { pick: "motd", throttle }));
  return out.map((x) => `slow link: ${x}`);
}

for (const [name, type] of [["chromium", chromium], ["firefox", firefox],
  ["webkit", webkit]]) {
  const browser = await type.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const problems = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (/^https?:$/.test(u.protocol) && u.host !== new URL(PAGE).host) {
      problems.push(`request to ${u.href}`);
    }
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      problems.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e}`));
  await page.goto(PAGE);
  await page.waitForFunction(() => window.results?.done &&
    window.memResults?.done, null, { timeout: 60000 });
  // every scene decodes; the memory section's every pause
  for (const id of scenes) {
    if (!await page.evaluate((x) => window.select(x), id) ||
      !Object.keys(await page.evaluate((x) => window.results.decoded[x],
        id) ?? {}).length) problems.push(`${id}: not decoded`);
  }
  const errors = await page.evaluate(() => [...window.results.errors,
    ...window.memResults.errors]);
  problems.push(...errors);
  if (!Object.keys(await page.evaluate(() => window.memResults.decoded))
    .length) problems.push("memory: not decoded");
  // (the colouring loads: a walkthrough's pointer, and the contract)
  await page.evaluate((x) => window.select(x, { sel: "players" }), FIRST);
  await page.locator('#details button[data-r="start"]').click();
  await page.locator("#ptr .line span[style]").first().waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#contract-box summary").click();
  await page.locator("#contract-src.coloured span").first().waitFor();
  await page.locator("#contract-box summary").click();
  // (no native tooltips)
  const titles = await page.evaluate(() =>
    document.querySelectorAll("[title]").length);
  if (titles) problems.push(`${titles} elements with a title`);
  if (name === "chromium") {
    // the screenshot the demo's README shows: totalScore selected
    await page.evaluate((x) => window.select(x, { sel: "totalScore" }),
      FIRST);
    await page.locator("h1").hover();
    await page.evaluate(() => window.scrollTo(0,
      document.querySelector("#storage").offsetTop - 8));
    await page.evaluate(() => new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: shot("desktop-packed.png") });
  }
  // Loading failures: the decoder bundle (network error) and the first
  // scene's data (HTTP 503)
  problems.push(...await retryCheck(browser, "vendor/pointers.js",
    { abort: true }));
  problems.push(...await retryCheck(browser,
    `snapshots/${FIRST}.json`, { via: "#tree .error button" }));
  if (name === "chromium") problems.push(...await slowLink(browser));
  console.log(`${name} ${browser.version()}: ${problems.length
    ? "FAIL\n  " + problems.join("\n  ") : "ok"}`);
  failed += problems.length;
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
