// The page's performance as a reader on a slow phone and a slow link
// gets it: Chromium over CDP (CPU slowdown, network throttling, a phone
// viewport), the built page served gzipped as on GitHub Pages. For each
// profile: the load (bytes per file, cold and warm; first paint, LCP,
// usable, blocking time, layout shift), each interaction's time to the
// next paint (p50/p95), the JS heap and the DOM. Prints a table; exits 1
// when a number is over its budget (BUDGETS below).
//
// Usage: npm run perf [-- options]   (builds first unless --no-build)
//   --profiles low,mid,desktop   which profiles (default: low,mid)
//   --runs N        loads per profile (cold, then warm with the
//                 interactions), the median, the samples pooled (3)
//   --soak S        S seconds of interactions, then the heap again
//   --frames N      also the blog case: N iframes of the page on one page
//   --url URL       measure another page (e.g. the live one) instead
//   --trace DIR     save Chrome traces (load, interactions) in DIR
//   --json FILE     write every number measured to FILE
//   --port P        the static server's port (default 8774)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const demo = path.join(path.dirname(app), "demos", "inspector");
const dist = path.join(app, "dist");

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const PROFILES = opt("profiles", "low,mid").split(",");
const RUNS = Number(opt("runs", "3"));
const SOAK = Number(opt("soak", "0"));
const FRAMES = Number(opt("frames", "0"));
const TRACE = opt("trace", null);
const JSON_OUT = opt("json", null);
const PORT = Number(opt("port", "8774"));

// Low-end: a cheap Android phone on DevTools' "Slow 4G" (its numbers,
// as Lighthouse's mobile run with DevTools throttling; 6x CPU, not 4x:
// this machine is faster than Lighthouse's reference). Mid: a recent
// mid-range phone on DevTools' "Fast 4G". Desktop: no limits.
// (kbps: kilobits per second; latency: ms added to each request)
const PROFILE = {
  low: { cpu: 6, down: 1474.56, up: 675, latency: 562.5,
    viewport: { width: 390, height: 844 }, mobile: true },
  mid: { cpu: 4, down: 8100, up: 1350, latency: 165,
    viewport: { width: 390, height: 844 }, mobile: true },
  desktop: { cpu: 1, down: 0, up: 0, latency: 0,
    viewport: { width: 1280, height: 900 }, mobile: false },
};

// The budgets: a number over its budget fails the run. ms unless named;
// KB after gzip; interaction: each kind's p95 time to the next paint
// (INP's "good" is 200 ms); frames: the blog case, its N frames' heap.
// (proposed 2026-10-08 from the baseline; some fail at that baseline:
// the report says which and why)
const BUDGETS = {
  jsKB: 150, // all the JS of a cold load
  totalKB: 200, // every byte of a cold load
  low: { fcp: 1000, lcp: 2000, usable: 2500, tbt: 300, cls: 0.01,
    interaction: 200, heapMB: 20, framesHeapMB: 35 },
  mid: { fcp: 600, lcp: 1000, usable: 1200, tbt: 150, cls: 0.01,
    interaction: 100, heapMB: 20, framesHeapMB: 35 },
  desktop: { fcp: 300, lcp: 500, usable: 600, tbt: 50, cls: 0.01,
    interaction: 50, heapMB: 20, framesHeapMB: 35 },
};

// ---- the site, as GitHub Pages serves it: gzip, max-age=600 --------
const TYPES = { ".html": "text/html", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".woff2": "font/woff2" };
// the blog case: N iframes of the page, one per scene, on another site
// (127.0.0.1 hosts, localhost frames: two sites, as the blog's)
const SCENES = ["mid", "alice", "motd", "vyper"];
const framesPage = (base, n) => `<!doctype html><meta charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1">
<title>frames</title><body style="margin:0">
${Array.from({ length: n }, (_, i) => `<p>Figure ${i + 1}</p>
<iframe data-src="${base}#ex=${SCENES[i % 4]}"
 style="width:100%;height:900px;border:0"></iframe>`).join("\n")}`;

function serve(port) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    const p = decodeURIComponent(u.pathname);
    if (p === "/perf/frames.html") {
      const n = Number(u.searchParams.get("n") ?? 4);
      const base = `http://localhost:${port}/demos/inspector/`;
      res.writeHead(200, { "content-type": "text/html" });
      return res.end(framesPage(base, n));
    }
    const rel = p.replace(/^\/demos\/inspector\//, "");
    const f = [dist, demo].map((d) => path.join(d, rel))
      .map((x) => x.endsWith("/") || x === dist || x === demo
        ? path.join(x, "index.html") : x)
      .find((x) => p.startsWith("/demos/inspector/") && fs.existsSync(x) &&
        fs.statSync(x).isFile());
    if (!f) {
      res.writeHead(404);
      return res.end();
    }
    const raw = fs.readFileSync(f);
    const type = TYPES[path.extname(f)] ?? "application/octet-stream";
    const zip = /text|json|javascript|svg/.test(type);
    const body = zip ? zlib.gzipSync(raw, { level: 6 }) : raw;
    res.writeHead(200, { "content-type": type, "cache-control":
      "max-age=600", "content-length": body.length,
      ...(zip ? { "content-encoding": "gzip" } : {}) });
    res.end(body);
  });
  return new Promise((r) => server.listen(port, () => r(server)));
}

// ---- in the page: paints, shifts, long tasks, each input's next paint
const INIT = () => {
  const P = (window.__perf = { lcp: 0, cls: 0, long: [], loaf: [],
    events: [], bar: 0, shifts: [] });
  const who = (n) => !n ? "?" : n.id ? `#${n.id}` : n.nodeType !== 1
    ? n.nodeName : `${n.localName}.${[...n.classList].join(".")}`;
  const obs = (type, f) => {
    try {
      new PerformanceObserver((l) => l.getEntries().forEach(f))
        .observe({ type, buffered: true });
    } catch {}
  };
  obs("largest-contentful-paint", (e) => (P.lcp = e.startTime));
  obs("layout-shift", (e) => {
    if (e.hadRecentInput) return;
    P.cls += e.value;
    P.shifts.push({ t: e.startTime, v: e.value, by: e.sources.map((s) =>
      who(s.node) + " " + (s.node?.parentElement ? "in " +
        who(s.node.parentElement) : "")) });
  });
  obs("longtask", (e) => P.long.push([e.startTime, e.duration]));
  obs("long-animation-frame", (e) => P.loaf.push({ start: e.startTime,
    dur: e.duration, block: e.blockingDuration,
    style: e.styleAndLayoutStart ? e.startTime + e.duration -
      e.styleAndLayoutStart : 0,
    scripts: e.scripts.map((s) => ({ inv: s.invoker, dur: s.duration,
      src: (s.sourceURL || "").split("/").pop() + ":" +
        s.sourceCharPosition, layout: s.forcedStyleAndLayoutDuration }))
  }));
  // (each trusted input to the paint after it: an event's time stamp to
  // the task after the next animation frame, as INP counts it)
  let frame = null;
  for (const type of ["pointerover", "pointermove", "pointerdown",
    "pointerup", "click", "keydown"]) {
    window.addEventListener(type, (e) => {
      if (!e.isTrusted) return;
      const rec = { type, ts: e.timeStamp, paint: 0 };
      P.events.push(rec);
      if (!frame) {
        frame = [];
        requestAnimationFrame(() => {
          const ch = new MessageChannel();
          const these = frame;
          frame = null;
          ch.port1.onmessage = () => {
            const t = performance.now();
            for (const r of these) r.paint = t;
          };
          ch.port2.postMessage(0);
        });
      }
      frame.push(rec);
    }, true);
  }
  // (when the loading bar goes: the page is done loading)
  const watch = () => {
    const bar = document.getElementById("loadbar");
    if (!bar) return setTimeout(watch, 5);
    new MutationObserver(() => {
      if (bar.hidden && !P.bar) P.bar = performance.now();
    }).observe(bar, { attributes: true });
  };
  watch();
};

const median = (xs) => pct(xs, 50);
function pct(xs, p) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

async function throttle(page, pr) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false,
    latency: pr.latency, downloadThroughput: pr.down ? pr.down * 125 : -1,
    uploadThroughput: pr.up ? pr.up * 125 : -1 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: pr.cpu });
  return cdp;
}

// every response's bytes: on the wire (transfer) and after gzip (parsed)
function network(cdp) {
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId,
    { url: e.response.url, type: e.type, wire: 0, body: 0,
      cached: e.response.fromDiskCache || e.response.fromMemoryCache ||
        false, status: e.response.status }));
  cdp.on("Network.requestServedFromCache", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.cached = true;
  });
  cdp.on("Network.dataReceived", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.body += e.dataLength;
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.wire = e.encodedDataLength;
  });
  return () => [...reqs.values()];
}

const kind = (url) => /pointers\.js/.test(url) ? "pointers"
  : /\.js(\?|$)/.test(url) ? "js" : /\.css/.test(url) ? "css"
  : /\.json/.test(url) ? "json" : /\.(woff2?|ttf|otf)/.test(url) ? "font"
  : /\.html|\/(#.*)?$/.test(url) ? "html" : "other";

async function heap(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  const h = await cdp.send("Runtime.getHeapUsage");
  const d = await cdp.send("Memory.getDOMCounters");
  return { heapMB: h.usedSize / 2 ** 20, nodes: d.nodes,
    listeners: d.jsEventListeners, documents: d.documents };
}

const usable = (page) => page.waitForFunction(() => window.results?.done &&
  window.__perf.bar, null, { timeout: 120_000, polling: 50 });

// One load: its paints, its blocking time, its bytes
async function load(ctx, url, pr, tracePath) {
  const page = await ctx.newPage();
  const cdp = await throttle(page, pr);
  const reqs = network(cdp);
  if (tracePath) await ctx.browser().startTracing(page,
    { path: tracePath, screenshots: true });
  await page.goto(url);
  await usable(page);
  await page.waitForTimeout(300);
  if (tracePath) await ctx.browser().stopTracing();
  const m = await page.evaluate(() => {
    const P = window.__perf;
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]
      ?.startTime ?? 0;
    const end = Math.max(window.results.usable, P.bar);
    const long = P.long.filter(([s]) => s < end);
    return { fcp, lcp: P.lcp, cls: P.cls, shifts: P.shifts,
      loaf: P.loaf.filter((l) => l.start < end), ready: window.results.usable,
      bar: P.bar, usable: end, errors: window.results.errors,
      tbt: long.filter(([s]) => s >= fcp).reduce((n, [, d]) =>
        n + Math.max(0, d - 50), 0),
      longTasks: long.length,
      worstTask: Math.max(0, ...long.map(([, d]) => d)) };
  });
  return { page, cdp, m, reqs: reqs() };
}

// (a file fetched by the loader and then run comes from the cache: its
// bytes once)
function bytes(reqs) {
  const by = {};
  const seen = new Set();
  for (const r of reqs) {
    if (r.cached && seen.has(r.url)) continue;
    seen.add(r.url);
    const k = kind(r.url);
    by[k] ??= { wire: 0, body: 0, n: 0 };
    by[k].wire += r.wire;
    by[k].body += r.body;
    by[k].n += 1;
  }
  const all = Object.values(by).reduce((a, b) => ({ wire: a.wire + b.wire,
    body: a.body + b.body, n: a.n + b.n }), { wire: 0, body: 0, n: 0 });
  return { by, all };
}

// ---- the interactions: each sample one input, to its next paint ----
const settle = (page) => page.evaluate(() => new Promise((r) =>
  requestAnimationFrame(() => setTimeout(r, 30))));
const mark = (page) => page.evaluate(() => [window.__perf.events.length,
  performance.now()]);
// the samples since `at`: each input's latency to its next paint (an
// interaction: its slowest input); the long tasks from `t0`
async function since(page, [at, t0]) {
  await settle(page);
  return page.evaluate(([at, t0]) => {
    const P = window.__perf;
    const ev = P.events.slice(at).filter((e) => e.paint);
    return { lat: Math.max(0, ...ev.map((e) => e.paint - e.ts)),
      long: P.long.filter(([s]) => s >= t0).map(([, d]) => d) };
  }, [at, t0]);
}
async function sample(page, out, name, act) {
  const m = await mark(page);
  await act();
  const s = await since(page, m);
  (out[name] ??= { lat: [], long: [] }).lat.push(s.lat);
  out[name].long.push(...s.long);
}
const center = (page, sel) => page.evaluate((sel) => {
  const r = document.querySelector(sel)?.getBoundingClientRect();
  return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}, sel);
const show = (page, sel) => page.evaluate((sel) =>
  document.querySelector(sel)?.scrollIntoView({ block: "start" }), sel);
async function clickOn(page, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const c = await center(page, sel);
  if (c) await page.mouse.click(c.x, c.y);
}
// (a click on the selected row ends the selection: a second selects it)
async function selectRow(page, p) {
  for (let i = 0; i < 2; i++) {
    if (await page.locator(row(p)).evaluate((e) =>
      e.classList.contains("sel"))) return;
    await clickOn(page, row(p));
  }
}
const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const row = (p) => `#tree li[data-path="${p}"] > .row`;
const START = '#details button[data-r="start"]';
const NEXT = '#details button[data-r="next"]';
const EXIT = '#details button[data-r="exit"]';
// (ends a walkthrough, if one is on)
async function exitWalk(page) {
  for (let i = 0; i < 3 && await page.locator(EXIT).count(); i++) {
    await page.evaluate((s) => document.querySelector(s)?.click(), EXIT);
    await settle(page);
  }
}

async function interact(page, out) {
  const on = (name, act) => sample(page, out, name, act);
  await exitWalk(page);
  // a hover sweep over the dump's bytes, row by row
  await show(page, "#panel");
  const bytes = await page.evaluate(() => [...document.querySelectorAll(
    "#panel .view:not([hidden]) .wrow .word .b")].map((b) =>
    b.getBoundingClientRect()).filter((r) => r.top > 0 &&
    r.bottom < innerHeight && r.width > 0).slice(0, 96).map((r) =>
    ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })));
  for (const b of bytes) await on("hover dump", () =>
    page.mouse.move(b.x, b.y));
  // a hover over each tree row in view
  await show(page, "#tree");
  const rows = await page.evaluate(() => [...document.querySelectorAll(
    "#tree li[data-path] > .row")].map((r) => r.getBoundingClientRect())
    .filter((r) => r.top > 0 && r.bottom < innerHeight && r.width > 0)
    .map((r) => ({ x: r.left + 20, y: r.top + r.height / 2 })));
  for (const r of rows) await on("hover tree", () =>
    page.mouse.move(r.x, r.y));
  // select a leaf, a record, the mapping
  for (let i = 0; i < 3; i++) {
    for (const p of [`${A}.score`, A, "players"]) {
      await on("select", () => clickOn(page, row(p)));
    }
  }
  // a walkthrough: start it, ten steps; then two more starts
  for (const p of [["players", 10], [`${A}.name`, 0], ["roster[1]", 0]]) {
    await selectRow(page, p[0]);
    await exitWalk(page);
    await page.mouse.move(1, 1);
    if (!(await page.locator(START).count())) continue;
    await on("walk start", () => clickOn(page, START));
    for (let k = 0; k < p[1]; k++) {
      if (await page.locator(NEXT).isDisabled().catch(() => true)) break;
      await on("walk step", () => clickOn(page, NEXT));
    }
    await exitWalk(page);
  }
  // the scenes, twice round
  for (let i = 0; i < 2; i++) {
    for (const s of ["alice", "motd", "vyper", "mid"]) {
      await on("scene", () => clickOn(page,
        `#picker button[data-id="${s}"]`));
      await page.waitForFunction(() => !window.loading.busy());
    }
  }
  // All | Related, with a selection
  await selectRow(page, `${A}.score`);
  for (let i = 0; i < 4; i++) {
    await on("related", () => clickOn(page,
      '#related button[data-rows="related"]'));
    await on("related", () => clickOn(page,
      '#related button[data-rows="all"]'));
  }
  // the memory section: the levels, the pause points, its rows
  await show(page, "#memory");
  for (let i = 0; i < 2; i++) {
    for (const s of ['#mlevel button[data-opt="2"]',
      '#mpoint button[data-id="mult"]', '#mpoint button[data-id="writes"]',
      '#mlevel button[data-opt="0"]', '#mpoint button[data-id="roll"]']) {
      await on("memory", () => clickOn(page, s));
    }
  }
  const mrows = await page.locator("#mtree li[data-path] > .row").count();
  for (let i = 0; i < mrows; i++) {
    await on("memory", () => clickOn(page,
      `#mtree li[data-path]:nth-child(${i + 1}) > .row`));
  }
  await page.mouse.move(1, 1);
}

// ---- the blog case: the frames added one after another --------------
async function frames(browser, base, pr, n) {
  const ctx = await browser.newContext({ viewport: pr.viewport,
    isMobile: pr.mobile, hasTouch: pr.mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const cdp = await throttle(page, pr);
  const reqs = network(cdp);
  const host = base.replace("localhost", "127.0.0.1")
    .replace(/demos\/inspector\/$/, "perf/frames.html");
  await page.goto(`${host}?n=${n}`);
  const out = [];
  for (let i = 0; i < n; i++) {
    const before = reqs().length;
    const t0 = Date.now();
    // (scrolled to, as a reader does: a frame out of view gets no
    // animation frames, and the page waits for one to draw)
    await page.evaluate((i) => {
      const f = document.querySelectorAll("iframe")[i];
      f.scrollIntoView();
      f.src = f.dataset.src;
    }, i);
    const frame = await (async () => {
      for (;;) {
        const f = page.frames().filter((f) => f !== page.mainFrame())[i];
        if (f && f.url().startsWith("http")) return f;
        await page.waitForTimeout(20);
      }
    })();
    await frame.waitForFunction(() => window.results?.done &&
      document.getElementById("loadbar")?.hidden, null,
    { timeout: 120_000, polling: 50 });
    const ms = Date.now() - t0;
    await page.waitForTimeout(300);
    const b = bytes(reqs().slice(before));
    out.push({ frame: i + 1, ms, wireKB: b.all.wire / 1024,
      requests: b.all.n, cached: reqs().slice(before)
        .filter((r) => r.cached).length, ...(await heap(cdp)) });
  }
  await ctx.close();
  return out;
}

// ---- the run ----------------------------------------------------------
const remote = opt("url", null);
let server;
if (!remote) {
  if (!flag("no-build")) {
    execFileSync("npm", ["run", "build"], { cwd: app, stdio: "ignore" });
  }
  server = await serve(PORT);
}
const base = remote ?? `http://localhost:${PORT}/demos/inspector/`;
const browser = await chromium.launch({ args: [
  // (a phone keeps a page and its frames in one process)
  "--disable-features=IsolateOrigins,site-per-process"] });
if (TRACE) fs.mkdirSync(TRACE, { recursive: true });

const results = {};
const fails = [];
const over = (name, v, max) => {
  if (v > max) fails.push(`${name}: ${fmt(v)} > ${max}`);
  return v > max ? `${fmt(v)}!` : fmt(v);
};
const fmt = (v) => Number.isInteger(v) ? String(v)
  : Math.abs(v) < 1 ? v.toFixed(3) : v.toFixed(0);

for (const name of PROFILES) {
  const pr = PROFILE[name];
  const ctxOpts = { viewport: pr.viewport, isMobile: pr.mobile,
    hasTouch: false, deviceScaleFactor: pr.mobile ? 3 : 1,
    reducedMotion: "no-preference" };
  const loads = [];
  const warms = [], inter = {}, mem = {};
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(INIT);
    const cold = await load(ctx, base, pr, TRACE && i === 0
      ? path.join(TRACE, `${name}-load.json`) : null);
    loads.push({ ...cold.m, bytes: bytes(cold.reqs), reqs: cold.reqs });
    // warm: the same page again, from the cache; then the interactions
    // (each run's samples pooled), on it
    if (i === 0) {
      mem.load = await heap(cold.cdp);
      mem.domElements = await cold.page.evaluate(() =>
        document.getElementsByTagName("*").length);
    }
    await cold.page.close();
    const w = await load(ctx, base, pr, null);
    warms.push({ ...w.m, bytes: bytes(w.reqs) });
    const traced = TRACE && i === 0;
    if (traced) await browser.startTracing(w.page, { path: path.join(
      TRACE, `${name}-interact.json`), screenshots: false,
    categories: ["devtools.timeline", "disabled-by-default-devtools." +
      "timeline", "disabled-by-default-devtools.timeline.stack",
    "v8.execute", "blink.user_timing", "loading", "latencyInfo"] });
    await interact(w.page, inter);
    if (traced) await browser.stopTracing();
    if (i === 0) {
      mem.interact = await heap(w.cdp);
      if (SOAK) {
        const end = Date.now() + SOAK * 1000;
        while (Date.now() < end) await interact(w.page, {});
        mem.soak = await heap(w.cdp);
      }
    }
    await ctx.close();
  }
  const med = (k) => median(loads.map((l) => l[k]));
  const warm = Object.fromEntries(["fcp", "lcp", "usable", "tbt"].map((k) =>
    [k, median(warms.map((l) => l[k]))]));
  warm.wireKB = median(warms.map((l) => l.bytes.all.wire)) / 1024;
  const by = (k, f) => median(loads.map((l) => l.bytes.by[k]?.[f] ?? 0));
  const jsKB = (by("js", "wire") + by("pointers", "wire")) / 1024;
  const allKB = median(loads.map((l) => l.bytes.all.wire)) / 1024;
  results[name] = { profile: pr, loads, warms, interactions: inter,
    memory: mem, budgets: BUDGETS[name] };
  const B = BUDGETS[name];
  const L = (s) => `${name.padEnd(8)}${s}`;
  console.log(`\n== ${name}: ${pr.cpu}x CPU, ` + (pr.down
    ? `${(pr.down / 1000).toFixed(1)} Mbps down, ${pr.latency} ms latency`
    : "no network limit") +
    `, ${pr.viewport.width}x${pr.viewport.height} (median of ${RUNS})`);
  console.log(L("load     FCP " + over(`${name} FCP`, med("fcp"), B.fcp) +
    "  LCP " + over(`${name} LCP`, med("lcp"), B.lcp) +
    "  usable " + over(`${name} usable`, med("usable"), B.usable) +
    "  TBT " + over(`${name} TBT`, med("tbt"), B.tbt) +
    "  long tasks " + fmt(med("longTasks")) +
    " (worst " + fmt(med("worstTask")) + ")" +
    "  CLS " + over(`${name} CLS`, med("cls"), B.cls)));
  console.log(L(`warm     FCP ${fmt(warm.fcp)}  LCP ${fmt(warm.lcp)}  ` +
    `usable ${fmt(warm.usable)}  TBT ${fmt(warm.tbt)}  ` +
    `wire ${fmt(warm.wireKB)} KB`));
  console.log(L("bytes    " + Object.entries(loads[0].bytes.by)
    .map(([k, v]) => `${k} ${fmt(v.wire / 1024)}/${fmt(v.body / 1024)}`)
    .join("  ") + "  KB (gzip/parsed)"));
  if (name === PROFILES[0]) {
    console.log(L("total    JS " + over("JS gzip KB", jsKB, BUDGETS.jsKB) +
      " KB gz  all " + over("total gzip KB", allKB, BUDGETS.totalKB) +
      " KB gz"));
  }
  console.log(L("action          n   p50   p95   max  long tasks (worst)"));
  for (const [k, v] of Object.entries(inter)) {
    const p95 = pct(v.lat, 95);
    console.log(L(`${k.padEnd(13)}${String(v.lat.length).padStart(3)}` +
      `${fmt(pct(v.lat, 50)).padStart(6)}` +
      `${over(`${name} ${k} p95`, p95, B.interaction).padStart(6)}` +
      `${fmt(Math.max(...v.lat)).padStart(6)}  ${v.long.length}` +
      ` (${fmt(Math.max(0, ...v.long))})`));
  }
  console.log(L(`memory   heap ${over(`${name} heap MB`,
    mem.interact.heapMB, B.heapMB)} MB after use (` +
    `${mem.load.heapMB.toFixed(1)} after load` +
    (mem.soak ? `, ${mem.soak.heapMB.toFixed(1)} after ${SOAK} s, ` +
      `${mem.soak.nodes} nodes, ${mem.soak.listeners} listeners` : "") +
    `); DOM ${mem.domElements} elements, ${mem.interact.nodes} nodes, ` +
    `${mem.interact.listeners} listeners`));
  if (FRAMES) {
    const f = await frames(browser, base, pr, FRAMES);
    results[name].frames = f;
    over(`${name} ${FRAMES} frames' heap MB`, f.at(-1).heapMB,
      B.framesHeapMB);
    for (const x of f) {
      console.log(L(`frame ${x.frame}  usable in ${x.ms} ms, ` +
        `${fmt(x.wireKB)} KB over the wire (${x.requests} requests, ` +
        `${x.cached} cached); heap ${x.heapMB.toFixed(1)} MB, ` +
        `${x.nodes} nodes`));
    }
  }
}

await browser.close();
server?.close();
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 1));
if (fails.length) {
  console.log(`\nover budget:\n  ${fails.join("\n  ")}`);
  process.exit(1);
}
console.log("\nall within budget");
