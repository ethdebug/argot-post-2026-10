// Opens the page in Chromium, Firefox and WebKit (Playwright), checks the
// decoded values against what the transactions wrote, and takes
// screenshots. Usage: node bin/run.mjs
import { chromium, firefox, webkit, devices } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import zlib from "node:zlib";
import { current as sizesCurrent } from "./sizes.mjs";

const PAGE = process.env.PAGE ?? "http://localhost:8000/demos/inspector/";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shot = (name) => path.join(root, "screenshots", name);

// alice, bob and carol: anvil's accounts 1, 2 and 3
const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const B = "players[0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc]";
const C = "players[0x90f79bf6eb2c4f870365e785982e1f101e93b906]";
const MOTD = ["season 2 starts friday, see you on the leaderboard", "gl hf"];
// [path, before, after] for each scene, from the story in
// bin/make-fixtures.mjs. A scene with one point shows the same state on
// both sides.
const same2 = (rows) => rows.map(([p, v]) => [p, v, v]);
const NAME_C = "carol, the unstoppable combo queen";
const player = (p, [score, combo, best, plays, hc], name) => [
  [`${p}.score`, score], [`${p}.combo`, combo], [`${p}.bestCombo`, best],
  [`${p}.plays`, plays], [`${p}.hitCount`, hc], [`${p}.name`, name]];
// the middle of the game
const mid = [
  ...player(A, ["30", "2", "2", "2", "2"], '"alice"'),
  ...player(B, ["10", "1", "1", "1", "1"], '"bob"'),
  ...player(C, ["0", "0", "0", "1", "0"], `"${NAME_C}"`),
  ["roster", "length 3"],
  ["roster[0]", "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"],
  ["roster[2]", "0x90f79bf6eb2c4f870365e785982e1f101e93b906"],
  ["motd", `"${MOTD[0]}"`], ["total", "40"], ["rounds", "3"],
];
const expected = {
  mid: same2(mid),
  alice: [
    [`${A}.score`, "30", "60"],
    [`${A}.combo`, "2", "3"],
    [`${A}.bestCombo`, "2", "3"],
    [`${A}.plays`, "2", "3"],
    [`${A}.hitCount`, "2", "3"],
    [`${A}.name`, '"alice"', '"alice"'],
    [`${B}.score`, "10", "10"],
    ["total", "40", "70"],
    ["rounds", "3", "4"],
  ],
  motd: [
    ["motd", `"${MOTD[0]}"`, `"${MOTD[1]}"`],
    [`${A}.score`, "60", "60"],
    [`${C}.name`, `"${NAME_C}"`, `"${NAME_C}"`],
    ["total", "70", "70"],
    ["rounds", "4", "4"],
  ],
  // Solidity's rule, applied to the Vyper contract's storage
  vyper: same2([A, B, C].flatMap((p) => [[`${p}.score`, "0"],
    [`${p}.combo`, "0"], [`${p}.name`, '""']])),
};
// Each scene's defaults: the mode shown and the variable selected
const defaults = {
  mid: ["after", A],
  alice: ["after", A],
  motd: ["after", "motd"],
  vyper: ["after", `${A}.score`],
};

// The same keys and values, in any order
const same = (a, b) => {
  const sort = (o) => typeof o !== "object" ? o : Object.fromEntries(
    Object.keys(o).sort().map((k) => [k, sort(o[k])]));
  return JSON.stringify(sort(a)) === JSON.stringify(sort(b));
};

let failed = 0;
// The base slots come from the program context: no fixture has
// storageLayout (by name, or as a contract's `layout`)
for (const file of fs.readdirSync(path.join(root, "fixtures"))) {
  const text = fs.readFileSync(path.join(root, "fixtures", file), "utf8");
  if (text.includes("storageLayout") ||
    JSON.parse(text).contract?.layout !== undefined) {
    console.log(`fixtures/${file} has storageLayout`);
    failed++;
  }
}
// The loader's file sizes are current (bin/sizes.mjs), and the picker
// in index.html has the scenes of fixtures/index.json, each with its
// fixture, whether it has one point, and an intro
if (!sizesCurrent()) {
  console.log("index.html: file sizes are stale; run node bin/sizes.mjs");
  failed++;
}
{
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const picker = html.match(/<div id="picker"[^>]*>([\s\S]*?)<\/div>/)[1];
  const got = [...picker.matchAll(/<button([^>]*)>([^<]+)</g)]
    .map(([, a, t]) => `${a.match(/data-id="([^"]+)"/)?.[1]} ${
      a.match(/data-fixture="([^"]+)"/)?.[1]} ${/data-single/.test(a)
      ? 1 : 2} ${t.replace(/\s+/g, " ")}`).join("\n");
  const scenes = JSON.parse(fs.readFileSync(path.join(root, "fixtures",
    "index.json"), "utf8"));
  const want = scenes.map((x) => `${x.id} ${x.fixture} ${x.points.length
  } ${x.title}`).join("\n");
  const intros = [...html.matchAll(/<p data-scene="([^"]+)" hidden>/g)]
    .map((m) => m[1]).join();
  if (intros !== scenes.map((x) => x.id).join()) {
    console.log(`index.html intros differ: ${intros}`);
    failed++;
  }
  if (Object.keys(expected).join() !== scenes.map((x) => x.id).join()) {
    console.log("bin/run.mjs: expected values differ from the scenes");
    failed++;
  }
  if (got !== want) {
    console.log(`index.html picker differs from fixtures/index.json:\n${
      got}`);
    failed++;
  }
}
// The contract at the top of the page is contracts/Arcade.sol
{
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const pre = html.match(/<pre id="contract-src" class="src">([\s\S]*?)<\/pre>/)
    ?.[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  if (pre !== fs.readFileSync(path.join(root, "contracts", "Arcade.sol"),
    "utf8")) {
    console.log("index.html: the contract differs from contracts/Arcade.sol");
    failed++;
  }
}
// No native tooltips: no title attribute in the page's markup or code
for (const f of ["index.html", "main.js", "panel.js", "mem.js",
  "calldata.js"]) {
  if (/\stitle="/.test(fs.readFileSync(path.join(root, f), "utf8"))) {
    console.log(`${f} sets a title attribute`);
    failed++;
  }
}
// No local paths in what is published
{
  const home = "/" + "Users/";
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
    .flatMap((e) => e.name.startsWith(".") || ["node_modules",
      "screenshots"].includes(e.name) ? [] : e.isDirectory()
      ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walk(root)) {
    if (fs.readFileSync(f, "utf8").includes(home)) {
      console.log(`${path.relative(root, f)} has a local path`);
      failed++;
    }
  }
}

// A static server like GitHub Pages: the repo's public root, text
// gzipped. For the slow-link check.
const site = path.dirname(path.dirname(root));
const TYPES = { ".html": "text/html", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  let f = path.join(site, decodeURIComponent(new URL(req.url,
    "http://x").pathname));
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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const SLOW = `http://127.0.0.1:${server.address().port}/demos/inspector/`;

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
  await p.goto(pick ? SLOW : PAGE);
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
// kbit/s), from the gzipping server: progress shows within 1 s, the
// first scene is usable, only its data has loaded by then (the others
// come idle-time after), nothing moves, and nothing logs an error. Also
// prints each request with its size on the wire and its size.
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
  await p.addInitScript(() => {
    window.shifts = 0;
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.hadRecentInput) window.shifts += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const t0 = Date.now();
  await p.goto(SLOW, { waitUntil: "commit" });
  let progress;
  while (Date.now() - t0 < 5000) {
    const t = await p.locator("#loadbar").innerText().catch(() => "");
    if (/\d+ KB of \d+ KB/.test(t) &&
      await p.locator("#loadbar .msg").isVisible()) {
      progress = Date.now() - t0;
      break;
    }
    await p.waitForTimeout(25);
  }
  await p.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const t = await p.evaluate(() => {
    const paint = performance.getEntriesByName("first-contentful-paint")[0];
    const { usable } = window.results;
    return { paint: Math.round(paint?.startTime ?? -1),
      usable: Math.round(usable),
      fixtures: performance.getEntriesByType("resource")
        .filter((e) => e.startTime < usable &&
          e.name.includes("/fixtures/"))
        .map((e) => e.name.split("/fixtures/")[1]).sort().join() };
  });
  if (!(progress <= 1000)) out.push(`progress shown at ${progress} ms`);
  if (!(t.paint <= 1000)) out.push(`first paint at ${t.paint} ms`);
  if (t.fixtures !== "arcade-mid.json,index.json,memory.json") {
    out.push(`fetched before usable: ${t.fixtures}`);
  }
  // the others, idle-time
  await p.waitForFunction(() => ["arcade-alice", "arcade-motd", "arcade-vyper"]
    .every((id) => performance.getEntriesByType("resource").some((e) =>
      e.name.endsWith(`fixtures/${id}.json`))),
  null, { timeout: 30000 }).catch(() => out.push("no prefetch"));
  await p.waitForFunction(() => window.memResults?.done);
  const shifts = await p.evaluate(() => window.shifts);
  if (shifts > 0.01) out.push(`layout shift ${shifts.toFixed(3)}`);
  // a prefetched scene shows at once
  const t1 = Date.now();
  await p.locator('#picker button[data-id="vyper"]').click();
  await p.waitForFunction(() => "vyper" in window.results.decoded &&
    document.querySelector('#picker [aria-checked="true"]')?.dataset.id ===
    "vyper" && !document.querySelector('#tree li[data-path="roster"]'));
  const pick = Date.now() - t1;
  const rows = await p.evaluate(() => [performance.getEntriesByType(
    "navigation")[0], ...performance.getEntriesByType("resource")]
    .filter((e) => !e.name.startsWith("blob:"))
    .map((e) => [e.name.replace(/^.*\/demos\/inspector\//, "")
      .replace(/^.*\/shared\//, "../../shared/") || "index.html",
      e.encodedBodySize, e.decodedBodySize]));
  const kb = (n) => (n / 1024).toFixed(1).padStart(6);
  const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
  console.log(`  slow link: progress ${progress} ms, first paint ${
    t.paint} ms, usable ${t.usable} ms, layout shift ${shifts.toFixed(4)
  }, prefetched pick ${pick} ms`);
  for (const [n, gz, raw] of rows) {
    console.log(`  ${kb(gz)} KB gzip ${kb(raw)} KB  ${n}`);
  }
  console.log(`  ${kb(sum(1))} KB gzip ${kb(sum(2))} KB  total`);
  await ctx.close();
  // a failure on the slow link: Retry loads it
  out.push(...await retryCheck(browser, "fixtures/arcade-motd.json",
    { pick: "motd", throttle }));
  return out.map((x) => `slow link: ${x}`);
}

for (const [name, type] of [["chromium", chromium], ["firefox", firefox],
  ["webkit", webkit]]) {
  const browser = await type.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  // (no smooth scrolling in the checks: a replay's entry scrolls at once)
  await page.emulateMedia({ reducedMotion: "reduce" });
  const logs = [];
  const foreign = [];
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    // (the loader imports the decoder bundle it fetched from a blob: URL)
    if (u.protocol !== "blob:" && u.host !== new URL(PAGE).host) {
      foreign.push(u.href);
      return route.abort();
    }
    return route.continue();
  });
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") {
      logs.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
  const problems = [];
  await page.goto(PAGE);
  await page.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  // The contract's source is collapsed by default, and opens on a click
  // (or Enter on its summary); the page remembers it
  {
    const box = page.locator("#contract-box");
    const st = () => box.evaluate((b) => [b.open,
      // the source shows: the box is taller than its summary line
      b.offsetHeight > b.querySelector("summary").offsetHeight + 40,
      b.querySelector("summary").textContent.replace(/\s+/g, " ").trim()]);
    let [open, seen, text] = await st();
    if (open || seen || !/^Arcade\.sol — the contract \(\d+ lines\)$/
      .test(text)) problems.push(`source at rest: ${open} ${seen} ${text}`);
    if (await page.locator("#contract-src span[style]").count()) {
      problems.push("source: coloured before it opened");
    }
    await box.locator("summary").click();
    [open, seen] = await st();
    if (!open || !seen) problems.push("source: a click did not open it");
    // then it is coloured (Shiki, loaded now), with the same text
    await page.waitForSelector("#contract-src.coloured span", { timeout:
      30000 }).catch(() => problems.push("source: not coloured"));
    const col = await page.evaluate(() => {
      const p = document.querySelector("#contract-src");
      return [p.textContent.trim(), new Set([...p.querySelectorAll(
        "span[style]")].map((s) => getComputedStyle(s).color)).size];
    });
    if (col[0] !== fs.readFileSync(path.join(root, "contracts",
      "Arcade.sol"), "utf8").trim() || col[1] < 3) {
      problems.push(`source colouring: ${col[1]} colours`);
    }
    // (once its idle-time fetches are done: WebKit reports a fetch cut
    // off by a reload as a page error)
    await page.waitForFunction(() => !window.loading?.busy(), null,
      { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !window.loading?.busy(), null,
      { timeout: 30000 }).catch(() => {});
    await page.reload();
    await page.waitForFunction(() => window.results?.done, null,
      { timeout: 60000 });
    [open] = await st();
    if (!open) problems.push("source: open not remembered");
    await box.locator("summary").focus();
    await page.keyboard.press("Enter");
    [open] = await st();
    if (open) problems.push("source: Enter did not close it");
    // (once its idle-time fetches are done: WebKit reports a fetch cut
    // off by a reload as a page error)
    await page.waitForFunction(() => !window.loading?.busy(), null,
      { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => !window.loading?.busy(), null,
      { timeout: 30000 }).catch(() => {});
    await page.reload();
    await page.waitForFunction(() => window.results?.done, null,
      { timeout: 60000 });
  }
  // the first scene opens with its defaults: nothing selected, one
  // point (no Before | After, no "show other state", no change marks)
  const atRest = await page.evaluate(() => ({
    scene: document.querySelector('#picker [aria-checked="true"]')
      ?.dataset.id,
    sel: document.querySelectorAll("#tree .row.sel").length,
    intro: [...document.querySelectorAll("#intros [data-scene]")]
      .filter((p) => !p.hidden).map((p) => p.dataset.scene).join(),
    controls: ["#mode", "#insets", "#mode-l"].map((q) =>
      document.querySelector(q).offsetParent !== null).join(),
    marks: document.querySelectorAll("#tree li.chg, #tree li.same, " +
      "#tree .val.chg, #tree .val.same, #panel .b.chg, #panel .wrow.same")
      .length,
  }));
  if (!same(atRest, { scene: "mid", sel: 1, intro: "mid",
    controls: "false,false,false", marks: 0 })) {
    problems.push(`first scene: ${JSON.stringify(atRest)}`);
  }
  // each scene's data loads when it is picked, and the scene comes with
  // its defaults
  for (const [id, [m, sel]] of Object.entries(defaults)) {
    await page.locator(`#picker button[data-id="${id}"]`).click();
    await page.waitForFunction((x) => x in window.results.decoded &&
      document.querySelector("#tree li[data-path]"), id);
    const got = await page.evaluate(() => [
      document.querySelector('#mode [aria-checked="true"]')?.dataset.mode,
      document.querySelector("#tree .row.sel")?.parentElement.dataset.path,
      [...document.querySelectorAll("#intros [data-scene]")]
        .filter((p) => !p.hidden).map((p) => p.dataset.scene).join()]);
    if (got[0] !== m || got[1] !== sel || got[2] !== id) {
      problems.push(`${id} defaults: ${got}`);
    }
  }
  const r = await page.evaluate(() => window.results);
  problems.push(...r.errors);
  for (const [id, rows] of Object.entries(expected)) {
    for (const [p, b, a] of rows) {
      const got = r.decoded[id]?.[p];
      if (!got || got.before !== b || got.after !== a) {
        problems.push(`${id} ${p}: want ${b} -> ${a}, got ` +
          JSON.stringify(got));
      }
    }
  }
  // show a scene with nothing selected
  const scene = (id) => page.evaluate((x) => window.select(x, { sel: null }),
    id);

  // The words panel: hovering a value lights its bytes, counted from
  // the most significant byte, as the template's offset and length say
  await scene("alice");
  const lit = () => page.evaluate(() => {
    const out = {};
    for (const c of document.querySelectorAll("#panel .b.hl:not(.cmp *)")) {
      const w = c.closest(".word");
      const k = `${w.dataset.side} ${w.dataset.slot}`;
      (out[k] ??= []).push(+c.dataset.i);
    }
    return out;
  });
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  // the details block under a dump, as { term: text }; and whether it
  // scrolls inside (it must not)
  const dl = (q = "#dtext") => page.evaluate((x) => {
    const el = document.querySelector(x);
    const out = {};
    const dts = el.querySelectorAll("dt");
    for (const dt of dts) {
      out[dt.textContent] = dt.nextElementSibling.textContent;
    }
    if (!dts.length) out.text = el.textContent.trim();
    out.scrolls = el.scrollHeight > el.clientHeight + 1 ||
      el.scrollWidth > el.clientWidth + 1;
    return out;
  }, q);
  const setMode = (m) => page.locator(`#mode button[data-mode="${m}"]`)
    .click();
  const want = async (what, path, bytes, words) => {
    await page.locator(`#tree li[data-path="${path}"] > .row`).hover();
    const got = await lit();
    const keys = Object.keys(got);
    if (keys.length !== words ||
      keys.some((k) => got[k].join() !== bytes.join())) {
      problems.push(`${what}: lit ${JSON.stringify(got)}`);
    }
  };
  // Player packs six counters into one full word, from the low end:
  // score (8 bytes), combo, bestCombo, plays, hitCount (4 each),
  // lastBlock (8); before and after
  await want("score", `${A}.score`, range(24, 31), 2);
  await want("combo", `${A}.combo`, range(20, 23), 2);
  await want("hitCount", `${A}.hitCount`, range(8, 11), 2);
  await want("lastBlock", `${A}.lastBlock`, range(0, 7), 2);
  // Clicking a byte selects the variable that owns it (selection lives
  // on the tree row)
  const pickByte = async (owner, i) => {
    await page.locator(`#panel .word[data-side="after"] ` +
      `.b[data-owners="${owner}"][data-i="${i}"]`).click();
    await page.locator("h1").hover();
  };
  const selected = () => page.evaluate(() =>
    [...document.querySelectorAll("#tree .row.sel")].map((r) =>
      r.parentElement.dataset.path));
  await pickByte(`${A}.plays`, 13);
  let sel = await selected();
  if (sel.join() !== `${A}.plays`) problems.push(`pick 13: ${sel}`);
  // the details of the selected value, under the dump
  const fd = (await page.locator("#details").innerText())
    .replace(/\s+/g, " ");
  if (!fd.includes("players[0x7099…79c8].plays uint32 = 3 (after)")) {
    problems.push(`details plays: ${fd}`);
  }
  await pickByte(`${A}.combo`, 22);
  sel = await selected();
  if (sel.join() !== `${A}.combo`) problems.push(`pick 22: ${sel}`);
  // and from the keyboard
  await page.locator(`#panel .view[data-side="after"] ` +
    `.b[data-owners="${A}.plays"][tabindex]`).first().focus();
  await page.keyboard.press("Enter");
  sel = await selected();
  if (sel.join() !== `${A}.plays`) problems.push(`key pick: ${sel}`);
  await page.keyboard.press("Escape"); // Escape clears the selection
  if ((await selected()).length) problems.push("Escape did not clear");
  // a row is focusable, and Enter selects it
  await page.locator(`#tree li[data-path="${A}.score"] > .row`).focus();
  await page.keyboard.press("Enter");
  sel = await selected();
  if (sel.join() !== `${A}.score`) problems.push(`row key: ${sel}`);
  // clicking empty space clears it
  await page.locator("main").click({ position: { x: 4, y: 4 } });
  if ((await selected()).length) problems.push("empty click did not clear");
  await page.evaluate(() => document.activeElement?.blur());

  // Clicking the selected row again clears it
  const tr = (p) => page.locator(`#tree li[data-path="${p}"] > .row`);
  await tr(`${A}.plays`).click();
  await tr(`${A}.plays`).click();
  if ((await selected()).length) problems.push("row click did not toggle");
  // While a variable is selected, the view stays on it: an unrelated
  // byte changes nothing; its own bytes only change the info line; a
  // click on an unrelated byte switches the selection
  await tr(`${A}.combo`).click();
  const look = () => page.evaluate(() => JSON.stringify([
    [...document.querySelectorAll("#panel .b.hl:not(.cmp *)")].length,
    [...document.querySelectorAll("#panel .pop")].map((p) => p.innerText),
    document.querySelectorAll("#panel .cmp").length]));
  const locked0 = await look();
  const probe0 = await page.locator("#details").textContent();
  const scoreByte = page.locator(`#panel .word[data-side="after"] ` +
    `.b[data-owners="${A}.score"][data-i="30"]`);
  await scoreByte.hover();
  if (await look() !== locked0 ||
    await page.locator("#details").textContent() !== probe0) {
    problems.push("locked: an unrelated hover changed the view");
  }
  if (!(await page.locator("#viewing").textContent())
    .includes("viewing players[0x7099…79c8].combo · Esc to clear")) {
    problems.push("locked: no viewing hint");
  }
  await page.locator(`#panel .word[data-side="after"] ` +
    `.b[data-owners="${A}.combo"][data-i="23"]`).hover();
  // (its own bytes: the box stays the selection's)
  if (await look() !== locked0 ||
    await page.locator("#details").textContent() !== probe0) {
    problems.push("locked: own byte hover");
  }
  await scoreByte.click();
  sel = await selected();
  if (sel.join() !== `${A}.score`) {
    problems.push(`locked: click did not switch: ${sel}`);
  }
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();

  // The slots are named as the templates computed them: roster'
  // elements and the long motd's data
  const slotNames = () => page.locator("#panel .wrow[data-name]")
    .evaluateAll((rs) => [...new Set(rs.map((r) => r.dataset.name))]);
  let named = await slotNames();
  if (!named.includes("keccak(slot 0) + 1") || !named.includes("slot 2") ||
    !named.includes("keccak(0x7099…79c8, slot 3)")) {
    problems.push(`combo slots: ${named}`);
  }
  // slot 2 holds rounds, then total, in byte order
  const slot3 = "0x" + "0".repeat(63) + "2";
  const owners = await page.locator('#panel .word[data-side="after"]' +
    `[data-slot="${slot3}"] .b[data-owners]`).evaluateAll((cs) =>
    [...new Set(cs.map((c) => c.dataset.owners))]);
  if (owners.join() !== "rounds,total") problems.push(`owners: ${owners}`);
  await want("rounds", "rounds", range(8, 15), 2);
  await want("total", "total", range(16, 31), 2);

  // Hovering a value lights it in both views and in the tree
  await page.locator('#tree li[data-path="rounds"] > .row').hover();
  const both = Object.keys(await lit());
  if (both.sort().join() !== `after ${slot3},before ${slot3}`) {
    problems.push(`rounds in both views: ${both}`);
  }
  if (!await page.locator('#tree li[data-path="rounds"] > .row.hl')
    .count()) {
    problems.push("rounds: tree row not lit");
  }
  // while rounds is lit, every other byte and tree row steps back; lit
  // ones stay at full strength
  await page.waitForTimeout(250);
  const dim = await page.evaluate(() => {
    const op = (e) => +getComputedStyle(e).opacity;
    const bytes = [...document.querySelectorAll(
      "#panel .b[data-i]:not(.cmp *)")];
    const rows = [...document.querySelectorAll("#tree .row")];
    return {
      lit: bytes.filter((c) => c.classList.contains("hl")).every((c) =>
        op(c) === 1),
      rest: bytes.filter((c) => !c.classList.contains("hl") &&
        !c.classList.contains("at")).every((c) => op(c) < 0.5),
      rows: rows.filter((r) => !r.classList.contains("hl")).every((r) =>
        op(r) < 0.6) && rows.some((r) => r.classList.contains("hl") &&
        op(r) === 1),
    };
  });
  if (!dim.lit || !dim.rest || !dim.rows) {
    problems.push(`dimming: ${JSON.stringify(dim)}`);
  }
  const info = await dl();
  if (info.Value !== "rounds (uint64)" || info.Where !== "slot 2, bytes 8–15" ||
    info.Before !== "3 (0x0000000000000003)" ||
    info.After !== "4 (0x0000000000000004)" ||
    info.scrolls) problems.push(`details rounds: ${JSON.stringify(info)}`);
  // and a popover at slot 2's address, in the dump shown
  const pops = () => page.locator("#panel .pop").allInnerTexts();
  let pp0 = await pops();
  if (pp0.join("|") !== "slot 2 : rounds · total · read, written") {
    problems.push(`pops rounds: ${pp0}`);
  }
  pp0 = [];
  // and from a byte in one view, the same position in the other
  for (const [from, to] of [["before", "after"], ["after", "before"]]) {
    await setMode(from);
    await page.locator(`#panel .word[data-side="${from}"]` +
      `[data-slot="${slot3}"] .b[data-i="14"]`).hover();
    const at = await page.evaluate(() => {
      const out = {};
      for (const c of document.querySelectorAll("#panel .b.at:not(.cmp *)")) {
        const w = c.closest(".word");
        (out[w.dataset.side] ??= []).push(+c.dataset.i);
      }
      return out;
    });
    const hl = Object.keys(await lit()).map((k) => k.split(" ")[0]);
    if (at[from]?.join() !== range(8, 15).join() ||
      at[to]?.join() !== range(8, 15).join() || !hl.includes(to)) {
      problems.push(`byte ${from} -> ${to}: ${JSON.stringify(at)} ${hl}`);
    }
  }
  await setMode("after");

  // A scene with one point: a byte names its owner and its hex, with no
  // before and after; the popover says how the slot was found only
  await scene("mid");
  await page.locator(`#panel .word[data-side="after"][data-slot="${slot3}"]` +
    ' .b[data-i="31"]').hover();
  const one = await dl();
  if (one.Value !== "total (uint128)" || one.Where !== "slot 2, bytes 16–31" ||
    one.Holds !== "40 (0x…000028)" || "Before" in one || "After" in one) {
    problems.push(`one point details: ${JSON.stringify(one)}`);
  }
  if ((await pops()).join("|") !== "slot 2 : rounds · total") {
    problems.push(`one point pops: ${await pops()}`);
  }
  if (await page.locator("#panel .cmp, #tree .tcard").count()) {
    problems.push("one point: a card");
  }
  await page.locator(`#tree li[data-path="${A}.combo"] > .row`).click();
  const box1 = await page.locator("#details").innerText();
  if (!box1.includes("players[0x7099…79c8].combo uint32 = 2") ||
    /\((before|after)/.test(box1) || !box1.includes("▸ Show how it was found")) {
    problems.push(`one point: box ${box1}`);
  }
  await page.keyboard.press("Escape");

  // Every scene with one point: whatever is selected (each top-level
  // variable, and one value inside each), no cards, no tray, no tree
  // cards, no "Before" or "After" in the words, and no popover covers
  // another row's address
  for (const [id, [, dsel]] of Object.entries(defaults)) {
    if (!["mid", "vyper"].includes(id)) continue;
    await page.locator(`#picker button[data-id="${id}"]`).click();
    await page.waitForFunction((x) => document.querySelector(
      '#picker [aria-checked="true"]')?.dataset.id === x, id);
    const paths = await page.evaluate(() => {
      const tops = [...document.querySelectorAll("#tree li.top")];
      return tops.flatMap((li) => [li.dataset.path,
        li.querySelector("li[data-path]")?.dataset.path].filter(Boolean));
    });
    for (const p of [null, ...paths]) {
      if (p) {
        await page.locator(`#tree li[data-path="${p}"] > .row`).click();
      } else if (dsel) {
        // the scene's default selection, as it opens
      }
      await page.mouse.move(1, 1);
      const bad = await page.evaluate(() => {
        const out = [];
        const n = document.querySelectorAll("#panel .cmp, #panel .pin, " +
          "#panel .tray, #tree .tcard").length;
        if (n) out.push(`${n} cards`);
        const t = document.querySelector(".cols .words").innerText;
        if (/\b(Before|After)\b/.test(t)) out.push("before/after text");
        const hit = (a, b) => a.left < b.right - 0.5 &&
          b.left < a.right - 0.5 && a.top < b.bottom - 0.5 &&
          b.top < a.bottom - 0.5;
        // (a popover may cover unlit rows, not lit bytes, a lit row's
        // address or another popover)
        const v = document.querySelector('#panel .view:not([hidden])');
        const pops = [...v.querySelectorAll(".pop")];
        for (const pop of pops) {
          const own = pop.closest(".wrow");
          const r = pop.getBoundingClientRect();
          for (const a of v.querySelectorAll(".rows > .wrow.on > .addr, " +
            ".rows > .wrow > .word .b.hl")) {
            if (a.closest(".wrow") !== own && hit(r, a.getBoundingClientRect())) {
              out.push(`pop on ${a.textContent}`);
            }
          }
          for (const q of pops) {
            if (q !== pop && hit(r, q.getBoundingClientRect())) {
              out.push("pop on pop");
            }
          }
        }
        return out;
      });
      if (bad.length) problems.push(`${id} ${p ?? "(default)"}: ${bad}`);
      if (p) await page.locator(`#tree li[data-path="${p}"] > .row`).click();
    }
  }

  // A string moves into its slot. Short: the data and the length byte
  // share the string's slot. Long: the slot holds the length word, and
  // the data lives at keccak(slot) on. Slots are named here as the page
  // names them (from the template's defines).
  await scene("motd");
  const names = await page.locator('#panel .view[data-side="after"] ' +
    ".wrow[data-name]").evaluateAll((rs) => Object.fromEntries(
    rs.map((r) => [r.dataset.slot, r.dataset.name])));
  {
    const sides = {
      before: { "slot 1": range(0, 31), "keccak(slot 1)": range(0, 31),
        "keccak(slot 1) + 1": range(0, 17) },
      after: { "slot 1": [...range(0, 4), 31] },
    };
    await page.locator('#tree li[data-path="motd"] > .row').hover();
    const named = {};
    for (const [k, v] of Object.entries(await lit())) {
      const [side, s] = k.split(" ");
      (named[side] ??= {})[names[s] ?? s] = v.join();
    }
    const want = Object.fromEntries(Object.entries(sides).map(([side, m]) =>
      [side, Object.fromEntries(Object.entries(m).map(([k, v]) =>
        [k, v.join()]))]));
    if (!same(named, want)) {
      problems.push(`motd bytes: ${JSON.stringify(named)}`);
    }
  }
  // A slot used only in the other state is marked: the old data run in
  // the After dump (zeroed by solc)
  await setMode("after");
  await page.locator('#tree li[data-path="motd"] > .row').hover();
  const only = await page.evaluate(() => [...document.querySelectorAll(
    '#panel .view[data-side="after"] .wrow.only')].map((r) =>
    r.dataset.slot));
  const zeroed = await page.evaluate(() => [...document.querySelectorAll(
    '#panel .view[data-side="after"] .wrow.only > .word')].every((w) =>
    [...w.querySelectorAll(".b")].every((c) => c.textContent === "00")));
  if (!zeroed) problems.push("motd: the old data is not zeroed After");
  await setMode("before");
  if (only.map((x) => names[x]).join() !==
    "keccak(slot 1),keccak(slot 1) + 1") {
    problems.push(`motd only: ${only.map((x) => names[x])}`);
  }
  // In Before, both runs (slot 1 and its long data, both lit)
  // get their derivation label; no popover or card covers a lit row's
  // address label
  await page.locator('#tree li[data-path="motd"] > .row').click();
  await page.mouse.move(1, 1);
  const labelled = await page.evaluate(() => {
    const v = document.querySelector('#panel .view[data-side="before"]');
    // (a popover with no room goes to the tray, under the dumps)
    const pops = [...document.querySelectorAll("#panel .pop")];
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const cells = [...v.querySelectorAll(".rows > .wrow > .addr .a")];
    const lit = cells.filter((c) => c.closest(".wrow.on, .wrow.only"));
    const box = (e) => e.getBoundingClientRect();
    const covered = [
      ...pops.filter((p) => !p.classList.contains("pinned")).flatMap((p) =>
        lit.filter((c) => hit(box(p), box(c)))),
      ...[...v.querySelectorAll(".cmp:not(.pinned) .cmp-frame")].flatMap(
        (f) => lit.filter((c) => !f.closest(".wrow").contains(c) &&
          hit(box(f), box(c)))),
    ].map((c) => c.textContent);
    return { pops: pops.map((p) => p.querySelector(".pop-how").textContent),
      covered };
  });
  if (labelled.pops.length !== 2 ||
    !labelled.pops.some((t) => t.startsWith("slot 1")) ||
    !labelled.pops.some((t) => t.startsWith("keccak(slot 1) : motd, 2 slots")) ||
    labelled.covered.length) {
    problems.push(`motd labels: ${JSON.stringify(labelled)}`);
  }
  await page.keyboard.press("Escape");
  // Each run's addresses sit in one group box in the gutter, and its
  // popover's arrow lands within that box (both states)
  for (const m of ["before", "after"]) {
    await setMode(m);
    await page.locator('#tree li[data-path="motd"] > .row').click();
    await page.mouse.move(1, 1);
    const bad = await page.evaluate((side) => {
      const v = document.querySelector(`#panel .view[data-side="${side}"]`);
      const out = [];
      // runs: lit rows next to each other in the dump
      const runs = [];
      let run = null;
      for (const el of v.querySelector(".rows").children) {
        if (el.matches(".wrow.on, .wrow.only")) {
          if (!run) runs.push(run = []);
          run.push(el);
        } else run = null;
      }
      if (!runs.length) out.push("no runs");
      for (const rows of runs) {
        const cls = rows.map((r) =>
          r.querySelector(":scope > .addr").className);
        // one group: every address tinted, rounded at its two ends
        if (!cls.every((c) => c.includes("grp")) ||
          !cls[0].includes("grp-top") || !cls.at(-1).includes("grp-end") ||
          cls.slice(1).some((c) => c.includes("grp-top")) ||
          cls.slice(0, -1).some((c) => c.includes("grp-end"))) {
          out.push(`not one group: ${rows[0].dataset.name}`);
        }
        const g = rows[0].querySelector(":scope > .addr")
          .getBoundingClientRect();
        const pop = rows.map((x) => x.querySelector(".pop")).find(Boolean);
        if (!pop) continue; // in the tray
        const tip = pop.getBoundingClientRect().left +
          parseFloat(pop.style.getPropertyValue("--ax"));
        if (tip < g.left || tip > g.right) {
          out.push(`arrow off its group: ${rows[0].dataset.name}`);
        }
      }
      // and none inside the cards
      if (v.querySelector(".cmp .addr.grp")) {
        const c = getComputedStyle(v.querySelector(".cmp .addr.grp"),
          "::before").display;
        if (c !== "none") out.push("group tint in a card");
      }
      return out;
    }, m);
    if (bad.length) problems.push(`motd ${m} groups: ${bad}`);
    await page.keyboard.press("Escape");
  }
  // The tray is the same in Before and After: each run's card is in
  // place in both states, or in the tray in both
  {
    const n = [];
    for (const m of ["before", "after"]) {
      await setMode(m);
      await page.locator('#tree li[data-path="motd"] > .row').hover();
      n.push(await page.evaluate(() => [
        document.querySelectorAll("#panel .cmp:not(.pinned)").length,
        document.querySelectorAll("#panel .cmp.pinned").length].join("/")));
    }
    if (n[0] !== n[1]) problems.push(`motd cards: ${n}`);
  }
  await setMode("after");
  // the long data is a run of two consecutive slots, with no gap
  const run = await page.locator('#panel .view[data-side="after"] .rows')
    .evaluate((r) => [...r.children].map((c) => c.dataset.name ?? "gap"));
  const k0 = run.indexOf("keccak(slot 1)");
  if (k0 < 0 || run[k0 + 1] !== "keccak(slot 1) + 1") {
    problems.push(`motd run: ${run}`);
  }

  // At rest: no popover, and nothing in the dumps but addresses and
  // bytes (names live in the tree)
  await scene("alice");
  await page.locator("h1").hover();
  if ((await pops()).length) problems.push("popover at rest");
  await page.waitForTimeout(250);
  if (await page.locator("#panel.active, #tree.active").count()) {
    problems.push("dimmed at rest");
  }
  const dumpText = await page.locator("#panel .rows").allInnerTexts();
  const stray = dumpText.join(" ").replace(/[0-9a-f…⋯\s]/g, "");
  if (stray) problems.push(`text in the dump: ${stray.slice(0, 40)}`);
  // A hashed slot's popover says how it was found
  await page.locator(`#tree li[data-path="${A}.combo"] > .row`).hover();
  pp0 = await pops();
  if (pp0.length !== 1 || !pp0[0].startsWith(
    "keccak(0x7099…79c8, slot 3) : lastBlock · hitCount · plays +3 · read, " +
    "written")) {
    problems.push(`pops combo: ${pp0}`);
  }
  // each popover's left edge is at the gutter's, its arrow at its
  // address, and it stays on screen:
  // over the row in Before, under it in After
  const aim = () => page.evaluate(() => [...document.querySelectorAll(
    "#panel .pop")].map((p) => {
    const a = p.parentElement.querySelector(".a").getBoundingClientRect();
    const g = p.parentElement.getBoundingClientRect();
    const r = p.getBoundingClientRect();
    const side = p.closest(".view").dataset.side;
    // left edge a little left of the gutter's (as the cards), the
    // arrow within the address cell
    const tip = r.left + parseFloat(p.style.getPropertyValue("--ax"));
    const at = Math.abs(r.left - (g.left - 6)) < 5 && tip >= a.left &&
      tip <= a.right;
    return at && r.right <= document.documentElement.clientWidth &&
      (side === "before" ? r.bottom <= a.top : r.top >= a.bottom);
  }));
  let aimed = await aim();
  await setMode("before");
  await page.locator(`#tree li[data-path="${A}.combo"] > .row`).hover();
  aimed = [...aimed, ...await aim()];
  await setMode("after");
  if (aimed.length !== 2 || !aimed.every(Boolean)) {
    problems.push(`aim: ${aimed}`);
  }

  // The other state's picture beside the lit run. combo: an "after"
  // card under its row in Before, a "before" card over it in After, at
  // bytes 20-23, in the same columns as the row
  const cmp = () => page.evaluate(() => [...document.querySelectorAll(
    "#panel .cmp:not(.pinned)")].map((el) => {
    const row = el.closest(".wrow");
    const r = row.getBoundingClientRect();
    const b = el.querySelector(".cmp-frame").getBoundingClientRect();
    const lines = [...el.querySelectorAll(".cmp-photo > .wrow")].map((l) => {
      const word = el.closest(".view").querySelector(
        `.wrow[data-slot="${l.dataset.of}"] > .word`);
      const cells = [...l.querySelectorAll(".b.hl")];
      // the cells inside the card's frame line up with the run's own
      const seen = cells.filter((c) => {
        const q = c.getBoundingClientRect();
        return q.left >= b.left && q.right <= b.right;
      });
      return {
        slot: l.dataset.of,
        bytes: cells.map((c) => +c.dataset.i),
        text: cells.map((c) => c.textContent).join(""),
        aligned: seen.length > 0 && seen.every((c) => Math.abs(
          c.getBoundingClientRect().left - word.querySelector(
            `.b[data-i="${c.dataset.i}"]`).getBoundingClientRect().left) < 1),
      };
    });
    return {
      side: el.closest(".view").dataset.side,
      label: el.querySelector(".cmp-tag").textContent,
      under: b.top >= r.bottom - 0.5, over: b.bottom <= r.top + 0.5,
      // whole words: from the gutter to the end of the 32 bytes
      // (with a few px of room on each side)
      full: Math.abs(b.left - (r.left - 6)) < 2 && b.right >= row
        .querySelector(':scope > .word .b[data-i="31"]')
        .getBoundingClientRect().right + 2,
      lines,
    };
  }));
  // what each box measures, to see that a highlight adds no scrollbar
  // and moves nothing
  // (scroll sizes count only for a box that scrolls or clips)
  const boxes = () => page.evaluate(() => JSON.stringify(
    [document.documentElement, ...document.querySelectorAll(
      ".words, .views, #panel, .dump")].map((e) => {
      const cs = getComputedStyle(e);
      const scrolls = e === document.documentElement ||
        cs.overflowX !== "visible" || cs.overflowY !== "visible";
      return [e.clientWidth, e.clientHeight,
        ...(scrolls ? [e.scrollWidth, e.scrollHeight] : [])];
    })));
  // (relative to the panel: hovering a tree row may scroll the page)
  const tops = () => page.locator("#panel .wrow:not(.cmp *)")
    .evaluateAll((rs) => rs.filter((r) => r.offsetHeight).map((r) =>
      Math.round(r.getBoundingClientRect().top - document.querySelector(
        "#panel").getBoundingClientRect().top)).join());
  const clashes = () => page.evaluate(() => {
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const notes = [...document.querySelectorAll(
      "#panel .cmp:not(.pinned), #panel .pop:not(.pinned)")];
    const rects = (n) => n.classList.contains("pop")
      ? [n.getBoundingClientRect()]
      : [...n.querySelectorAll(".cmp-frame, .cmp-tag")].map((e) =>
        e.getBoundingClientRect());
    const lit = [...document.querySelectorAll(
      "#panel .b.hl:not(.cmp *)")].map((e) => e.getBoundingClientRect());
    const out = [];
    notes.forEach((a, i) => {
      for (const r of rects(a)) {
        if (lit.some((b) => hit(r, b))) out.push(`${a.className} on lit`);
        for (const b of notes.slice(i + 1)) {
          if (rects(b).some((q) => hit(r, q))) {
            out.push(`${a.className} on ${b.className}`);
          }
        }
      }
    });
    return out;
  });
  // the slot popover: over the run in Before, under it in After
  const popAt = () => page.evaluate(() => [...document.querySelectorAll(
    "#panel .pop:not(.pinned)")].map((p) => {
    const rows = [...p.closest(".view").querySelectorAll(".wrow.on")];
    const r = p.getBoundingClientRect();
    return r.bottom <= rows[0].getBoundingClientRect().top + 0.5 ? "over"
      : r.top >= rows.at(-1).getBoundingClientRect().bottom - 0.5
        ? "under" : "on";
  }).join());
  await page.evaluate(() =>
    window.scrollTo(0, document.querySelector(".cols").offsetTop - 8));
  for (const m of ["before", "after"]) {
    await setMode(m);
    await page.mouse.move(1, 1);
    if ((await cmp()).length) problems.push(`${m}: card at rest`);
    const rest = await tops();
    const restBoxes = await boxes();
    const other = m === "before" ? "after" : "before";
    await page.locator(`#tree li[data-path="${A}.combo"] > .row`)
      .hover();
    let blocks = await cmp();
    const b0 = blocks[0];
    if (blocks.length !== 1 || b0.side !== m || b0.label !== other ||
      !(m === "before" ? b0.under : b0.over) ||
      b0.lines[0].bytes.join() !== range(20, 23).join() ||
      b0.lines[0].text !== (m === "before" ? "00000003" : "00000002") ||
      !b0.lines[0].aligned || !b0.full) {
      problems.push(`${m}: combo card: ${JSON.stringify(blocks)}`);
    }
    if (await popAt() !== (m === "before" ? "over" : "under")) {
      problems.push(`${m}: popover place: ${await popAt()}`);
    }
    // alice's whole entry lights one slot (her struct, packed): one
    // card, one line, aligned; no clashes; nothing moves, no scrollbar
    await page.locator(`#tree li[data-path="${A}"] > .row`).hover();
    blocks = await cmp();
    if (blocks.length !== 1 || blocks[0].lines.length !== 1 ||
      blocks[0].lines[0].bytes.join() !== range(0, 31).join() ||
      !blocks[0].lines.every((l) => l.aligned) || !blocks[0].full) {
      problems.push(`${m}: struct card: ${JSON.stringify(blocks)}`);
    }
    const c = await clashes();
    if (c.length) problems.push(`${m}: clashes: ${c}`);
    if (await tops() !== rest) {
      problems.push(`${m}: rows moved while lit: ${rest} -> ${await tops()}`);
    }
    const litBoxes = await boxes();
    if (litBoxes !== restBoxes) {
      problems.push(`${m}: a box changed size while lit: ${restBoxes} ` +
        `-> ${litBoxes}`);
    }
    if (await page.locator("#panel .tray").count()) {
      problems.push(`${m}: struct went to the tray`);
    }
  }
  if (name === "chromium") {
    await page.evaluate(() =>
      window.scrollTo(0, document.querySelector(".cols").offsetTop - 8));
    await page.locator(`#tree li[data-path="${A}"] > .row`).hover();
    await page.waitForTimeout(300);
    await page.locator(".words").first().screenshot({
      path: shot("insets.png") });
  }
  // and by keyboard, from an address in the gutter
  await page.mouse.move(1, 1);
  const addr0 = page.locator('#panel .view[data-side="after"] .wrow ' +
    `[tabindex]`).first();
  // (in view first: a scroll after the focus would move the pointer)
  await addr0.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await addr0.focus();
  pp0 = await pops();
  if (pp0.length !== 1) problems.push(`pops on focus: ${pp0}`);
  await page.locator("h1").hover();
  await page.evaluate(() => document.activeElement.blur());

  // Both dumps list the same slots, in ascending address order, with a
  // gap line before the first and wherever the addresses jump
  for (const id of Object.keys(expected)) {
    await scene(id);
    const order = (side) => page.locator(`#panel .view[data-side=` +
      `"${side}"] .word`).evaluateAll((ws) => ws.map((w) => w.dataset.slot));
    const b = await order("before");
    const a = await order("after");
    const n = b.map(BigInt);
    const ok = b.join() === a.join() && b.length > 0 &&
      n.every((x, k) => k === 0 || n[k - 1] < x);
    if (!ok) problems.push(`${id} order: ${b.map((x) => x.slice(0, 8))}`);
    const seq = await page.locator('#panel .view[data-side="after"] .rows')
      .evaluate((r) => [...r.children].filter((c) =>
        !c.classList.contains("room")).map((c) =>
        c.classList.contains("gap") ? "gap" : c.dataset.slot));
    const want = [];
    n.forEach((x, k) => {
      // (no gap line before slot 0)
      if ((k === 0 && x !== 0n) || (k && x !== n[k - 1] + 1n)) {
        want.push("gap");
      }
      want.push(b[k]);
    });
    want.push("gap");
    if (seq.join() !== want.join()) problems.push(`${id} gaps: ${seq}`);
  }
  // Each word is one line of 32 bytes; one dump is shown; on a wide
  // panel nothing scrolls sideways
  // (lines: 1 on a wide page; 2 of 16 bytes on a phone)
  const layout = (p, lines = 1) => p.evaluate((n) => {
    const out = [];
    for (const w of document.querySelectorAll("#panel .word:not(.cmp *)")) {
      if (!w.offsetHeight) continue; // the dump not shown
      const tops = [...w.querySelectorAll(".b")].map((c) =>
        Math.round(c.getBoundingClientRect().top));
      const per = tops.filter((t) => t === tops[0]).length;
      if (w.querySelectorAll(".b").length !== 32 || new Set(tops).size !== n ||
        per !== 32 / n) {
        out.push(`word ${w.dataset.side} ${w.dataset.slot.slice(0, 8)}` +
          ` on ${new Set(tops).size} lines, ${per} a line`);
      }
    }
    const seen = [...document.querySelectorAll("#panel .view")].filter(
      (v) => v.offsetHeight);
    if (seen.length !== 1) out.push(`${seen.length} dumps shown`);
    const v = document.querySelector("#panel .views");
    // every byte in view, with no sideways scrolling
    const right = Math.max(...[...document.querySelectorAll(
      "#panel .view:not([hidden]) .word .b")].map((c) =>
      c.getBoundingClientRect().right));
    return { out, scrolls: v.scrollWidth > v.clientWidth + 1 ||
      right > v.getBoundingClientRect().right + 0.5 };
  }, lines);
  await scene("motd");
  const wide = await layout(page);
  problems.push(...wide.out);
  if (wide.scrolls) problems.push("wide: words scroll sideways");
  // and at other desktop widths, the words fill the panel, one line each
  for (const width of [1440, 1920, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const l = await layout(page);
    problems.push(...l.out.map((x) => `${width}: ${x}`));
    if (l.scrolls) problems.push(`${width}: words scroll sideways`);
  }
  // The first scene, as its intro asks: a click on a byte of slot 2
  await page.locator('#picker button[data-id="mid"]').click();
  await page.locator('#panel .word[data-side="after"] ' +
    '.b[data-owners="total"][data-i="31"]').click();
  await page.locator("h1").hover();
  if ((await selected()).join() !== "total") {
    problems.push(`packed: byte click selected ${await selected()}`);
  }
  if (name === "chromium") {
    await page.locator(".cols").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0,
      document.querySelector("#storage").offsetTop - 8));
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("desktop-packed.png") });
  }

  // The replay. Over both columns, one line: the selection, the
  // controls, the step's short caption. Stuck to the bottom of the
  // dump's column: the step in full, the chips, the footnote, and the
  // pointer solc wrote, as YAML, the step's lines lit. Nothing moves.
  await scene("mid");
  const row = (p) => page.locator(`#tree li[data-path="${p}"] > .row`);
  const how = async () => `${await page.locator("#details").innerText()}\n${
    await page.locator("#dpanel").innerText()}`;
  const mnames = await page.locator('#panel .view[data-side="after"] ' +
    ".wrow[data-name]").evaluateAll((rs) => Object.fromEntries(
    rs.map((r) => [r.dataset.slot, r.dataset.name])));
  const stepNow = () => page.evaluate(() => {
    const box = (q) => {
      const r = document.querySelector(q)?.getBoundingClientRect();
      return r && [r.left, r.top, r.width, r.height].map(Math.round).join();
    };
    const fits = (q) => {
      const e = document.querySelector(q);
      return !e || e.scrollHeight <= e.clientHeight + 1;
    };
    return {
      cap: document.querySelector("#details .rcount")?.textContent ? document
        .querySelector("#dtext .rcap")?.textContent.trim() : null,
      form: document.querySelector("#dtext .rform")?.textContent.trim(),
      short: document.querySelector("#details .rshort")?.textContent,
      count: document.querySelector("#details .rcount")?.textContent ||
        undefined,
      resolved: !!document.querySelector('#details button[data-r="start"]'),
      ctl: box("#details .rctl"),
      fits: fits("#dtext .rcap") && fits("#dtext .rform"),
      chips: [...document.querySelectorAll("#chips .chip")].map((c) =>
        c.className.replace("chip ", "")).join(),
      ptr: [...document.querySelectorAll("#ptr .line.on")].map((l) =>
        l.textContent.trim()),
      lit: [...document.querySelectorAll(
        "#panel .view:not([hidden]) .b.hl")].map((c) =>
        `${c.closest(".wrow").dataset.slot} ${c.dataset.i}`),
      // (at full strength: not an echo)
      full: [...document.querySelectorAll(
        "#panel .view:not([hidden]) .b.hl:not(.muted)")].map((c) =>
        `${c.closest(".wrow").dataset.slot} ${c.dataset.i}`),
      gut: [...document.querySelectorAll(
        "#panel .view:not([hidden]) .wrow.gut")].map((r) => r.dataset.slot),
      src: [...document.querySelectorAll(
        "#panel .view:not([hidden]) .b.hl.pksrc")].length,
      dim: document.querySelector("#panel").classList.contains("active"),
    };
  });
  const litNamed = (st, nm = mnames) => {
    const by = {};
    for (const x of st.lit) {
      const [sl, i] = x.split(" ");
      (by[nm[sl] ?? sl] ??= []).push(+i);
    }
    return Object.fromEntries(Object.entries(by).map(([k, v]) =>
      [k, v.length === 32 ? "all" : v.join()]));
  };
  // walk a replay: each step, and what the controls do
  const walk = async (path, nm = mnames) => {
    await row(path).click();
    await page.mouse.move(1, 1);
    await page.locator('#details button[data-r="start"]').click();
    const out = [];
    const ctl = new Set();
    // (▶ stops at the last step; ✕ Exit leaves)
    for (let k = 0; k < 20; k++) {
      const x = await stepNow();
      ctl.add(x.ctl);
      out.push({ ...x, lit: litNamed(x, nm),
        full: litNamed({ lit: x.full }, nm),
        gut: x.gut.map((sl) => nm[sl] ?? sl) });
      if (await page.locator('#details button[data-r="next"]').isDisabled()) {
        break;
      }
      await page.locator('#details button[data-r="next"]').click();
    }
    await page.locator('#details button[data-r="exit"]').click();
    ctl.add((await stepNow()).ctl);
    out.ctl = ctl.size;
    return out;
  };
  const al = "keccak(0x7099…79c8, slot 3)";
  const rec = "keccak(0x3c44…93bc, slot 3)";
  const cl0 = "keccak(0x90f7…b906, slot 3)";
  // players: five steps, one per rule, each for all three entries at
  // once; the lines of the pointer each uses
  {
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    const t = await page.locator("#details .rsel").innerText();
    if (!t.includes("3 entries")) problems.push(`title: ${t}`);
    await page.evaluate(() => window.select("mid", { sel: null }));
  }
  let w = await walk("players");
  const stats = "all";
  const roster = { "keccak(slot 0)": range(12, 31).join(),
    "keccak(slot 0) + 1": range(12, 31).join(),
    "keccak(slot 0) + 2": range(12, 31).join() };
  const cdata = `keccak(${cl0} + 1)`;
  // (cap, lit, at full strength, the band's line, the gutters)
  const wantPlayers = [
    // (its own slot named, not read: the gutter only)
    ["players is declared at slot 3; that slot holds nothing",
      {}, null, "slot: 0x03", ["slot 3"]],
    // (a template entered: the inputs it takes; the keys' items lit)
    ["The template mapping(address => Player) takes slot = 3, key = each " +
      "address in roster", roster, null, "expect: [slot, key]", ["slot 3"]],
    // (all three entries at once, and the roster items of their keys)
    ["Each record is at keccak(key, 3); the keys are the addresses in roster",
      { [al]: "all", [rec]: "all", [cl0]: "all", ...roster }, null,
      "$keccak256", []],
    ["The template Player takes slot = each record's slot", {}, null,
      "expect: [slot]", [al, rec, cl0]],
    // (alice, the focus, at full strength; bob and carol echo, muted)
    ["A record is two slots: stats, then name", { [al]: "all",
      [`${al} + 1`]: "0,1,2,3,4,31", [rec]: "all", [`${rec} + 1`]: "0,1,2,31",
      [cl0]: "all", [`${cl0} + 1`]: "all" },
    { [al]: "all", [`${al} + 1`]: "0,1,2,3,4,31" }, "$sum: [slot, 0x01]", []],
    ["The stats share one slot, packed from the right",
      { [al]: stats, [rec]: stats, [cl0]: stats }, { [al]: stats },
      "name: score", []],
    ["The template string takes slot = each record's name slot", {}, null,
      "expect: [slot]", [`${al} + 1`, `${rec} + 1`, `${cl0} + 1`]],
    // (both branches: alice's and bob's short names, carol's long one)
    ["The last byte decides name's form", { [`${al} + 1`]: "0,1,2,3,4,31",
      [`${rec} + 1`]: "0,1,2,31", [`${cl0} + 1`]: "all", [cdata]: "all",
      [`${cdata} + 1`]: "0,1" }, null, "else:", []],
  ];
  const P = Object.fromEntries(["decl", "map", "entries", "player", "record",
    "fields", "string", "name"].map((k, i) => [k, i]));
  if (w.length !== 8 || w.ctl !== 1) {
    problems.push(`replay players: ${w.length} steps, controls at ${w.ctl}`);
  }
  for (const [k, [cap, lit0, full0, ptr, gut]] of wantPlayers.entries()) {
    const x = w[k];
    if (!x?.cap.startsWith(cap) || !same(x.lit, lit0) ||
      !same(x.full, full0 ?? lit0) || !x.dim || !x.fits ||
      x.count !== `${k + 1} / 8` || !x.short ||
      [...x.gut].sort().join() !== [...gut].sort().join() ||
      !x.ptr.some((l) => l.includes(ptr))) {
      problems.push(`players step ${k + 1}: ${JSON.stringify({ cap: x?.cap,
        lit: x?.lit, full: x?.full, gut: x?.gut, fits: x?.fits,
        ptr: x?.ptr })}`);
    }
    const chips = wantPlayers.map((_, j) => j < k ? "done" : j === k ? "cur"
      : "later").join();
    if (x?.chips !== chips) problems.push(`players chips ${k + 1}: ${x?.chips}`);
  }
  // a template step's band is its frame (name, expect, for:); the next
  // step's band starts inside it (group:)
  if (w[P.player]?.ptr.join("|") !== "Player:|expect: [slot]|for:" ||
    w[P.record]?.ptr[0] !== "group:") {
    problems.push(`template frame: ${w[P.player]?.ptr} | ${w[P.record]
      ?.ptr.slice(0, 2)}`);
  }
  // step 2's instances, one row a key; step 5's two branches
  if (!["0x7099…79c8 alice→…aa80", "0x3c44…93bc bob→…7527",
    "0x90f7…b906 carol→…9978"].every((x) => w[P.entries]?.form
    .includes(x)) ||
    !w[P.name]?.form.includes("even: 0x0a → 5 bytes inline") ||
    !w[P.name]?.form.includes("odd: 0x45 → 34 bytes at keccak(…9979)")) {
    problems.push(`players forms: ${w[P.entries]?.form} | ${w[P.name]
      ?.form}`);
  }
  // the chips: one per rule, with its storage noun
  {
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    const cs = await page.locator("#chips .chip").evaluateAll((cs) =>
      cs.map((c) => c.textContent).join("|"));
    if (cs !== "slot 3mapping|mapping(address => Player)template|" +
      "keccak(key, 3)records|Playertemplate|2 slotsrecord|" +
      "6 fieldsfields|stringtemplate|name: short | longstring") {
      problems.push(`chips: ${cs}`);
    }
  }
  // the focus picker: bob at full strength in steps 3 and 4, and in the
  // formulas; nothing moves
  {
    await page.locator('#details button[data-r="start"]').click();
    await page.locator(`#chips .chip[data-k="${P.fields}"]`).click();
    await page.mouse.move(1, 1);
    const boxes = () => page.evaluate(() => JSON.stringify([
      ...document.querySelectorAll("#details, #dpanel, #dpick button, " +
        "#chips .chip, #panel .view:not([hidden]) .wrow, #tree")].map((e) => {
      const r = e.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    })));
    const b0 = await boxes();
    await page.locator('#dpick button', { hasText: "bob" }).click();
    await page.mouse.move(1, 1);
    const x = await stepNow();
    const b1 = await boxes();
    const pressed = await page.locator('#dpick button[aria-pressed="true"]')
      .innerText();
    await page.locator(`#chips .chip[data-k="${P.record}"]`).click();
    const y = await stepNow();
    if (b0 !== b1 || pressed !== "bob" || x.count !== "6 / 8" ||
      !same(litNamed({ lit: x.full }), { [rec]: stats }) ||
      !y.form.startsWith("bob: …7527") || !same(litNamed({ lit: y.full }),
        { [rec]: "all", [`${rec} + 1`]: "0,1,2,31" })) {
      problems.push(`focus picker: ${b0 !== b1 ? "moved " : ""}${pressed} ${
        x.count} ${JSON.stringify(litNamed({ lit: x.full }))} ${y.form}`);
    }
    await page.keyboard.press("Escape");
  }
  // the key's list items light at step 2, in their entries' colours
  {
    await page.locator('#details button[data-r="start"]').click();
    await page.locator(`#chips .chip[data-k="${P.entries}"]`).click();
    await page.mouse.move(1, 1);
    const pairs = await page.evaluate((es) => es.map((e, i) => {
      const c = (p) => document.querySelector(`#tree li[data-path="${p}"] ` +
        "> .row")?.className.match(/pk\d/)?.[0];
      return [c(`roster[${i}]`), c(e)];
    }), [A, B, C]);
    if (pairs.some(([a, b]) => !a || a !== b)) {
      problems.push(`step 2 roster colours: ${JSON.stringify(pairs)}`);
    }
    await page.keyboard.press("Escape");
  }
  // entries and fields never share a colour
  const huesAt = async (k) => {
    await page.locator('#details button[data-r="start"]').click();
    await page.locator(`#chips .chip[data-k="${k}"]`).click();
    await page.mouse.move(1, 1);
    const hs = await page.evaluate(() => [...new Set([...document
      .querySelectorAll("#panel .view:not([hidden]) .b.hl:not(.pksrc)")]
      .map((c) => getComputedStyle(c).backgroundColor))]);
    await page.keyboard.press("Escape");
    return hs;
  };
  const entryHues = [...new Set([...await huesAt(P.entries),
    ...await huesAt(P.record)])];
  const fieldHues = await huesAt(P.fields);
  if (entryHues.length !== 3 || fieldHues.length !== 6 ||
    fieldHues.some((x) => entryHues.includes(x))) {
    problems.push(`hues: entries ${entryHues}, fields ${fieldHues}`);
  }
  // a row a step has derived keeps its label at later steps; carol's
  // data rows get theirs only at step 5; ◀ takes it back
  {
    const labelled = () => page.evaluate(() => Object.fromEntries([
      ...document.querySelectorAll("#panel .view:not([hidden]) .wrow" +
        "[data-name]")].map((r) => [r.dataset.name,
      r.querySelector(":scope > .addr").classList.contains("grp")])));
    await page.locator('#details button[data-r="start"]').click();
    const seen = [];
    for (let k = 0; k < 8; k++) {
      await page.locator(`#chips .chip[data-k="${k}"]`).click();
      await page.mouse.move(1, 1);
      seen.push(await labelled());
    }
    const data = cdata;
    const bad = [];
    // (all three entries from the entries step)
    for (let k = P.entries; k < 8; k++) {
      for (const [who, e] of [["alice", al], ["bob", rec], ["carol", cl0]]) {
        if (!seen[k][e]) bad.push(`${who} ${k + 1}`);
      }
    }
    for (let k = 0; k < P.name; k++) {
      if (seen[k][data]) bad.push(`carol ${k + 1}`);
    }
    if (!seen[P.name][data]) bad.push("carol at the name");
    await page.locator('#details button[data-r="prev"]').click();
    if ((await labelled())[data]) bad.push("◀ kept carol's data");
    // the current step's labels are dark; earlier ones are muted
    const kept = await page.locator("#panel .pop.kept").count();
    const dark = await page.locator("#panel .pop:not(.kept)").count();
    if (!kept || !dark) bad.push(`labels: ${kept} kept, ${dark} current`);
    if (bad.length) problems.push(`reveal: ${bad}`);
    await page.keyboard.press("Escape");
  }
  // the footnotes link to the spec's pages
  {
    const ok = new Set(Object.values({
      a: "concepts/#a-pointer-is-a-region-or-a-collection-of-other-pointers",
      b: "expression/#keccak256-hashes", c: "template/",
      d: "collection/group/", e: "region/location/storage/",
      f: "collection/conditional/", g: "collection/list/" }).map((x) =>
      `https://ethdebug.github.io/format/spec/pointer/${x}`));
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    await page.locator('#details button[data-r="start"]').click();
    const hrefs = [];
    for (let k = 0; k < 8; k++) {
      await page.locator(`#chips .chip[data-k="${k}"]`).click();
      hrefs.push(...await page.locator("#dpanel .fnotes a").evaluateAll(
        (as) => as.map((a) => a.href)));
    }
    if (!hrefs.length || hrefs.some((h) => !ok.has(h))) {
      problems.push(`footnotes: ${hrefs}`);
    }
    await page.keyboard.press("Escape");
  }
  // the pointer is the fixture's, as YAML (template names shortened),
  // one line each, nothing wraps
  {
    const { parse } = await import("yaml");
    const f = JSON.parse(fs.readFileSync(path.join(root, "fixtures",
      "arcade-mid.json"), "utf8"));
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    await page.waitForFunction(() => document.querySelector(
      "#ptr .line span[style]"), null, { timeout: 30000 }).catch(() => {});
    // the header stays in view when the excerpt scrolls; Shiki's tokens;
    // no band but the step's
    const hdr = await page.evaluate(() => {
      const p = document.querySelector("#ptr");
      p.scrollTop = 200;
      const h = document.querySelector(".ptr .plabel").getBoundingClientRect();
      const r = p.closest(".ptr").getBoundingClientRect();
      const bands = [...document.querySelectorAll("#ptr .line:not(.on)")]
        .filter((l) => !/rgba\(0, 0, 0, 0\)|transparent/.test(
          getComputedStyle(l).backgroundColor)).length;
      return { inView: h.top >= r.top - 1 && h.bottom <= r.bottom,
        tokens: document.querySelectorAll("#ptr .line span[style]").length,
        bands };
    });
    if (!hdr.inView || !hdr.tokens || hdr.bands) {
      problems.push(`pointer view: ${JSON.stringify(hdr)}`);
    }
    const y = await page.evaluate(() => ({
      // (no line cut at the right: the excerpt fits its box)
      clipped: document.querySelector("#ptr").scrollWidth >
        document.querySelector("#ptr").clientWidth + 1,
      text: [...document.querySelectorAll("#ptr .line")].map((l) =>
        l.textContent).join("\n"),
      wraps: [...document.querySelectorAll("#ptr .line")].some((l) =>
        l.getClientRects().length > 1 || l.getBoundingClientRect().height >
        parseFloat(getComputedStyle(l).lineHeight) * 1.5),
      ids: document.querySelector("#ptr .pids")?.textContent ?? "" }));
    const types = f.contract.types;
    const nameOf = (n) => {
      const t = types[n];
      if (t.kind === "mapping") return `mapping(${types[t.contains.key.type
        .id].kind} => ${types[t.contains.value.type.id].definition.name})`;
      return t.definition?.name ?? t.kind;
    };
    const norm = (v, ren = true) => typeof v === "string" &&
      /^0x[0-9a-f]+$/i.test(v) ? Number(v) : Array.isArray(v)
      ? v.map((x) => norm(x, ren)) : v && typeof v === "object"
        ? Object.fromEntries(Object.entries(v).map(([k, x]) =>
          [k, k === "template" && ren ? nameOf(x) : norm(x, ren)])) : v;
    const want = { players: norm(f.contract.variables.find((v) =>
      v.identifier === "players").pointer) };
    for (const n of Object.keys(f.contract.pointers)) {
      if (!n.startsWith("t_array")) want[nameOf(n)] = norm(f.contract.pointers[n]);
    }
    const got = norm(parse(y.text), false);
    // a conditional's keys in the spec's order: if, then, else
    const order = ["if:", "then:", "else:"].map((k) => y.text.split("\n")
      .findIndex((l) => l.trim().replace(/^- /, "").startsWith(k)));
    if (!same(got, want) || y.wraps || y.clipped ||
      !y.ids.includes("t_array$") || order.some((x, k) => x < 0 ||
        (k && x < order[k - 1]))) {
      problems.push(`pointer yaml: ${y.wraps ? "wraps " : ""}${y.clipped
        ? "clipped " : ""}${order} ${!same(got, want) ? "differs " : ""}${
        JSON.stringify(got).slice(0, 300)}`);
    }
    await page.keyboard.press("Escape");
  }
  // a single value takes the rules on its path, with its entry in focus:
  // bob's plays: all but the string's rules (bob's plays alone at full
  // strength in the stats); carol's name: all but the stats
  w = await walk(`${B}.plays`);
  if (w.map((x) => x.cap.split(" ")[1]).join() !==
    "is,template,record,template,record,stats" ||
    !w[2].form.includes("0x3c44…93bc") || !w[4].form.startsWith("bob:") ||
    !same(w[5].full, { [rec]: range(12, 15).join() }) ||
    !same(w[5].lit, { [al]: stats, [rec]: stats, [cl0]: stats }) ||
    w.ctl !== 1) {
    problems.push(`replay bob's plays: ${JSON.stringify(w.map((x) =>
      [x.cap, x.full]))}`);
  }
  // after ✕ Exit: the resolved view, with the same entry button
  let st = await stepNow();
  if (!st.resolved || !(await how()).includes("▸ Show how it was found") ||
    await page.locator("#details.replaying").count()) {
    problems.push(`replay end: ${JSON.stringify(st)}`);
  }
  w = await walk(`${C}.name`);
  if (w.map((x) => x.cap.split(" ")[1]).join() !==
    "is,template,record,template,record,template,last" ||
    !w[6]?.cap.includes("form") || !w[4]?.form.startsWith("carol:") ||
    w.ctl !== 1) {
    problems.push(`replay carol's name: ${JSON.stringify(w.map((x) =>
      x.cap))}`);
  }
  // The bar: at rest, the entry; in a replay, tinted, "Replay", ⏮ ◀ ▶ ⏭
  // (each disabled at its end), the count, ✕ Exit. ▶ and ⏭ never exit;
  // only ✕ Exit and Escape do. Keys work from anywhere, also after a
  // mouse click; a double click on the entry does not skip a step
  await row(`${B}.plays`).click();
  const barNow = () => page.evaluate(() => {
    const b = document.querySelector("#details");
    const dis = (r) => b.querySelector(`button[data-r="${r}"]`)?.disabled;
    return { tint: b.classList.contains("replaying"),
      mode: b.querySelector(".rmode").textContent,
      count: b.querySelector(".rcount").textContent,
      off: ["first", "prev", "next", "last"].filter(dis).join(),
      exit: !!b.querySelector('button[data-r="exit"]'),
      start: b.querySelector('button[data-r="start"]')?.textContent };
  });
  let bs = await barNow();
  if (bs.tint || bs.mode || bs.exit || bs.start !== "▸ Show how it was found") {
    problems.push(`bar at rest: ${JSON.stringify(bs)}`);
  }
  await page.locator('#details button[data-r="start"]').dblclick();
  bs = await barNow();
  if (!bs.tint || bs.mode !== "Replay" || bs.count !== "1 / 6" ||
    bs.off !== "first,prev" || !bs.exit) {
    problems.push(`bar at step 1 (after a double click): ${JSON.stringify(bs)}`);
  }
  await page.locator('#details button[data-r="last"]').click();
  bs = await barNow();
  if (bs.count !== "6 / 6" || bs.off !== "next,last") {
    problems.push(`⏭: ${JSON.stringify(bs)}`);
  }
  // ▶ at the last step: disabled; → stays
  await page.keyboard.press("ArrowRight");
  bs = await barNow();
  if (bs.count !== "6 / 6" || !bs.tint) problems.push(`→ at the end: ${bs.count}`);
  await page.locator('#details button[data-r="first"]').click();
  if ((await barNow()).count !== "1 / 6") problems.push("⏮");
  // keys after a mouse click on ▶, and from anywhere (the focus moved)
  await page.locator('#details button[data-r="next"]').click();
  await page.keyboard.press("ArrowRight");
  if ((await barNow()).count !== "3 / 6") {
    problems.push(`→ after a click: ${(await barNow()).count}`);
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.press("Home");
  if ((await barNow()).count !== "1 / 6") problems.push("Home");
  await page.keyboard.press("End");
  if ((await barNow()).count !== "6 / 6") problems.push("End");
  // ✕ Exit
  await page.locator('#details button[data-r="exit"]').click();
  if ((await barNow()).tint) problems.push("✕ Exit did not exit");
  // a chip jumps (and a click on it stays in the replay)
  await page.locator('#details button[data-r="start"]').click();
  await page.locator('#chips .chip[data-k="1"]').click();
  st = await stepNow();
  if (st.count !== "2 / 6") problems.push(`chip jump: ${st.count}`);
  await page.locator("#details").focus();
  await page.keyboard.press("ArrowLeft");
  st = await stepNow();
  if (st.count !== "1 / 6") problems.push(`←: ${st.count}`);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  st = await stepNow();
  if (st.count !== "3 / 6") problems.push(`→: ${st.count}`);
  await page.keyboard.press("Escape");
  st = await stepNow();
  if (!st.resolved || (await selected()).join() !== `${B}.plays`) {
    problems.push(`Escape in a replay: ${JSON.stringify(st)}`);
  }

  // a click that clears a selection shows the hover of what is under
  // the pointer at once, with no mouse move: a row, and a byte
  {
    await page.evaluate(() => window.select("mid", { sel: null }));
    const lit = () => page.evaluate(() => ({
      row: document.querySelector('#tree li[data-path="total"] > .row')
        .classList.contains("hl"),
      bytes: document.querySelectorAll("#panel .view:not([hidden]) .b.hl")
        .length, sel: !!document.querySelector("#tree .row.sel") }));
    await row("total").click();
    await row("total").click();
    const r = await lit();
    const cell = page.locator(`#panel .view:not([hidden]) .wrow[data-slot="0x${
      "0".repeat(63)}2"] .b[data-i="31"]`);
    await cell.click();
    await cell.click();
    const b = await lit();
    if (!r.row || r.bytes !== 16 || r.sel || !b.row || b.bytes !== 16 ||
      b.sel) {
      problems.push(`hover after a clearing click: ${JSON.stringify([r, b])}`);
    }
    await page.mouse.move(1, 1);
  }
  // brown caps and edges only on the selected thing: a hover is the
  // plain fill
  {
    await page.evaluate(() => window.select("mid", { sel: null }));
    const caps = () => page.evaluate(() => {
      const bs = [...document.querySelectorAll(
        "#panel .view:not([hidden]) .b.hl")];
      const v = document.querySelector(
        '#tree li[data-path="roster[0]"] > .row .val');
      return { lit: bs.length, capped: bs.filter((b) =>
        getComputedStyle(b).boxShadow !== "none").length,
      val: getComputedStyle(v).borderTopColor };
    });
    await row("roster[0]").hover();
    const h = await caps();
    await row("roster[0]").click();
    await page.mouse.move(1, 1);
    const s = await caps();
    const clear = /rgba\(0, 0, 0, 0\)|transparent/;
    if (h.lit !== 20 || h.capped || !clear.test(h.val) || s.lit !== 20 ||
      s.capped !== 20 || clear.test(s.val)) {
      problems.push(`caps: hover ${JSON.stringify(h)}, selected ${
        JSON.stringify(s)}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
  }
  // a hover draws no border or outline on any byte (a value's row, its
  // bytes, a slot's address)
  {
    await page.evaluate(() => window.select("mid", { sel: null }));
    const lines = () => page.evaluate(() => [...document.querySelectorAll(
      "#panel .view:not([hidden]) .b")].filter((b) => {
      const cs = [getComputedStyle(b), getComputedStyle(b, "::after")];
      return cs.some((c) => ["Top", "Right", "Bottom", "Left"].some((k) =>
        parseFloat(c[`border${k}Width`]) > 0 && c[`border${k}Style`] !==
        "none") || (c.outlineStyle !== "none" &&
        parseFloat(c.outlineWidth) > 0)) || (b.classList.contains("hl") &&
        cs[0].boxShadow !== "none");
    }).length);
    const bad = [];
    for (const p of ["total", "roster[0]", `${C}.plays`, "motd"]) {
      await row(p).hover();
      if (await lines()) bad.push(p);
    }
    const two = `#panel .view:not([hidden]) .wrow[data-slot="0x${
      "0".repeat(63)}2"]`;
    await page.locator(`${two} .b[data-i="20"]`).hover();
    if (await lines()) bad.push("a byte of total");
    await page.locator(`${two} .addr`).hover();
    if (await lines()) bad.push("slot 2's address");
    if (bad.length) problems.push(`hover lines: ${bad}`);
    await page.mouse.move(1, 1);
  }
  // selecting alice's entry, then players (no mouse move): alice's rows
  // are one merged block at once
  {
    await page.evaluate((x) => window.select("mid", { sel: x }), A);
    await row("players").click();
    const m = await page.evaluate((a) => {
      const li = document.querySelector(`#tree li[data-path="${a}"]`);
      return li.classList.contains("blk");
    }, A);
    if (!m) problems.push("alice's rows not one block after players");
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
  }
  // every slot popover sits the same: its arrow's tip the same distance
  // from its address's tint (players and roster[1] selected, a replay
  // step), the mapping's root slot included
  {
    const gaps = () => page.evaluate(() => [...document.querySelectorAll(
      "#panel .view:not([hidden]) .pop")].map((p) => {
      const a = p.parentElement;
      const ar = a.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      const bf = getComputedStyle(a, "::before");
      const arrow = getComputedStyle(p, "::after");
      const ah = parseFloat(arrow.borderTopWidth) +
        parseFloat(arrow.borderBottomWidth);
      const under = p.classList.contains("under");
      const tip = under ? pr.top - ah : pr.bottom + ah;
      return [p.textContent.slice(0, 12), Math.round(under
        ? tip - (ar.bottom - (parseFloat(bf.bottom) || 0))
        : ar.top + (parseFloat(bf.top) || 0) - tip)];
    }));
    const seen = [];
    for (const x of ["players", "roster[1]"]) {
      await page.evaluate((y) => window.select("mid", { sel: y }), x);
      await page.mouse.move(1, 1);
      seen.push(...await gaps());
    }
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    await page.locator('#details button[data-r="start"]').click();
    await page.locator('#chips .chip[data-k="1"]').click();
    await page.mouse.move(1, 1);
    seen.push(...await gaps());
    await page.keyboard.press("Escape");
    const ds = seen.map((x) => x[1]);
    if (seen.length < 8 || Math.max(...ds) - Math.min(...ds) > 1 ||
      !seen.some((x) => x[0].startsWith("slot 3"))) {
      problems.push(`popover gaps: ${JSON.stringify(seen)}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
  }
  // players' own slot, 3, which holds none of its data, links to
  // players both ways: hovering it lights the players row, a click
  // selects players; hovering the players row tints slot 3's gutter
  {
    await page.evaluate(() => window.select("mid", { sel: null }));
    const r3 = `#panel .view:not([hidden]) .wrow[data-slot="0x${
      "0".repeat(63)}3"]`;
    const prow = () => page.evaluate(() => document.querySelector(
      '#tree li[data-path="players"] > .row').classList.contains("hl"));
    await page.locator(`${r3} .b[data-i="10"]`).hover();
    const viaByte = await prow();
    await page.locator(`${r3} > .addr`).hover();
    const viaAddr = await prow();
    await row("players").hover();
    const gut = await page.locator(`${r3}.gut`).count();
    await page.locator(`${r3} .b[data-i="10"]`).click();
    const sel = (await selected()).join();
    if (!viaByte || !viaAddr || !gut || sel !== "players") {
      problems.push(`slot 3 <-> players: ${JSON.stringify({ viaByte,
        viaAddr, gut, sel })}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
    await page.mouse.move(1, 1);
  }
  // with a composite selected, its children's blocks are the targets: a
  // click on alice's score (or her bytes) selects alice's entry; with
  // alice selected, score selects score; with nothing selected, score
  {
    const sc = `#panel .view:not([hidden]) .b[data-owners="${A}.score"]`;
    const at = async (sel, click) => {
      await page.evaluate((x) => window.select("mid", { sel: x }), sel);
      await click();
      return (await selected()).join();
    };
    const gut = `#panel .view:not([hidden]) .wrow:has(.b[data-owners="${
      A}.score"]) > .addr`;
    const got = [
      await at("players", () => row(`${A}.score`).click()),
      await at("players", () => page.locator(sc).first().click()),
      await at("players", () => page.locator(gut).first().click()),
      await at(A, () => row(`${A}.score`).click()),
      await at(null, () => row(`${A}.score`).click())];
    if (got.join() !== [A, A, A, `${A}.score`, `${A}.score`].join()) {
      problems.push(`child blocks: ${got}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
    await page.mouse.move(1, 1);
  }
  // groups expand and collapse by their chevron (a button at the right
  // end of the row; the row still selects): by click and by keys, with
  // aria-expanded; a collapsed selection lights its bytes all yellow; a
  // click on a hidden value's bytes opens the path to it; the dump
  // never moves
  {
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    await page.mouse.move(1, 1);
    const chev = (p) => page.locator(`#tree li[data-path="${p}"] > .chev`);
    const st = () => page.evaluate(() => {
      const li = document.querySelector('#tree li[data-path="players"]');
      return { shut: li.classList.contains("collapsed"),
        aria: li.querySelector(":scope > .chev").getAttribute("aria-expanded"),
        kids: li.querySelector(":scope > ul").offsetHeight,
        hues: [...document.querySelectorAll(
          "#panel .view:not([hidden]) .b.hl")].filter((b) =>
          /\bpk\d/.test(b.className)).length,
        lit: document.querySelectorAll("#panel .view:not([hidden]) .b.hl")
          .length,
        sel: document.querySelector("#tree .row.sel")?.parentElement
          .dataset.path,
        dump: JSON.stringify([...document.querySelectorAll(
          "#panel .view:not([hidden]) .wrow")].map((r) => {
          const b = r.getBoundingClientRect();
          return [b.left, b.top + scrollY].map(Math.round);
        })) };
    });
    const s0 = await st();
    await chev("players").click();
    await page.mouse.move(1, 1);
    const s1 = await st();
    await chev("players").focus();
    await page.keyboard.press("Enter");
    const s2 = await st();
    await page.keyboard.press(" ");
    const s3 = await st();
    // (closed: a click on alice's score bytes selects it and opens the
    // path to it)
    await page.evaluate(() => window.select("mid", { sel: null }));
    await page.locator(`#panel .view:not([hidden]) .b[data-owners="${A}.score"]`)
      .first().click();
    const s4 = await st();
    const ok = !s0.shut && s0.aria === "true" && s0.hues > 0 &&
      s1.shut && s1.aria === "false" && !s1.kids && !s1.hues &&
      s1.lit === s0.lit && s1.sel === "players" && s1.dump === s0.dump &&
      !s2.shut && s2.aria === "true" && s2.hues > 0 && s3.shut &&
      !s4.shut && s4.sel === `${A}.score` && s4.dump === s0.dump;
    // the chevron: a visible box, its right edge on the values' right
    // edge; the tree's content as wide with a scrollbar as without
    const geo = await page.evaluate(() => {
      const c = document.querySelector('#tree li[data-path="players"] > .chev');
      const v = document.querySelector('#tree li[data-path="total"] .val');
      const pad = parseFloat(getComputedStyle(v).paddingRight) +
        parseFloat(getComputedStyle(v).borderRightWidth);
      const cs = getComputedStyle(c);
      return { edge: Math.abs(c.getBoundingClientRect().right -
        (v.getBoundingClientRect().right - pad)),
      box: true };
    });
    const widths = [];
    for (const open of [false, true]) {
      await page.evaluate((o) => {
        for (const b of document.querySelectorAll("#tree .chev")) {
          if ((b.getAttribute("aria-expanded") === "true") !== o) b.click();
        }
      }, open);
      widths.push(await page.evaluate(() => [
        document.querySelector("#tree").clientWidth,
        document.querySelector("#tree").scrollHeight >
          document.querySelector("#tree").clientHeight]));
    }
    // the chevron at rest: plain (no box); a box on hover and focus,
    // about 1em, its target at least 28 px, centred on the row's name.
    // The row's geometry is one in every state: rest, hover, selected,
    // focused
    {
      await page.evaluate(() => window.select("mid", { sel: null }));
      const g = () => page.evaluate(() => {
        const li = document.querySelector('#tree li[data-path="players"]');
        const c = li.querySelector(":scope > .chev");
        const r = (e) => [...Object.values(e.getBoundingClientRect()
          .toJSON())].slice(0, 4).map((x) => Math.round(x * 2) / 2);
        const cs = getComputedStyle(c);
        const svg = c.querySelector("svg").getBoundingClientRect();
        const name = li.querySelector(":scope > .row .name")
          .getBoundingClientRect();
        const cb = c.getBoundingClientRect();
        const rr = li.querySelector(":scope > .row").getBoundingClientRect();
        void name;
        return { geo: JSON.stringify([r(li.querySelector(":scope > .row")),
          r(li.querySelector(":scope > .row .sum")), r(c)]),
        box: cs.borderTopColor !== "rgba(0, 0, 0, 0)" &&
          cs.borderTopColor !== "transparent",
        size: [svg.width, cb.width, cb.height],
        centre: Math.abs(cb.top + cb.height / 2 - (rr.top + rr.height / 2)),
        inside: cb.top >= rr.top - 0.5 && cb.bottom <= rr.bottom + 0.5 };
      });
      await page.mouse.move(1, 1);
      const rest = await g();
      await row("players").hover();
      const hov = await g();
      await chev("players").hover();
      const chov = await g();
      await page.mouse.move(1, 1);
      await row("players").click();
      await page.mouse.move(1, 1);
      const act = await g();
      // (focus after a key: the keyboard's focus)
      await row("players").focus();
      await page.keyboard.press("Tab");
      const foc = await g();
      const fs = parseFloat(await page.evaluate(() => getComputedStyle(
        document.querySelector("#tree .name")).fontSize));
      if (rest.box || !chov.box || !foc.box ||
        [rest, hov, chov, act, foc].some((x) => x.centre > 1 || !x.inside) ||
        rest.size[0] < fs * 0.8 || rest.size[1] < 28 || rest.size[2] < 28 ||
        [hov, chov, act, foc].some((x) => x.geo !== rest.geo)) {
        problems.push(`chevron states: ${JSON.stringify({ rest, hov, chov,
          act, foc })}`);
      }
      await page.evaluate(() => window.select("mid", { sel: "players" }));
    }
    // one fill box for every row kind in every state: a collapsed and an
    // expanded top-level group, a nested group, a leaf; at rest, hovered,
    // selected, focused. The fill: the row's, or its block's (a hovered
    // open group lights its rows as one block, which starts at the
    // row's top and keeps its left and right edges)
    {
      const kinds = ["players", "roster", A, "total"];
      const fill = (p) => page.evaluate((x) => {
        const li = document.querySelector(`#tree li[data-path="${x}"]`);
        const r = li.querySelector(":scope > .row").getBoundingClientRect();
        let f = [r.top, r.bottom, r.left, r.right];
        if (li.classList.contains("blk")) {
          const l = li.getBoundingClientRect();
          const b = getComputedStyle(li, "::before");
          f = [l.top + parseFloat(b.top), li.querySelector(":scope > ul")
            ? null : l.bottom - parseFloat(b.bottom), l.left, l.right];
        }
        return { row: [r.top, r.height, r.left, r.width].map((v) =>
          Math.round(v * 2) / 2).join(), fill: f.map((v) => v === null ? v
          : Math.round(v * 2) / 2) };
      }, p);
      const bad = [];
      for (const k of kinds) {
        await page.evaluate(() => window.select("mid", { sel: null }));
        // (players: collapsed)
        if (k === "players") await chev("players").click();
        await page.mouse.move(1, 1);
        const states = [await fill(k)];
        await row(k).hover();
        states.push(await fill(k));
        await row(k).click();
        await page.mouse.move(1, 1);
        states.push(await fill(k));
        await row(k).focus();
        states.push(await fill(k));
        if (k === "players") {
          await page.evaluate(() => window.select("mid", { sel: null }));
          await chev("players").click();
        }
        const [r0] = states;
        for (const x of states) {
          if (x.row !== r0.row || x.fill[0] !== r0.fill[0] ||
            x.fill[2] !== r0.fill[2] || x.fill[3] !== r0.fill[3] ||
            (x.fill[1] !== null && x.fill[1] !== r0.fill[1])) {
            bad.push(`${k.slice(0, 12)} ${JSON.stringify(x)} vs ${
              JSON.stringify(r0)}`);
          }
        }
      }
      if (bad.length) problems.push(`row geometry: ${bad.slice(0, 3)}`);
      // (pointing at a chevron points at its row: the row's hover, its
      // bytes lit)
      await page.evaluate(() => window.select("mid", { sel: null }));
      await chev("roster").hover();
      const ch = await page.evaluate(() => [document.querySelector(
        '#tree li[data-path="roster"] > .row').classList.contains("hl"),
      document.querySelectorAll("#panel .view:not([hidden]) .b.hl").length]);
      if (!ch[0] || ch[1] !== 92) problems.push(`chevron hover: ${ch}`);
      // (roster collapsed: pointing at roster[0]'s bytes lights the row
      // that shows it, roster's)
      await chev("roster").click();
      await page.locator('#panel .view:not([hidden]) .b[data-owners="roster[0]"]')
        .first().hover();
      const anc = await page.evaluate(() => document.querySelector(
        '#tree li[data-path="roster"] > .row').classList.contains("hl"));
      await chev("roster").click();
      if (!anc) problems.push("a hidden row's ancestor not lit");
      await page.evaluate(() => window.select("mid", { sel: "players" }));
    }
    // (an inner group keeps its state when its parent closes and opens)
    await chev(A).click();
    await chev("players").click();
    await chev("players").click();
    const inner = await page.evaluate((x) => x.map((p) =>
      document.querySelector(`#tree li[data-path="${p}"]`).classList
        .contains("collapsed")), [A, B]);
    if (inner.join() !== "true,false") problems.push(`inner state: ${inner}`);
    await chev(A).click();
    if (geo.edge > 1 || !geo.box || widths[0][0] !== widths[1][0] ||
      widths[0][1] === widths[1][1]) {
      problems.push(`chevron: ${JSON.stringify({ geo, widths })}`);
    }
    if (!ok) {
      problems.push(`expand/collapse: ${JSON.stringify([s0, s1, s2, s3, s4]
        .map(({ dump, ...x }) => ({ ...x, dump: dump === s0.dump })))}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
    await page.mouse.move(1, 1);
  }
  // a lit row out of the tree's view: a pill on the box's edge, down or
  // up, with its path; a click scrolls the tree to it; nothing in the
  // pane moves
  {
    await page.evaluate(() => window.select("mid", { sel: null }));
    await page.evaluate(() => {
      document.querySelector("#tree").style.height = "260px";
      document.querySelector("#tree").scrollTop = 0;
    });
    const tops = () => page.evaluate(() => JSON.stringify([
      ...document.querySelectorAll("#tree li > .row")].map((r) =>
      r.offsetTop)));
    const pill = (w) => page.evaluate((x) => {
      const p = document.querySelector(`#edge-${x}`);
      const t = document.querySelector("#tree").getBoundingClientRect();
      const r = p.getBoundingClientRect();
      return !p.classList.contains("on") ? null : {
        text: p.textContent.trim(), label: p.getAttribute("aria-label"),
        title: p.hasAttribute("title"), inside: r.top >= t.top - 1 &&
          r.bottom <= t.bottom + 1,
        bg: getComputedStyle(p).backgroundColor };
    }, w);
    const t0 = await tops();
    const cp = `#panel .view:not([hidden]) .b[data-owners="${C}.plays"]`;
    await page.locator(cp).first().hover();
    const down = await pill("down");
    const t1 = await tops();
    await page.locator("#edge-down").click();
    await page.waitForTimeout(100);
    const inView = await page.evaluate((c) => {
      const r = document.querySelector(`#tree li[data-path="${c}"] > .row`)
        .getBoundingClientRect();
      const t = document.querySelector("#tree").getBoundingClientRect();
      return r.top >= t.top - 1 && r.bottom <= t.bottom + 1;
    }, `${C}.plays`);
    // (upward: the tree scrolled to its end, a roster byte pointed at)
    await page.evaluate(() => {
      const t = document.querySelector("#tree");
      t.scrollTop = t.scrollHeight;
    });
    await page.locator(`#panel .view:not([hidden]) .b[data-owners="roster[0]"]`)
      .first().hover();
    const up = await pill("up");
    const mark = await page.evaluate(() => {
      const e = document.createElement("i");
      e.style.background = "var(--mark)";
      document.body.append(e);
      const c = getComputedStyle(e).backgroundColor;
      e.remove();
      return c;
    });
    if (!down || down.text || down.title || down.bg !== mark ||
      !down.label.includes(`to ${C}.plays`) ||
      !down.inside || t1 !== t0 || !inView ||
      !up || up.text || !up.label.includes("to roster[0]") || !up.inside) {
      problems.push(`edge pills: ${JSON.stringify({ down, up, inView,
        moved: t1 !== t0 })}`);
    }
    await page.mouse.move(1, 1);
    await page.evaluate(() => {
      document.querySelector("#tree").style.height = "";
      window.dispatchEvent(new Event("resize"));
    });
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
  }
  // each dump's row fills its box (within 2%), not wrapping: 32 bytes a
  // line at 1280, 1440 and 1920 wide (16 on a phone: below)
  const fill = (pg) => pg.evaluate(() => [...document.querySelectorAll(
    ".dump")].filter((d) => d.clientWidth && d.querySelector(
    ".view:not([hidden]) .rows > .wrow")).map((d) => {
    const row = d.querySelector(".view:not([hidden]) .rows > .wrow");
    const rows = row.closest(".rows");
    const cs = getComputedStyle(rows);
    const used = row.querySelector(".word").getBoundingClientRect().right +
      parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth) -
      rows.getBoundingClientRect().left;
    const word = row.querySelector(".word").getBoundingClientRect();
    return { id: d.firstElementChild.id, r: used / d.clientWidth,
      lines: Math.round(word.height / parseFloat(getComputedStyle(
        row.querySelector(".bytes")).lineHeight)) };
  }));
  {
    const bad = [];
    for (const w of [1280, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.waitForTimeout(100);
      for (const x of await fill(page)) {
        if (x.r < 0.98 || x.r > 1.001 || x.lines !== 1) {
          bad.push(`${w} ${x.id} ${x.r.toFixed(3)} ${x.lines}`);
        }
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    if (bad.length) problems.push(`dump fit: ${bad}`);
  }
  // a slot's label: how it is found, then what it holds, by name, in
  // byte order; each name in its bytes' colour when the colours tell
  // values apart, else plain; a record's run: its owner's path
  {
    const pops = () => page.evaluate(() => [...document.querySelectorAll(
      "#panel .view:not([hidden]) .pop:not(.kept)")].map((p) => ({
      text: p.textContent, ks: [...p.querySelectorAll(".pname")].map((n) =>
        n.className.match(/pk\d/)?.[0] ?? "") })));
    const got = {};
    for (const x of ["roster", "total", "players"]) {
      await page.evaluate((y) => window.select("mid", { sel: y }), x);
      await page.mouse.move(1, 1);
      got[x] = await pops();
    }
    await page.locator('#details button[data-r="start"]').click();
    await page.locator(`#chips .chip[data-k="${P.fields}"]`).click();
    await page.mouse.move(1, 1);
    got.fields = await pops();
    // (the colours of alice's first three fields' bytes, left to right)
    const fk = await page.evaluate((a) => ["lastBlock", "hitCount", "plays"]
      .map((f) => document.querySelector(`#panel .view:not([hidden]) ` +
        `.b.hl[data-owners="${a}.${f}"]`)?.className.match(/pk\d/)?.[0]), A);
    await page.keyboard.press("Escape");
    const t = (x) => got[x].map((p) => p.text);
    const alice = got.fields.find((p) => p.text.startsWith(
      "keccak(0x7099…79c8, slot 3) :"));
    if (!t("roster").includes("slot 0 : length") ||
      !t("total").includes("slot 2 : rounds · total") ||
      got.total[0]?.ks.some(Boolean) ||
      !t("players").includes(
        "keccak(0x7099…79c8, slot 3) : players[0x7099…79c8], 2 slots") ||
      alice?.text !== "keccak(0x7099…79c8, slot 3) : lastBlock · hitCount · " +
        "plays +3" || alice.ks.join() !== fk.join() || !fk.every(Boolean) ||
      new Set(fk).size !== 3) {
      problems.push(`slot labels: ${JSON.stringify({ got, fk })}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), `${B}.plays`);
  }
  // while it replays, pointing elsewhere changes nothing
  await page.locator('#details button[data-r="start"]').click();
  await page.mouse.move(1, 1);
  const pick3 = ({ cap, lit, chips }) => JSON.stringify({ cap, lit, chips });
  const at0 = pick3(await stepNow());
  await row("total").hover();
  if (pick3(await stepNow()) !== at0) {
    problems.push("replay: a hover changed the step");
  }
  await page.keyboard.press("Escape");
  // the roster's item; a value with no template
  // roster: three rules: declared (slot 0's gutter only), the length
  // (slot 0's bytes; the length region's line), the items (all three,
  // at once; the define and the list, whose count reads the length)
  w = await walk("roster");
  const rwant = [
    ["roster is declared at slot 0", {}, "slot 0", "in: { template: " +
      "address[] }"],
    ["The template address[] takes slot = 0", {}, "slot 0", "expect: [slot]"],
    ["slot 0 holds the length: 3", { "slot 0": "all" }, "",
      "- { name: length, location: storage, slot: slot }"],
    ["The items start at keccak(0), one slot each, for length items",
      roster, "", "count: { $read: length }"]];
  if (w.length !== 4 || rwant.some(([cap, lit, gut, band], k) =>
    w[k].cap !== cap || !same(w[k].lit, lit) || w[k].gut.join() !== gut ||
    !w[k].ptr.includes(band) || (k === 2 && w[k].ptr.length !== 1)) ||
    w[2].form !== "length = 3" ||
    w[3].form !== "keccak256(0) = …e563; items 0…2 at + i") {
    problems.push(`replay roster: ${JSON.stringify(w.map((x) =>
      [x.cap, x.form, x.lit, x.gut, x.ptr]))}`);
  }
  // an item: the same rules, cut to it
  w = await walk("roster[1]");
  if (w.length !== 4 || !w[0].gut.includes("slot 0") ||
    !w[2].lit["slot 0"] || !w[3].lit["keccak(slot 0) + 1"]) {
    problems.push(`replay roster[1]: ${JSON.stringify(w.map((x) =>
      [x.cap, x.lit]))}`);
  }
  w = await walk("total");
  if (w.length !== 1 || !w[0].cap.startsWith("total is at slot 2") ||
    !same(w[0].lit, { "slot 2": range(16, 31).join() })) {
    problems.push(`replay total: ${JSON.stringify(w.map((x) =>
      [x.cap, x.lit]))}`);
  }
  await page.keyboard.press("Escape");
  // the dump and the tree are always shown: at rest, with a selection,
  // in a replay, in every scene
  for (const id of Object.keys(expected)) {
    const seen = [];
    await page.evaluate((x) => window.select(x, { sel: null }), id);
    const vis = () => page.evaluate(() => ["#panel .view:not([hidden]) .rows",
      "#tree"].every((q) => {
      const r = document.querySelector(q)?.getBoundingClientRect();
      return r && r.width > 50 && r.height > 50;
    }));
    seen.push(await vis());
    await page.evaluate((x) => window.select(x), id);
    seen.push(await vis());
    await page.evaluate(() => document.querySelector(
      '#details button[data-r="start"]')?.click());
    seen.push(await vis());
    await page.keyboard.press("Escape");
    if (!seen.every(Boolean)) problems.push(`${id}: dump or tree hidden ${seen}`);
  }
  // the keys come from roster, and are the trace's keys
  if (!(await page.evaluate(() => window.results.keysMatch ?? []))
    .every(Boolean)) problems.push("roster's keys differ from the trace's");
  // the blank row: players' own slot, 3, holds nothing
  if (await page.locator(`#panel .wrow[data-slot="0x${"0".repeat(63)}3"]`)
    .count() !== 2) problems.push("no row for slot 3");

  // Nothing moves: the dump's rows, the tree's rows, the bar, the chips
  // and the panel keep their boxes through a selection, a hover, a
  // replay and its end; the bar is one line; the panel is in view at
  // every step; the columns are equal and start at one height
  // Nothing moves on selecting or hovering; the panel appears under
  // the bar when a replay starts (the columns move down once) and goes
  // when it ends (they move back); while stepping, nothing moves. The
  // bar is one line; the panel is in view at every step
  const still = async (pg, tag) => {
    const boxes = () => pg.evaluate(() => JSON.stringify([
      ...document.querySelectorAll("#panel .view:not([hidden]) .rows > *, " +
        "#tree li > .row, #tree, #details, #details > .rctl, " +
        "#details > .rexit, #details > .rmode, #details > .rcount, " +
        "#dpanel:not([hidden]), #chips")]
      .map((e) => {
      const r = e.getBoundingClientRect();
      // (whole pixels: a 0.1 px change is subpixel rounding; page
      // coordinates; "t" for a tree row, which may scroll in its box)
      // ("s": the bar and the panel, stuck to the top of the window)
      return [e.matches("#tree li > .row") ? "t" : e.closest("#details, " +
        "#dpanel") ? "s" : "",
        ...[r.left, r.top + scrollY, r.width, r.height].map(Math.round)];
    }).filter((v) => v[3] || v[4])));
    const facts = () => pg.evaluate(() => {
      const bar = document.querySelector("#details");
      const lh = parseFloat(getComputedStyle(bar).fontSize) * 2.6;
      const dp = document.querySelector("#dpanel");
      const b = bar.getBoundingClientRect();
      const p = dp.getBoundingClientRect();
      return { bar: Math.abs(b.height - lh) < 1.5 &&
        [...bar.children].every((c) => c.getClientRects().length <= 1),
      // the panel: only in a replay, joined to the bar (one box: no gap,
      // the same edges, the same tint), in view at the scroll the entry
      // sets; in the page's flow (nothing sticky or fixed)
      panel: dp.hidden || (Math.abs(p.top - b.bottom) < 1 &&
        Math.abs(p.left - b.left) < 1 && Math.abs(p.width - b.width) < 1 &&
        getComputedStyle(dp).backgroundColor ===
          getComputedStyle(bar).backgroundColor &&
        getComputedStyle(bar).borderBottomLeftRadius === "0px" &&
        getComputedStyle(dp).borderTopLeftRadius === "0px" &&
        p.bottom <= innerHeight + 0.5) &&
        [bar, dp, dp.parentElement].every((e) =>
          !/sticky|fixed/.test(getComputedStyle(e).position)),
      shown: !dp.hidden };
    });
    await pg.evaluate(() => window.select("mid", { sel: null }));
    await pg.evaluate(() => window.scrollTo(0,
      document.querySelector("#details").offsetTop - 4));
    await pg.mouse.move(1, 1);
    const bad = [];
    const diff = (a, x) => {
      const [p0, p1] = [JSON.parse(a), JSON.parse(x)];
      const k = p0.findIndex((v, i) => JSON.stringify(v) !==
        JSON.stringify(p1[i]));
      return `#${k}/${p0.length} ${p0[k]} -> ${p1[k]}`;
    };
    const check = async (what, base, replaying) => {
      await pg.mouse.move(1, 1);
      const bx = await boxes();
      if (base && bx !== base) bad.push(`${what} moved ${diff(base, bx)}`);
      const f = await facts();
      if (!f.bar) bad.push(`${what}: bar not one line`);
      if (!f.panel) bad.push(`${what}: panel not under the bar`);
      if (f.shown !== replaying) bad.push(`${what}: panel ${f.shown}`);
      return bx;
    };
    // (clicks and hovers by events, so the browser does not scroll to the
    // tree, which comes after the dump on a phone)
    const tap = (q) => pg.evaluate((x) => document.querySelector(x).click(),
      q);
    const b0 = await check("rest", null, false);
    await tap('#tree li[data-path="players"] > .row');
    // (the tree may scroll inside itself to the selection: compare
    // without its rows)
    const noTree = (x) => JSON.stringify(JSON.parse(x).filter((v) =>
      v[0] !== "t"));
    const sel = await check("select", null, false);
    if (noTree(sel) !== noTree(b0)) bad.push(`select moved ${diff(b0, sel)}`);
    await pg.dispatchEvent(`#tree li[data-path="${A}.combo"] > .row`,
      "pointerover");
    if (await boxes() !== sel) bad.push("hover moved");
    await tap('#details button[data-r="start"]');
    // the bar at the top of the window, once the page has scrolled
    await pg.waitForTimeout(900);
    const top = await pg.evaluate(() => [document.querySelector("#details")
      .getBoundingClientRect().top, scrollY, document.querySelector(
      ".howread").getBoundingClientRect().bottom]);
    if (Math.abs(top[0]) > 2 || top[2] > 2) {
      bad.push(`entry: the bar at ${top[0]}, the line above at ${top[2]}`);
    }
    const s1 = await check("step 1", null, true);
    // (a click anywhere in the details does not leave the replay)
    for (const q of ["#ptr", "#dpanel", "#dtext .rcap", "#dpanel .fnotes"]) {
      await pg.evaluate((x) => {
        const e = document.querySelector(x);
        const r = e.getBoundingClientRect();
        e.dispatchEvent(new MouseEvent("click", { bubbles: true,
          clientX: r.right - 2, clientY: r.bottom - 2 }));
      }, q);
      if (!await pg.evaluate(() => document.querySelector("#details")
        .classList.contains("replaying"))) {
        bad.push(`a click on ${q} left the replay`);
        await tap('#details button[data-r="start"]');
      }
    }
    for (let k = 1; k < 8; k++) {
      await tap('#details button[data-r="next"]');
      const bx = await check(`step ${k + 1}`, null, true);
      if (await pg.evaluate(() => scrollY) !== top[1]) {
        bad.push(`step ${k + 1} scrolled the page`);
      }
      // the step's lines: one block each run, no gap; the text inset
      const yb = await pg.evaluate(() => {
        const ls = [...document.querySelectorAll("#ptr .line")];
        const out = [];
        ls.forEach((l, i) => {
          if (!l.classList.contains("on")) return;
          const n = ls[i + 1];
          if (n?.classList.contains("on") && Math.abs(
            n.getBoundingClientRect().top - l.getBoundingClientRect()
              .bottom) > 0.5) out.push("gap");
          const pad = parseFloat(getComputedStyle(l).paddingLeft);
          if (pad < parseFloat(getComputedStyle(l).fontSize) * 0.75) {
            out.push("no inset");
          }
        });
        return out;
      });
      if (yb.length) bad.push(`step ${k + 1}: yaml ${yb}`);
      if (noTree(bx) !== noTree(s1)) {
        bad.push(`step ${k + 1} moved ${diff(s1, bx)}`);
      }
    }
    await tap('#details button[data-r="exit"]');
    const ex = await check("exit", null, false);
    // (back where it was: all but what is stuck to the window's top)
    const flow = (x) => JSON.stringify(JSON.parse(x).filter((v) =>
      !v[0]));
    if (flow(ex) !== flow(sel)) bad.push(`exit moved ${diff(sel, ex)}`);
    await tap('#tree li[data-path="players"] > .row');
    if (bad.length) problems.push(`${tag}: ${bad.slice(0, 4)}`);
  };
  await still(page, "1440");
  // at every step of players' replay, nothing covers a lit row (the
  // panel is in the page's flow: nothing overlays the dump); and the
  // panel's parts keep to their own room
  const fitsInView = async (pg, tag) => {
    await pg.evaluate(() => window.select("mid", { sel: "players" }));
    await pg.evaluate(() => document.querySelector(
      '#details button[data-r="start"]').click());
    const bad = [];
    for (let k = 0; k < 8; k++) {
      await pg.evaluate((x) => document.querySelector(
        `#chips .chip[data-k="${x}"]`).click(), k);
      const covered = [];
      const rows = await pg.evaluate(() => [...document.querySelectorAll(
        "#panel .view:not([hidden]) .wrow")].filter((r) =>
        r.querySelector(".b.hl")).map((r) => r.dataset.slot));
      for (const sl of rows) {
        const hit = await pg.evaluate((x) => {
          const c = document.querySelector(`#panel .view:not([hidden]) ` +
            `.wrow[data-slot="${x}"] .b.hl`);
          c.scrollIntoView({ block: "center" });
          const r = c.getBoundingClientRect();
          const e = document.elementFromPoint(r.left + r.width / 2,
            r.top + r.height / 2);
          return e === c || c.contains(e);
        }, sl);
        if (!hit) covered.push(sl.slice(-4));
      }
      if (covered.length) bad.push(`step ${k + 1}: covered ${covered}`);
      const f = await pg.evaluate(() => {
        const dp = document.querySelector("#dpanel");
        // the panel's parts: each within its room, none on another
        const parts = [...dp.querySelectorAll(".rcap, .rform, .rsrc, " +
          ".fnotes, .dpick, .chips, .ptrscroll")].filter((e) => e.offsetHeight);
        const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right -
          0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        const over = parts.filter((e) => !e.matches(".chips, .ptrscroll") &&
          e.scrollHeight > e.clientHeight + 1).map((e) => e.className);
        const rs = parts.map((e) => e.getBoundingClientRect());
        const box = dp.getBoundingClientRect();
        rs.forEach((r, i) => {
          if (r.bottom > box.bottom + 0.5) over.push(`${parts[i].className} out`);
          rs.slice(i + 1).forEach((q, j) => {
            if (hit(r, q)) over.push(`${parts[i].className} on ${
              parts[i + 1 + j].className}`);
          });
        });
        return { over };
      });
      if (f.over.length) bad.push(`step ${k + 1}: ${f.over}`);
    }
    await pg.keyboard.press("Escape");
    if (bad.length) problems.push(`${tag}: ${bad.slice(0, 4)}`);
  };
  await fitsInView(page, "1440 view");
  // the entry and the exit: the details unfold under the bar (they reach
  // their full height) and fold back into it; with reduced motion, at
  // once. While they move, the replay takes no step
  {
    const full = () => page.evaluate(() => {
      const w = document.querySelector("#dwrap").getBoundingClientRect();
      const d = document.querySelector("#dpanel");
      return { wrap: Math.round(w.height), panel: d.hidden ? 0
        : Math.round(d.getBoundingClientRect().height),
      replaying: document.querySelector("#details").classList
        .contains("replaying"),
      count: document.querySelector("#details .rcount").textContent };
    });
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    // (reduced motion: at once)
    await page.locator('#details button[data-r="start"]').click();
    const r0 = await full();
    await page.keyboard.press("Escape");
    const r1 = await full();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator('#details button[data-r="start"]').click();
    await page.keyboard.press("ArrowRight");
    const a0 = await full();
    await page.waitForTimeout(700);
    const a1 = await full();
    await page.keyboard.press("Escape");
    const a2 = await full();
    await page.waitForTimeout(700);
    const a3 = await full();
    await page.emulateMedia({ reducedMotion: "reduce" });
    if (!r0.panel || r0.wrap !== r0.panel || r1.wrap || r1.replaying ||
      a0.wrap >= a0.panel || a0.count !== "1 / 8" ||
      a1.wrap !== a1.panel || !a1.panel || !a2.replaying ||
      a3.wrap || a3.replaying) {
      problems.push(`unfold: ${JSON.stringify([r0, r1, a0, a1, a2, a3])}`);
    }
  }
  // names from the code in monospace; the tree as tall as the dump,
  // scrolled inside to the selection; a struct's "7 fields"
  {
    await page.evaluate((x) => window.select("mid", { sel: x }), A);
    const m = await page.evaluate(() => {
      const mono = (e) => e && /mono|Menlo|Courier/i.test(
        getComputedStyle(e).fontFamily);
      const sel = document.querySelector("#tree .row.sel");
      const t = document.querySelector("#tree").getBoundingClientRect();
      const r = sel.getBoundingClientRect();
      const d = document.querySelector("#dump").getBoundingClientRect();
      return { names: [...document.querySelectorAll("#tree .name")]
        .every(mono), bar: mono(document.querySelector("#details .rsel code")),
      type: !mono(document.querySelector("#tree .type")),
      height: Math.abs(t.bottom - d.bottom) <= 1,
      inView: r.top >= t.top - 1 && r.bottom <= t.bottom + 1,
      fields: document.querySelector("#details").textContent
        .includes("7 fields") };
    });
    await page.locator('#details button[data-r="start"]').click();
    m.cap = await page.evaluate(() => [...document.querySelectorAll(
      "#dpanel .rcap code.id")].every((c) => /mono|Menlo/i.test(
      getComputedStyle(c).fontFamily)) && !!document.querySelector(
      "#dpanel .rcap code.id"));
    await page.keyboard.press("Escape");
    if (!Object.values(m).every(Boolean)) {
      problems.push(`names, tree, words: ${JSON.stringify(m)}`);
    }
    await page.evaluate(() => window.select("mid", { sel: null }));
  }
  // equal columns, the first rows at one height, in every scene
  for (const id of Object.keys(expected)) {
    await scene(id);
    const c = await page.evaluate(() => {
      scrollTo(0, 0);
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      return [r(".scols .words").width, r(".scols .storage").width,
        r("#panel .view:not([hidden]) .rows > *").top,
        r("#tree li .row").top];
    });
    if (Math.abs(c[0] - c[1]) > 1 || Math.abs(c[2] - c[3]) > 1) {
      problems.push(`${id} columns: ${c}`);
    }
  }
  // combo: its source mark
  await scene("alice");
  await row(`${A}.combo`).click();
  // (marked in the contract's source at the top, the one source pane)
  const mark = (await page.locator("#contract-src .line.decl")
    .allTextContents()).join("\n");
  if (await page.locator("pre.src:not(#memory *)").count() !== 1) {
    problems.push("more than one source pane");
  }
  if (!mark.includes("struct Player")) problems.push(`mark: ${mark}`);
  if (name === "chromium") {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => window.scrollTo(0,
      document.querySelector(".cols").offsetTop - 8));
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("desktop-dark.png") });
    await page.emulateMedia({ colorScheme: "light" });
  }
  let text;

  // The mode: Before or After shows that dump only, and the derivation
  // and the tree follow it (After by default)
  const views = () => page.locator("#panel .view").evaluateAll((vs) =>
    vs.filter((v) => !v.hidden && v.offsetHeight).map((v) =>
      v.dataset.side).join());
  // (the box gives both states; a replay runs in the state shown)
  await row(`${A}.score`).click();
  for (const [m, val] of [["before", "30"], ["after", "60"]]) {
    await setMode(m);
    const v = await views();
    const box = await how();
    const shownVal = await row(`${A}.score`)
      .locator(".val > span:first-child").innerText();
    if (v !== m) problems.push(`mode ${m}: views ${v}`);
    if (!box.includes(`= ${val} (${m})`) || !box.includes(`(${m ===
      "after" ? "before: 30" : "after: 60"})`)) {
      problems.push(`mode ${m}: box ${box}`);
    }
    await page.locator('#details button[data-r="start"]').click();
    await page.locator('#details button[data-r="next"]').click();
    await page.locator('#details button[data-r="next"]').click();
    const sideLit = await page.evaluate(() => [...new Set([...document
      .querySelectorAll("#panel .b.hl")].map((c) =>
      c.closest(".word").dataset.side))].join());
    if (sideLit !== m) problems.push(`mode ${m}: replay lit ${sideLit}`);
    await page.keyboard.press("Escape");
    if (shownVal.trim() !== val) {
      problems.push(`mode ${m}: tree shows ${shownVal}`);
    }
  }

  // The tree's cards: none at rest; a lit changed value gets one with
  // the other state's value (score: "after 60" under it in Before,
  // "before 30" over it in After); an unchanged one gets none
  const tins = () => page.evaluate(() => [...document.querySelectorAll(
    "#tree .tcard")].map((c) => {
    const r = c.closest("li").querySelector(":scope > .row")
      .getBoundingClientRect();
    const b = c.getBoundingClientRect();
    return { path: c.closest("li").dataset.path, text: c.textContent,
      place: b.top >= r.bottom - 0.5 ? "under"
        : b.bottom <= r.top + 0.5 ? "over" : "on" };
  }));
  await page.keyboard.press("Escape");
  for (const [m, want, place] of [["before", "after60", "under"],
    ["after", "before30", "over"]]) {
    await setMode(m);
    await page.locator("h1").hover();
    if ((await tins()).length) problems.push(`${m}: tree card at rest`);
    await row(`${A}.score`).hover();
    const t = await tins();
    if (t.length !== 1 || t[0].path !== `${A}.score` ||
      t[0].text !== want || t[0].place !== place) {
      problems.push(`tree card ${m}: ${JSON.stringify(t)}`);
    }
    await row(`${B}.score`).hover();
    if ((await tins()).length) problems.push(`${m}: card for unchanged`);
  }
  // No card for what did not change: selecting an unchanged value gives
  // none, in the tree or the dump, in either state
  for (const p of ["roster[0]", `${A}.name`, `${B}.score`, "motd"]) {
    for (const m of ["before", "after"]) {
      await setMode(m);
      await row(p).click();
      await page.mouse.move(1, 1);
      const n = await page.locator("#tree .tcard, #panel .cmp").count();
      if (n) problems.push(`${p} ${m}: ${n} cards for an unchanged value`);
      await page.keyboard.press("Escape");
    }
  }
  // "show other state" off: no tree cards, no dump cards; highlight
  // still works
  await page.locator("#insets").uncheck();
  await row(`${A}.combo`).hover();
  if ((await tins()).length ||
    await page.locator("#panel .cmp").count() ||
    !Object.keys(await lit()).length) {
    problems.push("insets off: still shown, or nothing lit");
  }
  // (WebKit lets a page set its hash 100 times in 10 s; the page sets
  // a refused hash again later)
  if (!await page.waitForFunction(() => location.hash.includes("insets=0"),
    null, { timeout: 15000 }).then(() => true, () => false)) {
    problems.push("insets off: not in the hash");
  }
  await page.locator("#insets").check();
  await row(`${A}.score`).hover();
  if (!(await tins()).length ||
    !await page.waitForFunction(() => !location.hash.includes("insets="),
      null, { timeout: 15000 }).then(() => true, () => false)) {
    problems.push("insets on again");
  }
  await page.locator("h1").hover();

  // motd goes long -> short: the replay takes the long-string layout
  // before (its data at keccak(slot 1)) and the short one after
  await scene("motd");
  for (const [m, words, at] of [["after", "0x0a = 2 × 5", "slot 1"],
    ["before", "2 × 50 + 1 = 0x65", "keccak(slot 1)"]]) {
    await setMode(m);
    const nm = await page.locator(`#panel .view[data-side="${m}"] ` +
      ".wrow[data-name]").evaluateAll((rs) => Object.fromEntries(
      rs.map((r) => [r.dataset.slot, r.dataset.name])));
    const mw = await walk("motd", nm);
    const lits = mw.flatMap((x) => Object.keys(x.lit));
    if (!mw.some((x) => x.form.includes(words)) || !lits.includes(at) ||
      mw.ctl !== 1) {
      problems.push(`motd replay ${m}: ${JSON.stringify(mw)}`);
    }
    await page.keyboard.press("Escape");
  }
  await setMode("after");
  await page.keyboard.press("Escape");

  // The calldata of setMotd (motd scene only), by the ABI encoding: a
  // byte selects its part of m; a part lights its bytes
  {
    const { keccak256 } = (await import("js-sha3")).default;
    const cdl = () => page.evaluate(() => window.calldataResults);
    const shownCd = await page.evaluate(() =>
      !document.querySelector("#calldata").hidden);
    const selector = await page.locator(
      '#ctree li[data-part="selector"] .val').innerText();
    if (!shownCd || selector !== "0x" + keccak256("setMotd(string)")
      .slice(0, 8)) problems.push(`calldata: ${shownCd} ${selector}`);
    // offset 32, then the length (48) at 0x24, then the bytes at 0x44
    await page.locator('#cpanel .b[data-i="40"]').click();
    const c = await cdl();
    if (c.chosen !== "m-length") problems.push(`calldata byte: ${c.chosen}`);
    const cdetails = await dl("#cdetails");
    if (cdetails.Holds !== "5" ||
      cdetails.Where !== "bytes 0x0024–0x0043") {
      problems.push(`calldata details: ${JSON.stringify(cdetails)}`);
    }
    await page.locator('#cpanel .b[data-i="40"]').click();
    await page.locator('#ctree li[data-part="m"] > .row').hover();
    const cl = await page.evaluate(() => [...document.querySelectorAll(
      "#cpanel .b.hl")].map((b) => +b.dataset.i));
    if (cl.join() !== range(4, 72).join()) {
      problems.push(`calldata m lit: ${cl.length}`);
    }
    if (!(await page.locator("#chow").textContent()).includes(
      "not by ethdebug")) problems.push("calldata: no why-not");
    await page.locator("h1").hover();
    // next to the storage dump: in its column, right under it
    const place = await page.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      const [c, p, d] = [r("#calldata"), r("#panel"), r("#dump")];
      return { left: Math.abs(c.left - p.left) < 2,
        under: c.top >= d.bottom - 1 && c.top - d.bottom < 60,
        shown: c.height > 100 };
    });
    if (!place.left || !place.under || !place.shown) {
      problems.push(`calldata place: ${JSON.stringify(place)}`);
    }
    for (const id of Object.keys(expected).filter((x) => x !== "motd")) {
      await scene(id);
      if (await page.locator("#calldata").isVisible()) {
        problems.push(`calldata shown in ${id}`);
      }
    }
  }

  // Three players: each record at its own keccak(address, slot 3), far
  // apart, its name in the next slot (carol's long name's bytes at
  // keccak of that slot); the mapping's row lights them all, a byte
  // selects its player's field
  await scene("mid");
  await page.locator('#tree li[data-path="players"] > .row').hover();
  const tnames = await page.locator('#panel .view[data-side="after"] ' +
    ".wrow[data-name]").evaluateAll((rs) => Object.fromEntries(
    rs.map((r) => [r.dataset.slot, r.dataset.name])));
  const three = Object.keys(await lit()).filter((k) =>
    k.startsWith("after ")).map((k) => tnames[k.split(" ")[1]]).sort();
  const wantThree = [];
  for (const k of ["0x3c44…93bc", "0x7099…79c8", "0x90f7…b906"]) {
    wantThree.push(`keccak(${k}, slot 3)`, `keccak(${k}, slot 3) + 1`);
  }
  wantThree.push("keccak(keccak(0x90f7…b906, slot 3) + 1)",
    "keccak(keccak(0x90f7…b906, slot 3) + 1) + 1");
  if (three.join() !== wantThree.sort().join()) {
    problems.push(`three players: ${three}`);
  }
  // Selecting a composite colours its immediate children apart, the
  // same in the tree and the dump: players' three entries; alice's
  // entry's seven members; a leaf keeps the one colour. No name labels
  // after the keys.
  const colours = () => page.evaluate(() => {
    const k = (el) => [...el.classList].find((c) => /^pk\d$/.test(c)) ??
      "pk0";
    const tree = {};
    for (const r of document.querySelectorAll("#tree li[data-path] > " +
      ".row.hl")) tree[r.parentElement.dataset.path] = k(r);
    const dump = {};
    for (const c of document.querySelectorAll(
      '#panel .view:not([hidden]) .b.hl[data-owners]')) {
      for (const o of c.dataset.owners.split("|")) {
        (dump[o.replace(/#length$/, "")] ??= new Set()).add(k(c));
      }
    }
    return { tree, dump: Object.fromEntries(Object.entries(dump).map(
      ([o, v]) => [o, [...v].join()])),
    bg: [...new Set([...document.querySelectorAll("#panel .b.hl")].map(
      (c) => getComputedStyle(c).backgroundColor))].length };
  });
  const sameColours = (c) => Object.entries(c.tree).every(([p, k]) =>
    !(p in c.dump) || c.dump[p] === k);
  await page.locator('#tree li[data-path="players"] > .row').click();
  await page.mouse.move(1, 1);
  // (the selection colour, pk0, is the selected row's own, never a
  // child's)
  let cl = await colours();
  const byEntry = [A, B, C].map((p) => new Set(Object.entries(cl.tree)
    .filter(([q]) => q.startsWith(p)).map(([, k]) => k)));
  if (byEntry.some((x) => x.size !== 1 || x.has("pk0")) ||
    new Set(byEntry.map((x) => [...x][0])).size !== 3 ||
    cl.tree.players !== "pk0" || !sameColours(cl) || cl.bg !== 3) {
    problems.push(`players colours: ${JSON.stringify(cl)}`);
  }
  await page.locator(`#tree li[data-path="${A}"] > .row`).click();
  await page.mouse.move(1, 1);
  cl = await colours();
  const members = Object.entries(cl.tree).filter(([q]) => q !== A)
    .map(([, k]) => k);
  if (new Set(members).size !== 7 || members.includes("pk0") ||
    cl.tree[A] !== "pk0" || !sameColours(cl)) {
    problems.push(`alice's members: ${JSON.stringify(cl)}`);
  }
  // an array: its length (its own bytes) in the selection colour, its
  // elements in child colours
  await page.locator('#tree li[data-path="roster"] > .row').click();
  await page.mouse.move(1, 1);
  cl = await colours();
  if (cl.tree.roster !== "pk0" || cl.dump.roster !== "pk0" ||
    ["roster[0]", "roster[1]", "roster[2]"].some((q) =>
      !cl.tree[q] || cl.tree[q] === "pk0") || !sameColours(cl)) {
    problems.push(`roster colours: ${JSON.stringify(cl)}`);
  }
  await page.locator(`#tree li[data-path="${A}"] > .row`).click();
  await page.mouse.move(1, 1);
  // with players selected, each entry is one block in its colour: its
  // key line and its fields, one background, rounded at its ends only,
  // no gap between its rows
  {
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    await page.mouse.move(1, 1);
    const bl = await page.evaluate((ps) => ps.map((p) => {
      const li = document.querySelector(`#tree li[data-path="${p}"]`);
      const k = [...li.classList].find((c) => /^pk\d$/.test(c));
      const rows = [...li.querySelectorAll(".row")];
      const bg = (e) => getComputedStyle(e).backgroundColor;
      return li.classList.contains("blk") && !!k &&
        rows.every((r) => /rgba\(0, 0, 0, 0\)|transparent/.test(bg(r)) &&
          parseFloat(getComputedStyle(r).borderTopLeftRadius) === 0) &&
        parseFloat(getComputedStyle(li, "::before").borderTopLeftRadius) > 0
        ? k : null;
    }), [A, B, C]);
    if (bl.some((x) => !x) || new Set(bl).size !== 3) {
      problems.push(`entry blocks: ${bl}`);
    }
    // the selection's bar, beside the row, is inside the tree's box (which
  // scrolls inside itself), at every level; and the blocks' edges too
  // (one bar, on the selected row only, the same style for a leaf and
  // a composite)
  const barStyles = new Set();
  for (const p of ["players", A, `${A}.combo`]) {
    await page.evaluate((x) => window.select("mid", { sel: x }), p);
    const f = await page.evaluate(() => {
      const t = document.querySelector("#tree").getBoundingClientRect();
      const sel = [...document.querySelectorAll("#tree .row.sel")];
      const r = sel[0].getBoundingClientRect();
      const bar = getComputedStyle(sel[0], "::before");
      const blks = [...document.querySelectorAll("#tree li.blk")].map((b) =>
        b.getBoundingClientRect().left - 4);
      // (the bar as it was at 95feab9: the row's box-shadow, the row's
      // band reaching 4px each side and the accent 7px to the left)
      const sh = getComputedStyle(sel[0]).boxShadow;
      const offs = [...sh.matchAll(/(-?\d+)px 0px 0px/g)].map((m) => +m[1]);
      return { n: sel.length, cut: r.left - 7 < t.left ||
        blks.some((x) => x < t.left),
        style: offs.join() === "-4,4,-7" ? "original" : sh };
    });
    if (f.n !== 1 || f.cut) problems.push(`selection bar ${p}: ${f.n} ${f.cut}`);
    barStyles.add(f.style);
  }
  if (barStyles.size !== 1 || !barStyles.has("original")) {
    problems.push(`selection bars: ${[...barStyles]}`);
  }
  await page.evaluate(() => window.select("mid", { sel: "players" }));
  // the pointer: no solc id in the YAML (the short names marked as the
  // page's); a step's block top at the box's middle, as far as it can
  {
    await page.evaluate(() => window.select("mid", { sel: "roster" }));
    await page.locator('#details button[data-r="start"]').click();
    const al = await page.evaluate(() => ({
      ids: /\bt_\w+\$/.test([...document.querySelectorAll("#ptr .line")]
        .map((l) => l.textContent).join("\n")),
      aliases: [...document.querySelectorAll("#ptr .alias")].map((a) =>
        getComputedStyle(a).fontStyle).every((x) => x === "italic") &&
        document.querySelectorAll("#ptr .alias").length >= 2 }));
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.select("mid", { sel: "players" }));
    await page.locator('#details button[data-r="start"]').click();
    // (at step 1, the block at the first line shows whole, under the
    // header)
    const first = await page.evaluate(() => {
      // (against the scroll box's clip edge: inside its border)
      const p = document.querySelector("#ptr");
      const clip = p.getBoundingClientRect().top + p.clientTop;
      const on = p.querySelector(".line.on").getBoundingClientRect();
      return on.top >= clip + 4 && getComputedStyle(p).maskImage === "none";
    });
    if (!first) problems.push("step 1: the block's top is cut");
    // (at a step in the middle of the YAML: the block's top a third of
    // the way down the visible box, within a line)
    await page.locator('#chips .chip[data-k="5"]').click();
    const mid = await page.evaluate(() => {
      const box = document.querySelector("#ptr");
      const on = box.querySelector(".line.on");
      const lh = on.getBoundingClientRect().height;
      const b = box.getBoundingClientRect().top + box.clientTop;
      const top = on.getBoundingClientRect().top;
      const end = box.scrollTop <= 0 || box.scrollTop >= box.scrollHeight -
        box.clientHeight - 1;
      return !end && Math.abs(top - (b + box.clientHeight / 3)) <= lh;
    });
    await page.keyboard.press("Escape");
    if (al.ids || !al.aliases || !mid) {
      problems.push(`pointer names/scroll: ${JSON.stringify(al)} ${mid}`);
    }
  }
  // players' own slot, 3, which holds nothing: its gutter tinted, its
    // label shown, its bytes plain
    const s3 = await page.evaluate(() => {
      const r = document.querySelector('#panel .view:not([hidden]) ' +
        `.wrow[data-slot="0x${"0".repeat(63)}3"]`);
      return { grp: r.querySelector(".addr").classList.contains("grp"),
        lit: r.querySelectorAll(".b.hl").length,
        pop: r.querySelector(".pop")?.textContent };
    });
    if (!s3.grp || s3.lit || s3.pop !== "slot 3") {
      problems.push(`players' slot 3: ${JSON.stringify(s3)}`);
    }
    await page.evaluate((x) => window.select("mid", { sel: x }), A);
  }
  // with alice's entry selected, pointing at one member (its row, or a
  // byte of it, or the keyboard) mutes the other members, both sides
  const muted = () => page.evaluate(() => ({
    rows: [...document.querySelectorAll("#tree .row.hl.muted")].map((r) =>
      r.parentElement.dataset.path),
    vivid: [...document.querySelectorAll("#tree .row.hl:not(.muted)")]
      .map((r) => r.parentElement.dataset.path),
    bytes: [...new Set([...document.querySelectorAll(
      "#panel .view:not([hidden]) .b.hl:not(.muted)")].map((c) =>
      c.dataset.owners))],
    mutedBytes: document.querySelectorAll(
      "#panel .view:not([hidden]) .b.hl.muted").length }));
  for (const [how, act] of [
    ["row", () => page.locator(`#tree li[data-path="${A}.combo"] > .row`)
      .hover()],
    ["byte", () => page.locator(`#panel .view:not([hidden]) ` +
      `.b[data-owners="${A}.combo"][data-i="22"]`).hover()],
    ["focus", async () => {
      await page.mouse.move(1, 1);
      await page.locator(`#tree li[data-path="${A}.combo"] > .row`).focus();
    }]]) {
    await act();
    const mu = await muted();
    // (the selected entry's own row keeps its colour)
    if (mu.vivid.join() !== `${A},${A}.combo` || mu.rows.length !== 6 ||
      mu.bytes.join() !== `${A}.combo` || !mu.mutedBytes) {
      problems.push(`mute (${how}): ${JSON.stringify(mu)}`);
    }
  }
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(1, 1);
  if ((await muted()).rows.length) problems.push("mute: not restored");
  await page.locator(`#tree li[data-path="${A}.combo"] > .row`).click();
  await page.mouse.move(1, 1);
  cl = await colours();
  if (Object.values(cl.tree).join() !== "pk0") {
    problems.push(`a leaf: ${JSON.stringify(cl)}`);
  }
  // a leaf selected: pointing at its bytes mutes nothing
  await page.locator(`#panel .view:not([hidden]) ` +
    `.b[data-owners="${A}.combo"][data-i="22"]`).hover();
  if ((await muted()).mutedBytes) problems.push("mute: a leaf muted");
  await page.keyboard.press("Escape");
  if (/\((alice|bob|carol)\)/.test(await page.locator("#tree").innerText())) {
    problems.push("a name label after a key");
  }
  // every lit run's popover has room in a gap line beside it: with
  // players selected, one popover for each player's record and one for
  // carol's long name's data, none in the tray, none on bytes or on
  // another row's address
  await page.locator('#tree li[data-path="players"] > .row').click();
  await page.mouse.move(1, 1);
  const room = await page.evaluate(() => {
    const v = document.querySelector('#panel .view:not([hidden])');
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const pops = [...v.querySelectorAll(".pop")];
    const cover = [];
    for (const p of pops) {
      const r = p.getBoundingClientRect();
      const own = p.closest(".wrow");
      for (const e of v.querySelectorAll(".rows > .wrow.on > .addr .a, " +
        ".rows > .wrow > .word .b.hl")) {
        if (e.closest(".wrow") !== own && hit(r, e.getBoundingClientRect())) {
          cover.push(`${p.textContent.slice(0, 20)} on ${e.textContent}`);
        }
      }
    }
    return { pops: pops.map((p) => p.querySelector(".pop-how").textContent)
      .sort(), tray: document.querySelectorAll("#panel .tray, .pinned")
      .length, cover: cover.slice(0, 3) };
  });
  if (room.pops.some((t) => t.includes("… +"))) {
    problems.push(`a range in a label: ${room.pops}`);
  }
  if (room.tray || room.cover.length || room.pops.join("|") !== [
    "keccak(0x3c44…93bc, slot 3) : players[0x3c44…93bc], 2 slots",
    "keccak(0x7099…79c8, slot 3) : players[0x7099…79c8], 2 slots",
    "keccak(0x90f7…b906, slot 3) : players[0x90f7…b906], 2 slots",
    "keccak(keccak(0x90f7…b906, slot 3) + 1) : players[0x90f7…b906].name, " +
      "2 slots",
    // (and players' own slot, by its gutter)
    "slot 3"].join("|")) {
    problems.push(`popover room: ${JSON.stringify(room)}`);
  }
  await page.keyboard.press("Escape");
  // a byte of bob's record selects its field; the roster at keccak(slot 0)
  await page.locator(`#panel .word[data-side="after"] ` +
    `.b[data-owners="${B}.score"][data-i="31"]`).click();
  await page.locator("h1").hover();
  if ((await selected()).join() !== `${B}.score`) {
    problems.push(`three players: byte selected ${await selected()}`);
  }
  await page.keyboard.press("Escape");
  await page.locator('#tree li[data-path="roster[2]"] > .row').hover();
  const rl = Object.keys(await lit()).filter((k) => k.startsWith("after "))
    .map((k) => tnames[k.split(" ")[1]]);
  if (rl.join() !== "keccak(slot 0) + 2") problems.push(`roster[2]: ${rl}`);
  // roster[1], selected: the middle of the roster's run, with no gap
  // line beside it; its popover sits on the unlit row under it
  await page.locator('#tree li[data-path="roster[1]"] > .row').click();
  await page.mouse.move(1, 1);
  const r1 = await page.evaluate(() => {
    const v = document.querySelector('#panel .view:not([hidden])');
    const pop = v.querySelector(".pop");
    if (!pop) return "none";
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const r = pop.getBoundingClientRect();
    const on = [...v.querySelectorAll(".b.hl")].some((c) =>
      hit(r, c.getBoundingClientRect()));
    return `${pop.textContent}${on ? " on lit" : ""}`;
  });
  if (r1 !== "keccak(slot 0) + 1 : roster[1]") {
    problems.push(`roster[1] popover: ${r1}`);
  }
  // every slot popover is placed as a gap line's: its left edge 6 px
  // left of the gutter, its arrow on the middle of its address
  {
    const off = [];
    for (const p of ["roster[1]", "players", "total"]) {
      await page.evaluate((x) => window.select("mid", { sel: x }), p);
      await page.mouse.move(1, 1);
      off.push(...await page.evaluate(() => [...document.querySelectorAll(
        "#panel .view:not([hidden]) .pop")].map((pop) => {
        const g = pop.closest(".addr").getBoundingClientRect();
        const a = pop.closest(".addr").querySelector(".a")
          .getBoundingClientRect();
        const r = pop.getBoundingClientRect();
        const tip = r.left + parseFloat(pop.style.getPropertyValue("--ax"));
        return Math.abs(r.left - (g.left - 6)) <= 1 &&
          Math.abs(tip - (a.left + a.width / 2)) <= 1 ? null
          : pop.textContent;
      }).filter(Boolean)));
    }
    if (off.length) problems.push(`popovers off the gutter: ${off}`);
    await page.evaluate(() => window.select("mid", { sel: null }));
  }
  await page.keyboard.press("Escape");

  // Vyper: Solidity's rule reads nothing at keccak(key . slot 3) for any
  // player; Vyper's own words, keccak(slot 108 . key) and on (the six
  // counters, the name's length, its bytes), hold the real values, and
  // no value shown owns them. "How this was found" lists the selected
  // player's, and each lights its word.
  await page.locator('#picker button[data-id="vyper"]').click();
  const vy = await page.evaluate(() => {
    const v = document.querySelector('#panel .view[data-side="after"]');
    return Object.fromEntries([...v.querySelectorAll(".wrow[data-slot]")]
      .map((r) => [r.dataset.name, `${r.querySelector(".b[data-i='31']")
        .textContent} ${r.querySelectorAll(".b.free").length}`]));
  });
  // score, combo, bestCombo, plays, hitCount; the name's length
  for (const [key, vals, len] of [
    ["0x7099…79c8", ["1e", "02", "02", "02", "02"], "05"],
    ["0x3c44…93bc", ["0a", "01", "01", "01", "01"], "03"],
    ["0x90f7…b906", ["00", "00", "00", "01", "00"], "22"]]) {
    const n = (k) => `Vyper's keccak(slot 108, ${key})${k ? ` + ${k}` : ""}`;
    const bad = [...vals.map((x, k) => [n(k), `${x} 32`]),
      [n(6), `${len} 32`]].filter(([k, v]) => vy[k] !== v);
    if (bad.length || !(`keccak(${key}, slot 3)` in vy)) {
      problems.push(`vyper words ${key}: ${JSON.stringify(bad)}`);
    }
  }
  // (Vyper's words are listed in the replay's panel)
  await page.locator('#details button[data-r="start"]').click();
  text = (await how()).replace(/\s+/g, " ");
  if (!text.includes("Vyper's rule") ||
    !/score = 30[\s\S]*combo = 2[\s\S]*name \(length\) = 5[\s\S]*name \(bytes\) = "alice"/
      .test(text) || !text.includes("players[0x7099…79c8].score uint64 = 0")) {
    problems.push(`vyper how: ${text.slice(-300)}`);
  }
  const vslot = "0xb30699257deee3310afa7d2dbc412cc509c9ed82f6154467e3c1401f09460446";
  // (the list gives each Vyper word's slot; during a replay, the dump
  // shows the step)
  const vp = "";
  if (!(await page.locator("#ptr ol.vyper li").first().innerText())
    .includes(vslot.slice(0, 6))) {
    problems.push(`vyper pops: ${vp}`);
  }
  // carol, selected: her Vyper words, her long name over two words
  await page.locator(`#tree li[data-path="${C}.score"] > .row`).click();
  await page.locator('#details button[data-r="start"]').click();
  text = (await how()).replace(/\s+/g, " ");
  if (!/plays = 1[\s\S]*name \(length\) = 34[\s\S]*"carol, the unstoppable combo que"[\s\S]*"en"/
    .test(text)) {
    problems.push(`vyper how carol: ${text.slice(-300)}`);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();

  // "Inside one play" (BUG, bugc from main): alice's third hit at -O0
  // and -O2, paused at three points. The locals' values, decoded from
  // bugc's pointers by the library, checked by hand against the source:
  // the roll is a hit; multiplied(10, 3) has m = 5, then m = combo = 3;
  // gained = 10 * 3 = 30. Before the writes, bugc lists hit with no
  // location, without optimization too.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => window.memResults?.done, null,
    { timeout: 60000 });
  const mr = await page.evaluate(() => window.memResults);
  problems.push(...mr.errors.map((e) => `memory: ${e}`));
  const memWant = {
    roll: [{ hit: "true" }],
    mult: [{ points: "10", combo: "3", m: "5" },
      { points: "10", combo: "3", m: "3" }],
    writes: [{ gained: "30" }],
  };
  for (const o of ["0", "2"]) {
    for (const [pt, want] of Object.entries(memWant)) {
      const got = (mr.decoded[o]?.[pt] ?? []).map((x) => x.values);
      if (!same(got, want)) {
        problems.push(`memory -O${o} ${pt}: ${JSON.stringify(got)}`);
      }
    }
    const none = mr.decoded[o]?.writes?.[0]?.none.join();
    if (none !== "hit") problems.push(`memory -O${o} no location: ${none}`);
  }
  const storageLit = await page.locator("#panel .b.hl:not(.cmp *)").count();
  const mlit = () => page.evaluate(() => {
    const out = {};
    for (const c of document.querySelectorAll("#mpanel .b.hl:not(.cmp *)")) {
      const w = c.closest(".word");
      (out[`${w.dataset.side} ${w.dataset.slot}`] ??= []).push(+c.dataset.i);
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) =>
      [k, v.length === 32 ? "all" : v.join()]));
  });
  const mrow = (n) => page.locator(`#mtree li[data-path="${n}"] > .row`);
  const mpt = (id) => page.locator(`#mpoint button[data-id="${id}"]`).click();
  const mopt = (o) => page.locator(`#mlevel button[data-opt="${o}"]`).click();
  const msel = () => page.evaluate(() => document.querySelector(
    "#mtree .row.sel")?.parentElement.dataset.path ?? null);
  // the colour of each lit row and byte: "hl" (the selection's own) or
  // its child colour, "muted" when muted
  const mcol = () => page.evaluate(() => {
    const k = (el) => !el.classList.contains("hl") ? null
      : ([...el.classList].find((c) => /^pk\d$/.test(c)) ?? "hl") +
        (el.classList.contains("muted") ? " muted" : "");
    const rows = {};
    for (const li of document.querySelectorAll("#mtree li[data-path]")) {
      rows[li.dataset.path] = k(li.firstElementChild);
    }
    const bytes = {};
    for (const c of document.querySelectorAll(
      "#mpanel .view:not([hidden]) .b.hl:not(.cmp *)")) {
      const w = c.closest(".word").dataset.slot;
      (bytes[w] ??= new Set()).add(k(c));
    }
    return { rows, bytes: Object.fromEntries(Object.entries(bytes)
      .map(([w, s]) => [w, [...s].sort().join()])) };
  });
  await page.locator("#memory").scrollIntoViewIfNeeded();
  // At first: -O0, after the roll, hit selected; one point, so one
  // dump called "Memory", no Before | After, no cards, no change marks
  {
    const v = await page.evaluate(() => [
      document.querySelector("#mmoderow").hidden,
      getComputedStyle(document.querySelector("#mmoderow")).display,
      [...document.querySelectorAll("#mpanel .view-name")].map((x) =>
        x.textContent).join(),
      document.querySelectorAll("#mpanel .cmp, #mpanel .b.chg").length,
      document.querySelector("#msrclegend").textContent.trim()]);
    if (!same(v, [true, "none", "Memory", 0, "paused here"])) {
      problems.push(`memory one point: ${JSON.stringify(v)}`);
    }
  }
  if (await msel() !== "hit" ||
    !same(await mlit(), { "after 0x00c0": "31" })) {
    problems.push(`memory roll: ${await msel()} ${
      JSON.stringify(await mlit())}`);
  }
  // Inside multiplied at -O0: a real call. multiplied is selected: its
  // own bytes (the frame pointer, the word at 0x80) in the selection
  // colour, each local in a child colour of its own
  await mpt("mult");
  await page.locator("h1").hover();
  {
    const c = await mcol();
    const kids = ["points", "combo", "m"].map((p) => c.rows[p]);
    if (await msel() !== "multiplied" || c.rows.multiplied !== "hl" ||
      new Set(kids).size !== 3 || kids.some((k) => !/^pk\d$/.test(k)) ||
      c.bytes["0x0080"] !== "hl") {
      problems.push(`memory multiplied -O0: ${JSON.stringify(c)}`);
    }
    const frame = await mrow("multiplied").locator(".val").textContent();
    if (!/^frame at 0x[0-9a-f]+$/.test(frame.trim())) {
      problems.push(`memory frame -O0: ${frame}`);
    }
    // pointing at one child mutes the others, not the selection's own
    await mrow("points").hover();
    const d = await mcol();
    if (d.rows.points !== kids[0] || d.rows.combo !== `${kids[1]} muted` ||
      d.rows.m !== `${kids[2]} muted` || d.rows.multiplied !== "hl" ||
      d.bytes["0x0080"] !== "hl") {
      problems.push(`memory muting: ${JSON.stringify(d)}`);
    }
  }
  // two steps (before and after m = combo): Before | After, and the
  // dump of the one picked
  for (const [m, want] of [["before", "Before"], ["after", "After"]]) {
    await page.locator(`#mmode button[data-mode="${m}"]`).click();
    const v = await page.locator("#mpanel .view").evaluateAll((vs) =>
      vs.filter((x) => !x.hidden && x.offsetHeight).map((x) =>
        x.querySelector(".view-name").textContent).join());
    if (v !== want) problems.push(`memory mode ${m}: ${v}`);
  }
  // From the bytes to the value: a click on a byte of points selects
  // it; a click on its row again clears it
  await page.locator('#mpanel .view:not([hidden]) .b[data-owners="points"]')
    .first().click();
  if (await msel() !== "points") {
    problems.push(`memory byte -> value: ${await msel()}`);
  }
  // m moves: at -O0 from the frame + 88 to the frame + 184, which
  // holds combo's bytes too
  await mrow("m").click();
  {
    const d = await dl("#mdetails");
    const [a, b] = [d.Before, d.After].map((x) =>
      x?.match(/^0x([0-9a-f]+)–0x([0-9a-f]+) = (\d)$/));
    const frame = parseInt((await mrow("multiplied").locator(".val")
      .textContent()).trim().slice(9), 16);
    if (!a || !b || parseInt(a[1], 16) !== frame + 88 || a[3] !== "5" ||
      parseInt(b[1], 16) !== frame + 184 || b[3] !== "3") {
      problems.push(`memory m: ${JSON.stringify(d)} ${frame}`);
    }
  }
  // at -O2: inlined, no frame; the locals at fixed offsets
  await mopt(2);
  await mrow("multiplied").click();
  {
    const v = (await mrow("multiplied").locator(".val").textContent())
      .trim();
    const c = await mcol();
    if (v !== "inlined: no frame" || "0x0080" in c.bytes ||
      await page.locator("#mpanel .wrow[data-slot='0x0080']").count()) {
      problems.push(`memory multiplied -O2: ${v} ${JSON.stringify(c)}`);
    }
  }
  // Before the writes: gained = 30; hit with no location; alice's
  // record slot, its six members in six colours
  await mpt("writes");
  {
    const t = await page.locator("#mtree").innerText();
    if (!/gained[\s\S]*30/.test(t) ||
      !/hit[\s\S]*no location at this point/.test(t)) {
      problems.push(`memory writes tree: ${t}`);
    }
  }
  await mrow("players[msg.sender]").click();
  {
    const c = await mcol();
    const ms = ["score", "combo", "bestCombo", "plays", "hitCount",
      "lastBlock"].map((x) => c.rows[`players[msg.sender].${x}`]);
    if (new Set(ms).size !== 6 || ms.some((k) => !/^pk\d$/.test(k)) ||
      c.rows["players[msg.sender]"] !== "hl") {
      problems.push(`memory record: ${JSON.stringify(c)}`);
    }
    const score = await mrow("players[msg.sender].score")
      .locator(".val").textContent();
    if (score.trim() !== "30") problems.push(`memory score: ${score}`);
  }
  // a click on the score's bytes selects the score
  await page.locator('#mpanel .b[data-owners="players[msg.sender].score"]')
    .first().click();
  if (await msel() !== "players[msg.sender].score") {
    problems.push(`memory record byte: ${await msel()}`);
  }
  // a derivation step lights its region; Escape clears
  // (the point opens with hit selected: a click clears it, Enter on
  // the focused row selects it again)
  await mpt("roll");
  await mrow("hit").click();
  if (await msel()) problems.push("memory click again");
  await mrow("hit").focus();
  await page.keyboard.press("Enter");
  await page.locator("h1").hover();
  if (await msel() !== "hit") problems.push("memory key pick");
  // (at -O2 here: hit is the last byte of the word at 0x120)
  await page.locator('#mhow li[data-region]').first().hover();
  if (!same(await mlit(), { "after 0x0120": "31" })) {
    problems.push(`memory step: ${JSON.stringify(await mlit())}`);
  }
  await page.locator("h1").hover();
  await page.keyboard.press("Escape");
  if (await msel()) problems.push("memory Escape");
  // the storage section is not affected
  if (await page.locator("#panel .b.hl:not(.cmp *)").count() !==
    storageLit) {
    problems.push("memory changed the storage panel");
  }
  const mwide = await page.evaluate(() => {
    const v = document.querySelector("#mpanel .views");
    return v.scrollWidth > v.clientWidth + 1;
  });
  if (mwide) problems.push("memory: words scroll sideways on desktop");
  if (name === "chromium") {
    await mopt(0);
    await mpt("mult");
    await page.evaluate(() => {
      document.querySelector("#memory .words").scrollTop = 0;
      document.querySelector("#memory").scrollIntoView();
    });
    await page.locator("h1").hover();
    await page.waitForTimeout(300);
    await page.locator("#memory").screenshot({ path: shot("memory.png") });
  }
  await mopt(0);
  await mpt("roll");

  // Each section keeps its own view: the storage scene's controls (the
  // scene, Before | After, "show other state", Escape) leave the memory
  // section as it is, and the memory section's (A, B, its Show, Escape)
  // leave the storage scene as it is
  {
    const memView = () => page.evaluate(() => JSON.stringify([
      ...["#mlevel", "#mpoint", "#mmode"].map((q) =>
        document.querySelector(`${q} [aria-checked="true"]`)?.textContent),
      [...document.querySelectorAll("#mpanel .view")].map((v) => v.hidden)
        .join(),
      document.querySelector("#mtree .row.sel")?.parentElement.dataset.path,
      document.querySelector("#mtree").innerText,
      document.querySelectorAll("#mpanel .b.hl").length]));
    const storeView = () => page.evaluate(() => JSON.stringify([
      document.querySelector('#picker [aria-checked="true"]')?.dataset.id,
      document.querySelector('#mode [aria-checked="true"]')?.dataset.mode,
      [...document.querySelectorAll("#panel .view")].map((v) => v.hidden)
        .join(),
      document.querySelector("#tree .row.sel")?.parentElement.dataset.path,
      document.querySelector("#insets").checked,
      document.querySelector("#tree").innerText]));
    await scene("alice");
    await page.locator(`#tree li[data-path="${A}.combo"] > .row`).click();
    await mpt("mult");
    await mrow("m").click();
    await page.locator("h1").hover();
    let m0 = await memView();
    const steps = [
      ["Before", () => setMode("before")],
      ["insets", () => page.locator("#insets").uncheck()],
      ["insets again", () => page.locator("#insets").check()],
      ["After", () => setMode("after")],
      ["a scene", () => page.locator('#picker button[data-id="motd"]')
        .click()],
      ["a one-point scene", () => page.locator(
        '#picker button[data-id="mid"]').click()],
      ["Escape", async () => {
        await page.locator('#tree li[data-path="total"] > .row').click();
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press("Escape");
      }],
    ];
    for (const [what, act] of steps) {
      await act();
      await page.locator("h1").hover();
      if (await memView() !== m0) {
        problems.push(`storage ${what} changed memory: ${await memView()}`);
        m0 = await memView();
      }
    }
    await page.locator('#picker button[data-id="alice"]').click();
    await page.locator(`#tree li[data-path="${A}.combo"] > .row`).click();
    await page.locator("h1").hover();
    let s0 = await storeView();
    const msteps = [
      ["Before", () => page.locator('#mmode button[data-mode="before"]')
        .click()],
      ["After", () => page.locator('#mmode button[data-mode="after"]')
        .click()],
      ["O2", () => mopt(2)],
      ["a point", () => mpt("writes")],
      ["O0", () => mopt(0)],
      ["Escape", async () => {
        await mrow("gained").click();
        await page.evaluate(() => document.activeElement?.blur());
        await page.keyboard.press("Escape");
      }],
    ];
    for (const [what, act] of msteps) {
      await act();
      await page.locator("h1").hover();
      if (await storeView() !== s0) {
        problems.push(`memory ${what} changed storage: ${await storeView()}`);
        s0 = await storeView();
      }
    }
    // and each Escape cleared its own section's selection
    if (await page.locator("#mtree .row.sel").count()) {
      problems.push("memory Escape did not clear memory");
    }
    await page.keyboard.press("Escape");
  }

  // The URL hash keeps the view: loading with one restores the scene,
  // the mode, the selection and the memory points; a stale one falls
  // back to the first scene, with its defaults
  // (leave a page only once its idle-time fetches are done: WebKit
  // reports a fetch cut off by leaving as a page error)
  const idle = (pg) => pg.waitForFunction(() => !window.loading?.busy(),
    null, { timeout: 30000 }).then(() => pg.waitForTimeout(1500))
    .then(() => pg.waitForFunction(() => !window.loading?.busy()));
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => problems.push(`hash pageerror: ${e}`));
  hp.on("console", (m) => {
    if (m.type() === "error") problems.push(`hash console: ${m.text()}`);
  });
  await hp.goto(PAGE + "#ex=motd&mode=before&sel=roster&mopt=2&" +
    "mpt=mult&mmode=before&msel=m&insets=0");
  await hp.waitForFunction(() => window.results?.done &&
    window.memResults?.done, null, { timeout: 60000 });
  const hs = await hp.evaluate(() => ({
    ex: document.querySelector('#picker [aria-checked="true"]')?.dataset.id,
    mode: document.querySelector('#mode [aria-checked="true"]')?.dataset.mode,
    sel: document.querySelector("#tree .row.sel")?.parentElement.dataset.path,
    mopt: document.querySelector('#mlevel [aria-checked="true"]')
      ?.dataset.opt,
    mpt: document.querySelector('#mpoint [aria-checked="true"]')
      ?.dataset.id,
    mmode: document.querySelector('#mmode [aria-checked="true"]')
      ?.dataset.mode,
    msel: document.querySelector("#mtree .row.sel")?.parentElement
      .dataset.path,
    hash: location.hash,
    insets: document.querySelector("#insets").checked,
  }));
  if (!same(hs, { ex: "motd", mode: "before", sel: "roster",
    mopt: "2", mpt: "mult", mmode: "before",
    msel: "m",
    insets: false, hash: hs.hash }) || !hs.hash.includes("ex=motd") ||
    !hs.hash.includes("sel=roster")) {
    problems.push(`hash restore: ${JSON.stringify(hs)}`);
  }
  // changes go back into the hash
  await hp.locator('#mode button[data-mode="after"]').click();
  await hp.locator('#tree li[data-path="total"] > .row').click();
  const h2 = await hp.evaluate(() => location.hash);
  if (!h2.includes("mode=after") || !h2.includes("sel=total")) {
    problems.push(`hash write: ${h2}`);
  }
  // a cleared default selection stays cleared ("sel=")
  await hp.locator('#tree li[data-path="total"] > .row').click();
  await idle(hp);
  await hp.reload();
  await hp.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const h3 = await hp.evaluate(() => [location.hash,
    document.querySelectorAll("#tree .row.sel").length]);
  if (!/(^#|&)sel=(&|$)/.test(h3[0]) || h3[1]) {
    problems.push(`hash cleared: ${h3}`);
  }
  // a link to a scene alone gives its defaults
  await idle(hp);
  await hp.goto("about:blank");
  await hp.goto(PAGE + "#ex=mid");
  await hp.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const h4 = await hp.evaluate(() =>
    document.querySelector("#tree .row.sel")?.parentElement.dataset.path);
  if (h4 !== A) problems.push(`hash scene defaults: ${h4}`);
  await idle(hp);
  await hp.goto("about:blank");
  // (an old mode=compare shows After)
  await hp.goto(PAGE + "#ex=nope&mode=compare&sel=zzz&mopt=7&mpt=x");
  await hp.waitForFunction(() => window.results?.done &&
    window.memResults?.done, null, { timeout: 60000 });
  const stale = await hp.evaluate(() => [
    document.querySelector('#picker [aria-checked="true"]')?.dataset.id,
    document.querySelector('#mode [aria-checked="true"]')?.dataset.mode,
    document.querySelectorAll("#tree .row.sel").length,
    document.querySelector('#mpoint [aria-checked="true"]')
      ?.dataset.id]);
  if (stale.join() !== "mid,after,1,roll") {
    problems.push(`stale hash: ${stale}`);
  }
  await hp.close();

  // Phone
  const phone = await browser.newContext(name === "firefox"
    ? { viewport: { width: 390, height: 844 } }
    : { ...devices["iPhone 13"] });
  const pp = await phone.newPage();
  await pp.emulateMedia({ reducedMotion: "reduce" });
  pp.on("pageerror", (e) => problems.push(`phone pageerror: ${e}`));
  pp.on("console", (m) => {
    if (m.type() === "error") problems.push(`phone console: ${m.text()}`);
  });
  await pp.goto(PAGE);
  await pp.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  await pp.evaluate(() => window.select("motd"));
  // each word on two lines of 16 bytes, every byte in view, nothing
  // scrolls sideways
  const narrow = await layout(pp, 2);
  problems.push(...narrow.out.map((x) => `phone: ${x}`));
  if (narrow.scrolls) problems.push("phone: the words scroll sideways");
  const vbox = () => pp.evaluate(() => {
    const v = document.querySelector("#panel .views");
    return [v.clientWidth, v.clientHeight, v.scrollWidth, v.scrollHeight]
      .join();
  });
  const vrest = await vbox();
  await pp.locator("h1").click();
  await pp.locator('#tree li[data-path="motd"] > .row').click();
  if (await vbox() !== vrest) {
    problems.push(`phone: the words' box changed: ${vrest} -> ${
      await vbox()}`);
  }
  const phoneLit = await pp.locator("#panel .b.hl:not(.cmp *)").count();
  // after: 5 bytes of "gl hf" and its length byte; before: the
  // long-length word (holds the flag byte) and 50 bytes of data across
  // two slots
  if (phoneLit !== 6 + 32 + 50) {
    problems.push(`phone: ${phoneLit} bytes lit for motd`);
  }
  const scrollX = await pp.evaluate(() =>
    document.documentElement.scrollWidth >
      document.documentElement.clientWidth);
  if (scrollX) problems.push("phone: page scrolls sideways");
  await pp.waitForFunction(() => window.memResults?.done);
  // the bar offers the replay; nothing moves on the phone either
  if (!(await pp.locator("#details").innerText()).includes(
    "▸ Show how it was found")) {
    problems.push("phone: no replay button");
  }
  await still(pp, "390");
  // (16 bytes a line, filling the box)
  {
    const bad = (await fill(pp)).filter((x) => x.r < 0.98 || x.r > 1.001 ||
      x.lines !== 2);
    if (bad.length) problems.push(`phone dump fit: ${JSON.stringify(bad)}`);
  }
  // (as on the desktop: the lit rows fit, the panel's parts keep to
  // their room)
  await fitsInView(pp, "390 view");
  // multiplied at -O0, both steps: before, the frame pointer (32
  // bytes), points (8), m = 5 (8) and combo (4); after, the same but m
  // = 3 over combo's word (8, combo's 4 among them)
  await pp.locator('#mpoint button[data-id="mult"]').click();
  const mlitp = await pp.locator("#mpanel .b.hl:not(.cmp *)").count();
  if (mlitp !== 32 + 8 + 8 + 4 + 32 + 8 + 8) {
    problems.push(`phone: ${mlitp} bytes lit for multiplied`);
  }
  if (await pp.evaluate(() => document.documentElement.scrollWidth >
    document.documentElement.clientWidth)) {
    problems.push("phone: page scrolls sideways (memory)");
  }
  if (name === "webkit") {
    await pp.waitForTimeout(300);
    await pp.screenshot({ path: shot("phone.png"), fullPage: true });
    await pp.waitForTimeout(300);
    await pp.locator("#memory").screenshot({ path: shot("memory-phone.png") });
  }
  // Loading failures: the decoder bundle (network error) and the first
  // scene's data (HTTP 503)
  problems.push(...await retryCheck(browser, "vendor/pointers.js",
    { abort: true }));
  problems.push(...await retryCheck(browser,
    "fixtures/arcade-mid.json", { via: "#tree .error button" }));
  if (name === "chromium") problems.push(...await slowLink(browser));
  // slot 0, when shown, is the first line of the dump, at the top of
  // its box (no gap line, no extra space above it)
  await scene("mid");
  const top0 = await page.evaluate(() => {
    const rows = document.querySelector("#panel .view:not([hidden]) .rows");
    const first = rows.firstElementChild;
    return [first.dataset.slot ?? first.className,
      Math.round(first.getBoundingClientRect().top -
        rows.getBoundingClientRect().top)];
  });
  // (only the box's border and padding, 5 px, above it)
  if (BigInt(top0[0] ?? 1) !== 0n || top0[1] > 6) {
    problems.push(`slot 0 at the top: ${top0}`);
  }
  // and no title in the rendered page either
  for (const pg of [page]) {
    const n = await pg.evaluate(() =>
      document.querySelectorAll("[title]").length);
    if (n) problems.push(`${n} elements with a title`);
  }
  problems.push(...logs, ...foreign.map((u) => `foreign ${u}`));

  console.log(`${name} ${browser.version()}: ${problems.length
    ? "FAIL\n  " + problems.join("\n  ") : "ok"}`);
  failed += problems.length;
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
