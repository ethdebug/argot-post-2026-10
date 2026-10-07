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

// Alice: anvil's first account, who sends every transaction
const A = "players[0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266]";
const MOTTO = ["play fair", "play fair, keep score, and write the scores down"];
// [path, before, after] for each scene, from the calls in
// bin/make-fixtures.mjs. A scene with one point shows the same state on
// both sides.
const recorded = [
  [`${A}.score`, "7", "67"],
  [`${A}.streak`, "1", "2"],
  [`${A}.active`, "true", "true"],
  ["history", "length 1", "length 2"],
  ["history[0]", "7", "7"],
  ["history[1]", undefined, "60"],
  ["motto", '""', '""'],
  ["total", "7", "67"],
  ["rounds", "1", "2"],
];
const first = recorded.filter(([p]) => p !== "history[1]")
  .map(([p, b]) => [p, b, b]);
const expected = {
  packed: first,
  alice: first,
  streak: recorded,
  motto: [
    ["motto", `"${MOTTO[0]}"`, `"${MOTTO[1]}"`],
    [`${A}.score`, "67", "67"],
    ["total", "67", "67"],
    ["rounds", "2", "2"],
  ],
  // Solidity's rule, applied to the Vyper contract's storage
  vyper: [
    [`${A}.score`, "0", "0"],
    [`${A}.streak`, "0", "0"],
    [`${A}.active`, "false", "false"],
  ],
};
// Each scene's defaults: the mode shown and the variable selected
const defaults = {
  packed: ["after", undefined],
  alice: ["after", `${A}.streak`],
  streak: ["after", A],
  motto: ["after", "motto"],
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
// The contract at the top of the page is contracts/Scores.sol
{
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const pre = html.match(/<pre id="contract-src" class="src">([\s\S]*?)<\/pre>/)
    ?.[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  if (pre !== fs.readFileSync(path.join(root, "contracts", "Scores.sol"),
    "utf8")) {
    console.log("index.html: the contract differs from contracts/Scores.sol");
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
  if (t.fixtures !== "index.json,memory.json,scores-record.json") {
    out.push(`fetched before usable: ${t.fixtures}`);
  }
  // the others, idle-time
  await p.waitForFunction(() => ["scores-motto", "scores-vyper"]
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
    "vyper" && !document.querySelector('#tree li[data-path="history"]'));
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
  out.push(...await retryCheck(browser, "fixtures/scores-motto.json",
    { pick: "motto", throttle }));
  return out.map((x) => `slow link: ${x}`);
}

for (const [name, type] of [["chromium", chromium], ["firefox", firefox],
  ["webkit", webkit]]) {
  const browser = await type.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
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
    if (open || seen || !/^Scores\.sol — the contract \(43 lines\)$/
      .test(text)) problems.push(`source at rest: ${open} ${seen} ${text}`);
    if (await page.locator("#contract-src span").count()) {
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
      "Scores.sol"), "utf8").trim() || col[1] < 3) {
      problems.push(`source colouring: ${col[1]} colours`);
    }
    await page.reload();
    await page.waitForFunction(() => window.results?.done, null,
      { timeout: 60000 });
    [open] = await st();
    if (!open) problems.push("source: open not remembered");
    await box.locator("summary").focus();
    await page.keyboard.press("Enter");
    [open] = await st();
    if (open) problems.push("source: Enter did not close it");
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
  if (!same(atRest, { scene: "packed", sel: 0, intro: "packed",
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
  await scene("streak");
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
  const dl = (q = "#details") => page.evaluate((x) => {
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
  // Player packs score (8 bytes), streak (4) and active (1) into one
  // word, from the low end; before and after
  await want("score", `${A}.score`, range(24, 31), 2);
  await want("streak", `${A}.streak`, range(20, 23), 2);
  await want("active", `${A}.active`, [19], 2);
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
  await pickByte(`${A}.active`, 19);
  let sel = await selected();
  if (sel.join() !== `${A}.active`) problems.push(`pick 19: ${sel}`);
  // the details of the selected value, under the dump
  const fd = await dl();
  if (fd.Value !== `players[0xf39f…2266].active (bool)` ||
    !/^slot …a722 \(keccak\(0xf39f…2266, slot 0\)\), byte 19$/
      .test(fd.Where) || fd.Before !== "true (0x01)" ||
    fd.After !== "true (0x01)" || fd.scrolls) {
    problems.push(`details active: ${JSON.stringify(fd)}`);
  }
  await pickByte(`${A}.streak`, 22);
  sel = await selected();
  if (sel.join() !== `${A}.streak`) problems.push(`pick 22: ${sel}`);
  // and from the keyboard
  await page.locator(`#panel .view[data-side="after"] ` +
    `.b[data-owners="${A}.active"][tabindex]`).first().focus();
  await page.keyboard.press("Enter");
  sel = await selected();
  if (sel.join() !== `${A}.active`) problems.push(`key pick: ${sel}`);
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
  await tr(`${A}.active`).click();
  await tr(`${A}.active`).click();
  if ((await selected()).length) problems.push("row click did not toggle");
  // While a variable is selected, the view stays on it: an unrelated
  // byte changes nothing; its own bytes only change the info line; a
  // click on an unrelated byte switches the selection
  await tr(`${A}.streak`).click();
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
    .includes("viewing players[0xf39f…2266].streak · Esc to clear")) {
    problems.push("locked: no viewing hint");
  }
  await page.locator(`#panel .word[data-side="after"] ` +
    `.b[data-owners="${A}.streak"][data-i="23"]`).hover();
  if (await look() !== locked0 ||
    await page.locator("#details").textContent() === probe0) {
    problems.push("locked: own byte hover");
  }
  await scoreByte.click();
  sel = await selected();
  if (sel.join() !== `${A}.score`) {
    problems.push(`locked: click did not switch: ${sel}`);
  }
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();

  // The slots are named as the templates computed them: history's
  // elements and the long motto's data
  const slotNames = () => page.locator("#panel .wrow[data-name]")
    .evaluateAll((rs) => [...new Set(rs.map((r) => r.dataset.name))]);
  let named = await slotNames();
  if (!named.includes("keccak(slot 1) + 1") || !named.includes("slot 3") ||
    !named.includes("keccak(0xf39f…2266, slot 0)")) {
    problems.push(`streak slots: ${named}`);
  }
  // slot 3 holds rounds, then total, in byte order
  const slot3 = "0x" + "0".repeat(63) + "3";
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
  if (info.Value !== "rounds (uint64)" || info.Where !== "slot 3, bytes 8–15" ||
    info.Before !== "1 (0x0000000000000001)" ||
    info.After !== "2 (0x0000000000000002)" ||
    info.scrolls) problems.push(`details rounds: ${JSON.stringify(info)}`);
  // and a popover at slot 3's address, in the dump shown
  const pops = () => page.locator("#panel .pop").allInnerTexts();
  let pp0 = await pops();
  if (pp0.join("|") !== "slot 3 · read, written") {
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
  await scene("packed");
  await page.locator(`#panel .word[data-side="after"][data-slot="${slot3}"]` +
    ' .b[data-i="31"]').hover();
  const one = await dl();
  if (one.Value !== "total (uint128)" || one.Where !== "slot 3, bytes 16–31" ||
    one.Holds !== "7 (0x…000007)" || "Before" in one || "After" in one) {
    problems.push(`one point details: ${JSON.stringify(one)}`);
  }
  if ((await pops()).join("|") !== "slot 3") {
    problems.push(`one point pops: ${await pops()}`);
  }
  if (await page.locator("#panel .cmp, #tree .tcard").count()) {
    problems.push("one point: a card");
  }
  await page.locator(`#tree li[data-path="${A}.streak"] > .row`).click();
  if (!(await page.locator("#how").textContent())
    .includes("For the state after Alice's first record(7).") ||
    await page.locator("#how .branch, #how .evals").count()) {
    problems.push("one point: derivation");
  }
  await page.keyboard.press("Escape");

  // A string outgrows its slot. Short: the data and the length byte
  // share the string's slot. Long: the slot holds the length word, and
  // the data lives at keccak(slot) on. Slots are named here as the page
  // names them (from the template's defines).
  await scene("motto");
  const names = await page.locator('#panel .view[data-side="after"] ' +
    ".wrow[data-name]").evaluateAll((rs) => Object.fromEntries(
    rs.map((r) => [r.dataset.slot, r.dataset.name])));
  {
    const sides = {
      before: { "slot 2": [...range(0, 8), 31] },
      after: { "slot 2": range(0, 31), "keccak(slot 2)": range(0, 31),
        "keccak(slot 2) + 1": range(0, 15) },
    };
    await page.locator('#tree li[data-path="motto"] > .row').hover();
    const named = {};
    for (const [k, v] of Object.entries(await lit())) {
      const [side, s] = k.split(" ");
      (named[side] ??= {})[names[s] ?? s] = v.join();
    }
    const want = Object.fromEntries(Object.entries(sides).map(([side, m]) =>
      [side, Object.fromEntries(Object.entries(m).map(([k, v]) =>
        [k, v.join()]))]));
    if (!same(named, want)) {
      problems.push(`motto bytes: ${JSON.stringify(named)}`);
    }
  }
  // A slot used only in the other state is marked: the long data run in
  // the Before dump
  await setMode("before");
  await page.locator('#tree li[data-path="motto"] > .row').hover();
  const only = await page.evaluate(() => [...document.querySelectorAll(
    '#panel .view[data-side="before"] .wrow.only')].map((r) =>
    r.dataset.slot));
  if (only.map((x) => names[x]).join() !==
    "keccak(slot 2),keccak(slot 2) + 1") {
    problems.push(`motto only: ${only.map((x) => names[x])}`);
  }
  // In Before, both runs (slot 2, lit; its new data, used only After)
  // get their derivation label; no popover or card covers a lit row's
  // address label
  await page.locator('#tree li[data-path="motto"] > .row').click();
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
    !labelled.pops.some((t) => t.startsWith("slot 2")) ||
    !labelled.pops.some((t) => t.startsWith("keccak(slot 2) + 0 … + 1")) ||
    labelled.covered.length) {
    problems.push(`motto labels: ${JSON.stringify(labelled)}`);
  }
  await page.keyboard.press("Escape");
  // Each run's addresses sit in one group box in the gutter, and its
  // popover's arrow lands within that box (both states)
  for (const m of ["before", "after"]) {
    await setMode(m);
    await page.locator('#tree li[data-path="motto"] > .row').click();
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
    if (bad.length) problems.push(`motto ${m} groups: ${bad}`);
    await page.keyboard.press("Escape");
  }
  // The tray is the same in Before and After: each run's card is in
  // place in both states, or in the tray in both
  {
    const n = [];
    for (const m of ["before", "after"]) {
      await setMode(m);
      await page.locator('#tree li[data-path="motto"] > .row').hover();
      n.push(await page.evaluate(() => [
        document.querySelectorAll("#panel .cmp:not(.pinned)").length,
        document.querySelectorAll("#panel .cmp.pinned").length].join("/")));
    }
    if (n[0] !== n[1]) problems.push(`motto cards: ${n}`);
  }
  await setMode("after");
  // the long data is a run of two consecutive slots, with no gap
  const run = await page.locator('#panel .view[data-side="after"] .rows')
    .evaluate((r) => [...r.children].map((c) => c.dataset.name ?? "gap"));
  const k0 = run.indexOf("keccak(slot 2)");
  if (k0 < 0 || run[k0 + 1] !== "keccak(slot 2) + 1") {
    problems.push(`motto run: ${run}`);
  }

  // At rest: no popover, and nothing in the dumps but addresses and
  // bytes (names live in the tree)
  await scene("streak");
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
  await page.locator(`#tree li[data-path="${A}.streak"] > .row`).hover();
  pp0 = await pops();
  if (pp0.length !== 1 || !pp0[0].startsWith(
    "keccak(0xf39f…2266, slot 0) · read, written\n= 0x7230")) {
    problems.push(`pops streak: ${pp0}`);
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
    return Math.abs(r.left - (g.left - 6)) < 5 && tip >= a.left &&
      tip <= a.right &&
      r.right <= document.documentElement.clientWidth &&
      (side === "before" ? r.bottom <= a.top : r.top >= a.bottom);
  }));
  let aimed = await aim();
  await setMode("before");
  await page.locator(`#tree li[data-path="${A}.streak"] > .row`).hover();
  aimed = [...aimed, ...await aim()];
  await setMode("after");
  if (aimed.length !== 2 || !aimed.every(Boolean)) {
    problems.push(`aim: ${aimed}`);
  }

  // The other state's picture beside the lit run. streak: an "after"
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
    .evaluateAll((rs) => rs.map((r) => Math.round(r.getBoundingClientRect()
      .top - document.querySelector("#panel").getBoundingClientRect().top))
      .join());
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
    await page.locator(`#tree li[data-path="${A}.streak"] > .row`)
      .hover();
    let blocks = await cmp();
    const b0 = blocks[0];
    if (blocks.length !== 1 || b0.side !== m || b0.label !== other ||
      !(m === "before" ? b0.under : b0.over) ||
      b0.lines[0].bytes.join() !== range(20, 23).join() ||
      b0.lines[0].text !== (m === "before" ? "00000002" : "00000001") ||
      !b0.lines[0].aligned || !b0.full) {
      problems.push(`${m}: streak card: ${JSON.stringify(blocks)}`);
    }
    if (await popAt() !== (m === "before" ? "over" : "under")) {
      problems.push(`${m}: popover place: ${await popAt()}`);
    }
    // Alice's whole entry lights one slot (her struct, packed): one
    // card, one line, aligned; no clashes; nothing moves, no scrollbar
    await page.locator(`#tree li[data-path="${A}"] > .row`).hover();
    blocks = await cmp();
    if (blocks.length !== 1 || blocks[0].lines.length !== 1 ||
      blocks[0].lines[0].bytes.join() !== range(19, 31).join() ||
      !blocks[0].lines.every((l) => l.aligned) || !blocks[0].full) {
      problems.push(`${m}: struct card: ${JSON.stringify(blocks)}`);
    }
    const c = await clashes();
    if (c.length) problems.push(`${m}: clashes: ${c}`);
    if (await tops() !== rest) problems.push(`${m}: rows moved while lit`);
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
      .evaluate((r) => [...r.children].map((c) =>
        c.classList.contains("gap") ? "gap" : c.dataset.slot));
    const want = [];
    n.forEach((x, k) => {
      if (k === 0 || x !== n[k - 1] + 1n) want.push("gap");
      want.push(b[k]);
    });
    want.push("gap");
    if (seq.join() !== want.join()) problems.push(`${id} gaps: ${seq}`);
  }
  // Each word is one line of 32 bytes; one dump is shown; on a wide
  // panel nothing scrolls sideways
  const layout = (p) => p.evaluate(() => {
    const out = [];
    for (const w of document.querySelectorAll("#panel .word:not(.cmp *)")) {
      if (!w.offsetHeight) continue; // the dump not shown
      const tops = new Set([...w.querySelectorAll(".b")].map((c) =>
        Math.round(c.getBoundingClientRect().top)));
      if (w.querySelectorAll(".b").length !== 32 || tops.size !== 1) {
        out.push(`word ${w.dataset.side} ${w.dataset.slot.slice(0, 8)}` +
          ` on ${tops.size} lines`);
      }
    }
    const seen = [...document.querySelectorAll("#panel .view")].filter(
      (v) => v.offsetHeight);
    if (seen.length !== 1) out.push(`${seen.length} dumps shown`);
    const v = document.querySelector("#panel .views");
    return { out, scrolls: v.scrollWidth > v.clientWidth + 1 };
  });
  await scene("motto");
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
  // The first scene, as its intro asks: a click on a byte of slot 3
  await page.locator('#picker button[data-id="packed"]').click();
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

  // "How this was found": clicking any row selects it and shows its
  // derivation, changed or not. active did not change.
  await scene("streak");
  const row = (p) => page.locator(`#tree li[data-path="${p}"] > .row`);
  const how = () => page.locator("#how").textContent();
  await row(`${A}.active`).click();
  let text = await how();
  for (const want of ["Template", "$keccak256", "Region", "offset",
    "from the program context", "from the trace", "same bytes in both"]) {
    if (!text.includes(want)) problems.push(`active how lacks "${want}"`);
  }
  // streak did change; its source mark and region step
  await row(`${A}.streak`).click();
  const mark = await page.locator("#src mark").innerText();
  if (!mark.includes("struct Player")) problems.push(`mark: ${mark}`);
  await page.locator("#how li[data-region]").last().hover();
  const step = await lit();
  if (!Object.keys(step).every((k) => k.startsWith("after ")) ||
    Object.values(step).flat().join() !== range(20, 23).join()) {
    problems.push(`region step: ${JSON.stringify(step)}`);
  }
  // and a step lights its bytes on focus too
  await page.locator("h1").hover();
  await page.locator("#how li[data-region]").last().focus();
  if (!Object.keys(await lit()).length) problems.push("region step focus");
  await page.evaluate(() => document.activeElement.blur());
  if (name === "chromium") {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => window.scrollTo(0,
      document.querySelector(".cols").offsetTop - 8));
    await page.mouse.move(1, 1);
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("desktop-dark.png") });
    await page.emulateMedia({ colorScheme: "light" });
  }
  // a value with no template: the program context gives its region
  await row("total").click();
  text = await how();
  if (!text.includes("from the program context") ||
    !text.includes("no template")) {
    problems.push("total how");
  }

  // The mode: Before or After shows that dump only, and the derivation
  // and the tree follow it (After by default)
  const views = () => page.locator("#panel .view").evaluateAll((vs) =>
    vs.filter((v) => !v.hidden && v.offsetHeight).map((v) =>
      v.dataset.side).join());
  const sides = () => page.locator("#how li[data-region]").evaluateAll(
    (ls) => [...new Set(ls.map((l) => l.dataset.side))].join());
  await row(`${A}.score`).click();
  for (const [m, val, whose] of [
    ["before", "7", "after Alice's first record(7)"],
    ["after", "67", "after her second record(30)"]]) {
    await setMode(m);
    const v = await views();
    const d = await sides();
    const t = await how();
    const shownVal = await row(`${A}.score`)
      .locator(".val > span:first-child").innerText();
    if (v !== m) problems.push(`mode ${m}: views ${v}`);
    if (d !== m) problems.push(`mode ${m}: derivation for ${d}`);
    if (!t.includes(`For the state ${whose}.`)) {
      problems.push(`mode ${m}: panel does not say whose`);
    }
    if (shownVal.trim() !== val) {
      problems.push(`mode ${m}: tree shows ${shownVal}`);
    }
  }

  // The tree's cards: none at rest; a lit changed value gets one with
  // the other state's value (score: "after 67" under it in Before,
  // "before 7" over it in After); an unchanged one gets none
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
  for (const [m, want, place] of [["before", "after67", "under"],
    ["after", "before7", "over"]]) {
    await setMode(m);
    await page.locator("h1").hover();
    if ((await tins()).length) problems.push(`${m}: tree card at rest`);
    await row(`${A}.score`).hover();
    const t = await tins();
    if (t.length !== 1 || t[0].path !== `${A}.score` ||
      t[0].text !== want || t[0].place !== place) {
      problems.push(`tree card ${m}: ${JSON.stringify(t)}`);
    }
    await row(`${A}.active`).hover();
    if ((await tins()).length) problems.push(`${m}: card for unchanged`);
  }
  // No card for what did not change: selecting an unchanged value gives
  // none, in the tree or the dump, in either state
  for (const p of ["history[0]", `${A}.active`, "motto"]) {
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
  await row(`${A}.streak`).hover();
  if ((await tins()).length ||
    await page.locator("#panel .cmp").count() ||
    !Object.keys(await lit()).length) {
    problems.push("insets off: still shown, or nothing lit");
  }
  if (!(await page.evaluate(() => location.hash)).includes("insets=0")) {
    problems.push("insets off: not in the hash");
  }
  await page.locator("#insets").check();
  await row(`${A}.score`).hover();
  if (!(await tins()).length ||
    (await page.evaluate(() => location.hash)).includes("insets=")) {
    problems.push("insets on again");
  }
  await page.locator("h1").hover();

  // motto goes short -> long. The panel forks where the two derivations
  // part: the shared steps once, the IF with both evaluations, then one
  // list per branch, this state's first
  await scene("motto");
  const forkOf = () => page.evaluate(() => {
    const how = document.querySelector("#how");
    const shared = how.querySelector(":scope > ol.steps");
    const lis = [...shared.children];
    return {
      shared: lis.length,
      evals: [...(lis.at(-1).querySelector(".evals")?.children ?? [])]
        .map((e) => e.textContent.replace(/\s+/g, " ").trim()),
      branches: [...how.querySelectorAll(".branch")].map((b) => ({
        cls: b.className, head: b.querySelector(".branch-head").textContent,
        start: b.querySelector("ol").getAttribute("start"),
        result: b.querySelector("li.final")?.dataset.side,
      })),
    };
  });
  await row("motto").click();
  let fk = await forkOf();
  if (fk.shared !== 4 || fk.evals.length !== 2 ||
    !/^before .* → then$/.test(fk.evals[0]) ||
    !/^after .* → else$/.test(fk.evals[1]) ||
    fk.branches.length !== 2 || !fk.branches[0].cls.includes("mine") ||
    fk.branches[0].head !== "after · else (long-string layout)" ||
    fk.branches[1].head !== "before · then (short-string layout)" ||
    fk.branches.some((b) => b.start !== "5") ||
    fk.branches[0].result !== "after" || fk.branches[1].result !== "before") {
    problems.push(`motto fork (after): ${JSON.stringify(fk)}`);
  }
  // in Before, the before branch comes first
  await setMode("before");
  fk = await forkOf();
  if (fk.branches[0]?.head !== "before · then (short-string layout)" ||
    fk.branches[0]?.result !== "before") {
    problems.push(`motto fork (before): ${JSON.stringify(fk)}`);
  }
  // with "show other state" off: one list, this state's only
  await page.locator("#insets").uncheck();
  fk = await forkOf();
  if (fk.branches.length || fk.evals.length) {
    problems.push(`motto, other state off: ${JSON.stringify(fk)}`);
  }
  await page.locator("#insets").check();
  await setMode("after");
  // the result of this state's branch: the long data, after; slot 2,
  // before
  const result = () => page.locator("#how li.final").first().evaluate((l) =>
    [l.dataset.side, JSON.parse(l.dataset.region).slot]);
  let [rs, slot] = await result();
  if (rs !== "after" || !slot.startsWith("0x4057") ||
    !(await how()).includes("so take else")) {
    problems.push(`motto after: ${rs} ${slot}`);
  }
  await setMode("before");
  [rs, slot] = await result();
  if (rs !== "before" || BigInt(slot) !== 2n ||
    !(await how()).includes("so take then")) {
    problems.push(`motto before: ${rs} ${slot}`);
  }
  // hovering the result lights the before bytes now
  await page.locator("#how li.final").first().hover();
  const gl = Object.keys(await lit()).map((k) => k.split(" ")[0]);
  if (gl.join() !== "before") problems.push(`motto result lit: ${gl}`);
  await setMode("after");
  await page.keyboard.press("Escape");

  // The calldata of setMotto (motto scene only), by the ABI encoding: a
  // byte selects its part of m; a part lights its bytes
  {
    const { keccak256 } = (await import("js-sha3")).default;
    const cdl = () => page.evaluate(() => window.calldataResults);
    const shownCd = await page.evaluate(() =>
      !document.querySelector("#calldata").hidden);
    const selector = await page.locator(
      '#ctree li[data-part="selector"] .val').innerText();
    if (!shownCd || selector !== "0x" + keccak256("setMotto(string)")
      .slice(0, 8)) problems.push(`calldata: ${shownCd} ${selector}`);
    // offset 32, then the length (48) at 0x24, then the bytes at 0x44
    await page.locator('#cpanel .b[data-i="40"]').click();
    const c = await cdl();
    if (c.chosen !== "m-length") problems.push(`calldata byte: ${c.chosen}`);
    const cdetails = await dl("#cdetails");
    if (cdetails.Holds !== "48" ||
      cdetails.Where !== "bytes 0x0024–0x0043") {
      problems.push(`calldata details: ${JSON.stringify(cdetails)}`);
    }
    await page.locator('#cpanel .b[data-i="40"]').click();
    await page.locator('#ctree li[data-part="m"] > .row').hover();
    const cl = await page.evaluate(() => [...document.querySelectorAll(
      "#cpanel .b.hl")].map((b) => +b.dataset.i));
    if (cl.join() !== range(4, 115).join()) {
      problems.push(`calldata m lit: ${cl.length}`);
    }
    if (!(await page.locator("#chow").textContent()).includes(
      "not by ethdebug")) problems.push("calldata: no why-not");
    await page.locator("h1").hover();
    await scene("streak");
    if (!(await page.evaluate(() =>
      document.querySelector("#calldata").hidden))) {
      problems.push("calldata shown in another scene");
    }
  }

  // Vyper: Solidity's rule reads 0 at keccak(key . slot 0); Vyper's own
  // words, keccak(slot 0 . key) + 0, 1, 2, hold 67, 2 and 1, and no value
  // shown owns them. "How this was found" lists them, and each lights
  // its word.
  await page.locator('#picker button[data-id="vyper"]').click();
  const vy = await page.evaluate(() => {
    const v = document.querySelector('#panel .view[data-side="after"]');
    return [...v.querySelectorAll(".wrow[data-slot]")].map((r) => [
      r.dataset.name, r.querySelector(".b[data-i='31']").textContent,
      r.querySelectorAll(".b.free").length]);
  });
  const key = "0xf39f…2266";
  if (!same(vy, [
    [`Vyper's keccak(slot 0, ${key})`, "43", 32],
    [`Vyper's keccak(slot 0, ${key}) + 1`, "02", 32],
    [`Vyper's keccak(slot 0, ${key}) + 2`, "01", 32],
    [`keccak(${key}, slot 0)`, "00", 19]])) {
    problems.push(`vyper words: ${JSON.stringify(vy)}`);
  }
  text = (await how()).replace(/\s+/g, " ");
  if (!text.includes("Vyper's rule") ||
    !/score = 67[\s\S]*streak = 2[\s\S]*active = true/.test(text) ||
    !text.includes("→ 0")) {
    problems.push(`vyper how: ${text.slice(-300)}`);
  }
  await page.locator("#how ol.vyper li").first().hover();
  const vlit = await lit();
  if (Object.keys(vlit).join() !== `after ${await page.evaluate(() =>
    document.querySelector('#panel .wrow[data-slot]').dataset.slot)}` ||
    Object.values(vlit)[0].length !== 32) {
    problems.push(`vyper step lit: ${JSON.stringify(vlit)}`);
  }
  if ((await pops()).join() !== `Vyper's keccak(slot 0, ${key})\n= ` +
    "0x5c63ee49f5c25cff0b1cb0da74779ad3703cfde276b4532ef9eec62c7e94fee4") {
    problems.push(`vyper pops: ${await pops()}`);
  }
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();

  // The memory section (BUG, bugc from main): locals decoded from
  // bugc's pointers by the library, at each curated point
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForFunction(() => window.memResults?.done, null,
    { timeout: 60000 });
  const mr = await page.evaluate(() => window.memResults);
  problems.push(...mr.errors.map((e) => `memory: ${e}`));
  // names[1] = "grace hopper": the element's word gets the address of a
  // new string; "grace" stays where it was
  const list = { names: "length 3", "names[0]": '"ada"',
    "names[2]": '"alan"' };
  const memWant = {
    built: { ...list, "names[1]": '"grace"' },
    written: { ...list, "names[1]": '"grace"' },
    replaced: { ...list, "names[1]": '"grace hopper"' },
  };
  for (const [pt, vals] of Object.entries(memWant)) {
    const d = mr.decoded[pt] ?? {};
    const got = Object.fromEntries(Object.entries(d).map(([k, v]) =>
      [k, v.text]));
    if (!same(got, vals)) {
      problems.push(`memory ${pt}: ${JSON.stringify(got)}`);
    }
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
  // A = array built, B = name replaced: names[1] is found through the
  // array's word (0xa0), its length (0x140) and the element's word
  // (0x180), which holds the address of "grace" (0x200) at A and of
  // "grace hopper" (0x280) at B
  await page.locator("#memory").scrollIntoViewIfNeeded();
  await mrow("names[1]").hover();
  let ml = await mlit();
  const via = { "0x00a0": "all", "0x0140": "all", "0x0180": "all" };
  const onSide = (side, o) => Object.fromEntries(Object.entries(o).map(
    ([k, v]) => [`${side} ${k}`, v]));
  if (!same(ml, { ...onSide("before", { ...via, "0x0200": "all",
    "0x0220": "0,1,2,3,4" }), ...onSide("after", { ...via, "0x0280": "all",
    "0x02a0": "0,1,2,3,4,5,6,7,8,9,10,11" }) })) {
    problems.push(`memory names[1]: ${JSON.stringify(ml)}`);
  }
  const mprobe = await dl("#mdetails");
  if (mprobe.Value !== "names[1] (string)" ||
    mprobe.A !== '0x0220–0x0224 = "grace"' ||
    mprobe.B !== '0x02a0–0x02ab = "grace hopper"' || mprobe.scrolls) {
    problems.push(`memory details: ${JSON.stringify(mprobe)}`);
  }
  // Selected: the array's word, its length, the item, the element's
  // word (an address at A, another at B), the string's length, its
  // bytes; the card shows the element's word at A
  await mrow("names[1]").click();
  const mhow = () => page.locator("#mhow").textContent();
  const h = await mhow();
  const order = ["names:", "names-length", "Item", "names-element:",
    "names-element-length", "names-element-data",
    'Read at B: "grace hopper"'];
  const where = order.map((x) => h.indexOf(x));
  if (where.some((x, k) => x < 0 || (k && x < where[k - 1])) ||
    !/an address, 0x0200[\s\S]*an address, 0x0280/.test(h) ||
    !/the length, 5[\s\S]*the length, 12/.test(h) ||
    await page.locator("#mhow .branch").count()) {
    problems.push(`memory how names[1]: ${where} ${h.slice(0, 200)}`);
  }
  const cards = await page.evaluate(() => [...document.querySelectorAll(
    "#mpanel .cmp [data-of]")].map((c) => c.dataset.of));
  if (!cards.includes("0x0180")) {
    problems.push(`memory cards: ${cards}`);
  }
  // a step lights its region: the new string's length word
  await page.locator('#mhow li[data-region*="names-element-length"]')
    .hover();
  ml = await mlit();
  if (!same(ml, { "after 0x0280": "all" })) {
    problems.push(`memory step: ${JSON.stringify(ml)}`);
  }
  await page.keyboard.press("Escape");
  // A byte names its owner
  await page.locator('#mpanel .word[data-side="after"]' +
    '[data-slot="0x02a0"] .b[data-i="0"]').hover();
  const mp2 = await page.locator("#mdetails").textContent();
  if (!mp2.trim().startsWith("names[1] · bytes 0–11 of word 0x02a0")) {
    problems.push(`memory byte: ${mp2}`);
  }
  // At B, the old bytes of "grace" are still in memory, owned by no
  // value
  const left = await page.evaluate(() => [...document.querySelectorAll(
    '#mpanel .word[data-side="after"][data-slot="0x0220"] .b')]
    .slice(0, 5).map((c) => `${c.textContent}${
      c.classList.contains("free") ? "" : "!"}`).join(" "));
  if (left !== "67 72 61 63 65") problems.push(`memory old bytes: ${left}`);
  // A = new string written: "grace hopper" is in memory at A already;
  // only the element's word changes
  await page.locator('#mpick-before button[data-id="written"]').click();
  await mrow("names[1]").click();
  const mwords = await page.evaluate(() => [...document.querySelectorAll(
    '#mpanel .view[data-side="after"] .wrow:not(.same)[data-slot]')]
    .map((r) => r.dataset.slot).join());
  if (mwords !== "0x00c0,0x0180") {
    problems.push(`memory written -> replaced: ${mwords}`);
  }
  await page.keyboard.press("Escape");
  await page.locator('#mpick-before button[data-id="built"]').click();
  // Enter on a row selects it; Escape clears it
  await mrow("names[2]").focus();
  await page.keyboard.press("Enter");
  await page.locator("h1").hover();
  if (await page.locator("#mtree .row.sel").count() !== 1) {
    problems.push("memory key pick");
  }
  await page.keyboard.press("Escape");
  if (await page.locator("#mtree .row.sel").count()) {
    problems.push("memory Escape");
  }
  // A or B shows that point's dump only
  for (const [m, want] of [["before", "before"], ["after", "after"]]) {
    await page.locator(`#mmode button[data-mode="${m}"]`).click();
    const v = await page.locator("#mpanel .view").evaluateAll((vs) =>
      vs.filter((x) => !x.hidden && x.offsetHeight).map((x) =>
        x.dataset.side).join());
    if (v !== want) problems.push(`memory mode ${m}: ${v}`);
  }
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
    await mrow("names[1]").click();
    await page.evaluate(() => {
      document.querySelector("#memory .words").scrollTop = 0;
      document.querySelector("#memory").scrollIntoView();
    });
    await page.locator("h1").hover();
    await page.waitForTimeout(300);
    await page.locator("#memory").screenshot({ path: shot("memory.png") });
    await page.keyboard.press("Escape");
  }

  // The URL hash keeps the view: loading with one restores the scene,
  // the mode, the selection and the memory points; a stale one falls
  // back to the first scene, with its defaults
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => problems.push(`hash pageerror: ${e}`));
  hp.on("console", (m) => {
    if (m.type() === "error") problems.push(`hash console: ${m.text()}`);
  });
  await hp.goto(PAGE + "#ex=motto&mode=before&sel=history&a=written&" +
    "b=replaced&mmode=before&msel=names[1]&insets=0");
  await hp.waitForFunction(() => window.results?.done &&
    window.memResults?.done, null, { timeout: 60000 });
  const hs = await hp.evaluate(() => ({
    ex: document.querySelector('#picker [aria-checked="true"]')?.dataset.id,
    mode: document.querySelector('#mode [aria-checked="true"]')?.dataset.mode,
    sel: document.querySelector("#tree .row.sel")?.parentElement.dataset.path,
    how: document.querySelector("#how li.final")?.dataset.side,
    a: document.querySelector('#mpick-before [aria-checked="true"]')
      ?.dataset.id,
    b: document.querySelector('#mpick-after [aria-checked="true"]')
      ?.dataset.id,
    mmode: document.querySelector('#mmode [aria-checked="true"]')
      ?.dataset.mode,
    msel: document.querySelector("#mtree .row.sel")?.parentElement
      .dataset.path,
    hash: location.hash,
    insets: document.querySelector("#insets").checked,
  }));
  if (!same(hs, { ex: "motto", mode: "before", sel: "history",
    how: "before", a: "written", b: "replaced", mmode: "before",
    msel: "names[1]",
    insets: false, hash: hs.hash }) || !hs.hash.includes("ex=motto") ||
    !hs.hash.includes("sel=history")) {
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
  await hp.reload();
  await hp.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const h3 = await hp.evaluate(() => [location.hash,
    document.querySelectorAll("#tree .row.sel").length]);
  if (!/(^#|&)sel=(&|$)/.test(h3[0]) || h3[1]) {
    problems.push(`hash cleared: ${h3}`);
  }
  // a link to a scene alone gives its defaults
  await hp.goto("about:blank");
  await hp.goto(PAGE + "#ex=alice");
  await hp.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const h4 = await hp.evaluate(() =>
    document.querySelector("#tree .row.sel")?.parentElement.dataset.path);
  if (h4 !== `${A}.streak`) problems.push(`hash scene defaults: ${h4}`);
  await hp.goto("about:blank");
  // (an old mode=compare shows After)
  await hp.goto(PAGE + "#ex=nope&mode=compare&sel=zzz&a=x&b=x");
  await hp.waitForFunction(() => window.results?.done &&
    window.memResults?.done, null, { timeout: 60000 });
  const stale = await hp.evaluate(() => [
    document.querySelector('#picker [aria-checked="true"]')?.dataset.id,
    document.querySelector('#mode [aria-checked="true"]')?.dataset.mode,
    document.querySelectorAll("#tree .row.sel").length,
    document.querySelector('#mpick-before [aria-checked="true"]')
      ?.dataset.id]);
  if (stale.join() !== "packed,after,0,built") {
    problems.push(`stale hash: ${stale}`);
  }
  await hp.close();

  // Phone
  const phone = await browser.newContext(name === "firefox"
    ? { viewport: { width: 390, height: 844 } }
    : { ...devices["iPhone 13"] });
  const pp = await phone.newPage();
  pp.on("pageerror", (e) => problems.push(`phone pageerror: ${e}`));
  pp.on("console", (m) => {
    if (m.type() === "error") problems.push(`phone console: ${m.text()}`);
  });
  await pp.goto(PAGE);
  await pp.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  await pp.evaluate(() => window.select("motto"));
  // Both views, stacked, each word on one line; the words may scroll
  // sideways inside the panel, the page may not
  const narrow = await layout(pp);
  problems.push(...narrow.out.map((x) => `phone: ${x}`));
  const vbox = () => pp.evaluate(() => {
    const v = document.querySelector("#panel .views");
    return [v.clientWidth, v.clientHeight, v.scrollWidth, v.scrollHeight]
      .join();
  });
  const vrest = await vbox();
  await pp.locator("h1").click();
  await pp.locator('#tree li[data-path="motto"] > .row').click();
  if (await vbox() !== vrest) {
    problems.push(`phone: the words' box changed: ${vrest} -> ${
      await vbox()}`);
  }
  const phoneLit = await pp.locator("#panel .b.hl:not(.cmp *)").count();
  // before: 9 bytes of "play fair" and its length byte; after: the
  // long-length word (holds the flag byte) and 48 bytes of data across
  // two slots
  if (phoneLit !== 10 + 32 + 48) {
    problems.push(`phone: ${phoneLit} bytes lit for motto`);
  }
  const scrollX = await pp.evaluate(() =>
    document.documentElement.scrollWidth >
      document.documentElement.clientWidth);
  if (scrollX) problems.push("phone: page scrolls sideways");
  await pp.waitForFunction(() => window.memResults?.done);
  // the derivation panel forks into the two branches
  if (await pp.locator("#how .branch").count() !== 2) {
    problems.push("phone: no difference shown for motto");
  }
  // names[1]: four words and the bytes, at A ("grace") and at B
  // ("grace hopper")
  await pp.locator('#mtree li[data-path="names[1]"] > .row').click();
  const mlitp = await pp.locator("#mpanel .b.hl:not(.cmp *)").count();
  if (mlitp !== 4 * 32 + 5 + 4 * 32 + 12) {
    problems.push(`phone: ${mlitp} bytes lit for names[1]`);
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
    "fixtures/scores-record.json", { via: "#tree .error button" }));
  if (name === "chromium") problems.push(...await slowLink(browser));
  problems.push(...logs, ...foreign.map((u) => `foreign ${u}`));

  console.log(`${name} ${browser.version()}: ${problems.length
    ? "FAIL\n  " + problems.join("\n  ") : "ok"}`);
  failed += problems.length;
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
