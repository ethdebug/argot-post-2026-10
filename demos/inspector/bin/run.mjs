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

const SENDER = "accounts[0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266]";
const TO = "accounts[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const LONG = "a string longer than thirty-one bytes, stored long";
const SHRINKS = "this one starts long, then becomes a short one";
// [path, before, after], from the calls in bin/make-fixtures.mjs
const expected = {
  "token-transfer": [
    [`${SENDER}.balance`, "1000", "975"],
    [`${SENDER}.nonce`, "0", "1"],
    [`${SENDER}.frozen`, "false", "false"],
    [`${TO}.balance`, "0", "25"],
    [`${TO}.nonce`, "0", "0"],
    ["totalSupply", "1000", "1000"],
  ],
  "packed-set": [
    ["a", "0", "7"],
    ["b", "0", "300"],
    ["flag", "false", "true"],
    ["owner", "0x0000000000000000000000000000000000000000",
      "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"],
    ["lo", "0", "123456789"],
    ["hi", "0", "246913578"],
    ["xs", "length 0", "length 1"],
    ["xs[0]", undefined, "307"],
    ["name", '""', '""'],
  ],
  "strings-update": [
    ["grows", '"short"', `"${LONG}"`],
    ["shrinks", `"${SHRINKS}"`, '"now short"'],
    ["most", '"exactly thirty-one bytes, short"',
      '"exactly thirty-one bytes, short"'],
    ["least", '"thirty-two bytes, the least long"',
      '"thirty-two bytes, the least long"'],
  ],
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
// in index.html has the examples of fixtures/index.json
if (!sizesCurrent()) {
  console.log("index.html: file sizes are stale; run node bin/sizes.mjs");
  failed++;
}
{
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const picker = html.match(/<div id="picker"[^>]*>([\s\S]*?)<\/div>/)[1];
  const got = [...picker.matchAll(/data-id="([^"]+)">([^<]+)</g)]
    .map(([, id, t]) => `${id} ${t.replace(/\s+/g, " ")}`).join("\n");
  const want = JSON.parse(fs.readFileSync(path.join(root, "fixtures",
    "index.json"), "utf8")).filter((x) => !x.hidden)
    .map((x) => `${x.id} ${x.title}`).join("\n");
  if (got !== want) {
    console.log(`index.html picker differs from fixtures/index.json:\n${
      got}`);
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
// Retry. `pick`: the example to pick first (its data then fails). `via`:
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
// first example is usable, only its data has loaded by then (the others
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
  if (t.fixtures !== "index.json,memory.json,token-transfer.json") {
    out.push(`fetched before usable: ${t.fixtures}`);
  }
  // the others, idle-time
  await p.waitForFunction(() => ["shop-place", "packed-set",
    "strings-update"].every((id) => performance.getEntriesByType(
    "resource").some((e) => e.name.endsWith(`fixtures/${id}.json`))),
  null, { timeout: 30000 }).catch(() => out.push("no prefetch"));
  await p.waitForFunction(() => window.memResults?.done);
  const shifts = await p.evaluate(() => window.shifts);
  if (shifts > 0.01) out.push(`layout shift ${shifts.toFixed(3)}`);
  // a prefetched example shows at once
  const t1 = Date.now();
  await p.locator('#picker button[data-id="shop-place"]').click();
  await p.locator('#tree li[data-path="orders"]').waitFor();
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
  out.push(...await retryCheck(browser, "fixtures/packed-set.json",
    { pick: "packed-set", throttle }));
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
  await page.goto(PAGE);
  await page.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  // each example's data loads when it is picked
  for (const id of Object.keys(expected)) {
    await page.evaluate((x) => window.select(x), id);
  }
  const r = await page.evaluate(() => window.results);
  const problems = [...r.errors, ...logs,
    ...foreign.map((u) => `foreign ${u}`)];
  for (const [id, rows] of Object.entries(expected)) {
    for (const [p, b, a] of rows) {
      const got = r.decoded[id]?.[p];
      if (!got || got.before !== b || got.after !== a) {
        problems.push(`${id} ${p}: want ${b} -> ${a}, got ` +
          JSON.stringify(got));
      }
    }
  }

  // The words panel: hovering a value lights its bytes, counted from
  // the most significant byte, as the template's offset and length say
  await page.evaluate(() => window.select("token-transfer"));
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
  // offset 0x18 length 0x08; offset 0x17 length 0x01; before and after
  await want("nonce", `${SENDER}.nonce`, range(24, 31), 2);
  await want("frozen", `${SENDER}.frozen`, [23], 2);
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
  await pickByte(`${SENDER}.frozen`, 23);
  let sel = await selected();
  if (sel.join() !== `${SENDER}.frozen`) problems.push(`pick 23: ${sel}`);
  // the details of the selected value, under the dump
  const fd = await dl();
  if (fd.Value !== `accounts[0xf39f…2266].frozen (bool)` ||
    !/^slot …a723 \(keccak\(0xf39f…2266, slot 0\) \+ 1\), byte 23$/
      .test(fd.Where) || fd.Before !== "false (0x00)" ||
    fd.After !== "false (0x00)" || fd.scrolls) {
    problems.push(`details frozen: ${JSON.stringify(fd)}`);
  }
  await pickByte(`${SENDER}.nonce`, 27);
  sel = await selected();
  if (sel.join() !== `${SENDER}.nonce`) problems.push(`pick 27: ${sel}`);
  // and from the keyboard
  await page.locator(`#panel .view[data-side="after"] ` +
    `.b[data-owners="${SENDER}.frozen"][tabindex]`).first().focus();
  await page.keyboard.press("Enter");
  sel = await selected();
  if (sel.join() !== `${SENDER}.frozen`) problems.push(`key pick: ${sel}`);
  await page.keyboard.press("Escape"); // Escape clears the selection
  if ((await selected()).length) problems.push("Escape did not clear");
  // a row is focusable, and Enter selects it
  await page.locator(`#tree li[data-path="${SENDER}.balance"] > .row`).focus();
  await page.keyboard.press("Enter");
  sel = await selected();
  if (sel.join() !== `${SENDER}.balance`) problems.push(`row key: ${sel}`);
  // clicking empty space clears it
  await page.locator("main").click({ position: { x: 4, y: 4 } });
  if ((await selected()).length) problems.push("empty click did not clear");
  await page.evaluate(() => document.activeElement?.blur());

  // Clicking the selected row again clears it
  const tr = (p) => page.locator(`#tree li[data-path="${p}"] > .row`);
  await tr(`${SENDER}.frozen`).click();
  await tr(`${SENDER}.frozen`).click();
  if ((await selected()).length) problems.push("row click did not toggle");
  // While a variable is selected, the view stays on it: an unrelated
  // byte changes nothing; its own bytes only change the info line; a
  // click on an unrelated byte switches the selection
  await tr(`${SENDER}.nonce`).click();
  const look = () => page.evaluate(() => JSON.stringify([
    [...document.querySelectorAll("#panel .b.hl:not(.cmp *)")].length,
    [...document.querySelectorAll("#panel .pop")].map((p) => p.innerText),
    document.querySelectorAll("#panel .cmp").length]));
  const locked0 = await look();
  const probe0 = await page.locator("#details").textContent();
  const balByte = page.locator(`#panel .word[data-side="after"] ` +
    `.b[data-owners="${SENDER}.balance"][data-i="30"]`);
  await balByte.hover();
  if (await look() !== locked0 ||
    await page.locator("#details").textContent() !== probe0) {
    problems.push("locked: an unrelated hover changed the view");
  }
  if (!(await page.locator("#viewing").textContent())
    .includes("viewing accounts[0xf39f…2266].nonce · Esc to clear")) {
    problems.push("locked: no viewing hint");
  }
  await page.locator(`#panel .word[data-side="after"] ` +
    `.b[data-owners="${SENDER}.nonce"][data-i="31"]`).hover();
  if (await look() !== locked0 ||
    await page.locator("#details").textContent() === probe0) {
    problems.push("locked: own byte hover");
  }
  await balByte.click();
  sel = await selected();
  if (sel.join() !== `${SENDER}.balance`) {
    problems.push(`locked: click did not switch: ${sel}`);
  }
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();

  // Shop and Packed render, with the slots named as the templates
  // computed them, and packed values as bands in one word
  await page.evaluate(() => window.select("shop-place"));
  const shopSlots = await page.locator("#panel .wrow[data-name]")
    .evaluateAll((rs) => rs.map((r) => r.dataset.name));
  if (!shopSlots.includes("keccak(keccak(1, slot 0) + 3) + 2") ||
    !shopSlots.includes("slot 3")) {
    problems.push(`shop slots: ${shopSlots}`);
  }
  await page.evaluate(() => window.select("packed-set"));
  // slot 0 holds owner, flag, b and a, in byte order
  const owners = await page.locator('#panel .word[data-side="after"]' +
    `[data-slot="0x${"0".repeat(64)}"] .b[data-owners]`).evaluateAll((cs) =>
    [...new Set(cs.map((c) => c.dataset.owners))]);
  if (owners.join() !== "owner,flag,b,a") problems.push(`owners: ${owners}`);
  await want("a", "a", [31], 2);
  await want("b", "b", [29, 30], 2);
  await want("owner", "owner", range(8, 27), 2);

  // Hovering a value lights it in both views and in the tree
  await page.locator('#tree li[data-path="b"] > .row').hover();
  const both = Object.keys(await lit());
  const slot0 = "0x" + "0".repeat(64);
  if (both.sort().join() !== `after ${slot0},before ${slot0}`) {
    problems.push(`b in both views: ${both}`);
  }
  if (!await page.locator('#tree li[data-path="b"] > .row.hl').count()) {
    problems.push("b: tree row not lit");
  }
  // while b is lit, every other byte and tree row steps back; lit ones
  // stay at full strength
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
  if (info.Value !== "b (uint16)" || info.Where !== "slot 0, bytes 29–30" ||
    info.Before !== "0 (0x0000)" || info.After !== "300 (0x012c)" ||
    info.scrolls) problems.push(`details b: ${JSON.stringify(info)}`);
  // and a popover at slot 0's address, in the dump shown
  const pops = () => page.locator("#panel .pop").allInnerTexts();
  let pp0 = await pops();
  if (pp0.join("|") !== "slot 0 · read, written") {
    problems.push(`pops b: ${pp0}`);
  }
  pp0 = [];
  // and from a byte in one view, the same position in the other
  for (const [from, to] of [["before", "after"], ["after", "before"]]) {
    await setMode(from);
    await page.locator(`#panel .word[data-side="${from}"]` +
      `[data-slot="${slot0}"] .b[data-i="30"]`).hover();
    const at = await page.evaluate(() => {
      const out = {};
      for (const c of document.querySelectorAll("#panel .b.at:not(.cmp *)")) {
        const w = c.closest(".word");
        (out[w.dataset.side] ??= []).push(+c.dataset.i);
      }
      return out;
    });
    const hl = Object.keys(await lit()).map((k) => k.split(" ")[0]);
    if (at[from]?.join() !== "29,30" || at[to]?.join() !== "29,30" ||
      !hl.includes(to)) {
      problems.push(`byte ${from} -> ${to}: ${JSON.stringify(at)} ${hl}`);
    }
  }
  await setMode("after");

  // A string's layout switches between short and long. Short: the data
  // and the length byte share the string's slot. Long: the slot holds
  // the length word, and the data lives at keccak(slot) on. Slots are
  // named here as the page names them (from the template's defines).
  await page.evaluate(() => window.select("strings-update"));
  const names = await page.locator('#panel .view[data-side="after"] ' +
    ".wrow[data-name]").evaluateAll((rs) => Object.fromEntries(
    rs.map((r) => [r.dataset.slot, r.dataset.name])));
  const strings = {
    grows: {
      before: { "slot 0": [...range(0, 4), 31] },
      after: { "slot 0": range(0, 31), "keccak(slot 0)": range(0, 31),
        "keccak(slot 0) + 1": range(0, 17) },
    },
    shrinks: {
      before: { "slot 1": range(0, 31), "keccak(slot 1)": range(0, 31),
        "keccak(slot 1) + 1": range(0, 13) },
      after: { "slot 1": [...range(0, 8), 31] },
    },
    most: { before: { "slot 2": range(0, 31) },
      after: { "slot 2": range(0, 31) } },
    least: {
      before: { "slot 3": range(0, 31), "keccak(slot 3)": range(0, 31) },
      after: { "slot 3": range(0, 31), "keccak(slot 3)": range(0, 31) },
    },
  };
  for (const [p, sides] of Object.entries(strings)) {
    await page.locator(`#tree li[data-path="${p}"] > .row`).hover();
    const named = {};
    for (const [k, v] of Object.entries(await lit())) {
      const [side, s] = k.split(" ");
      (named[side] ??= {})[names[s] ?? s] = v.join();
    }
    const want = Object.fromEntries(Object.entries(sides).map(([side, m]) =>
      [side, Object.fromEntries(Object.entries(m).map(([k, v]) =>
        [k, v.join()]))]));
    if (!same(named, want)) {
      problems.push(`${p} bytes: ${JSON.stringify(named)}`);
    }
  }
  // A slot used only in the other state gets its picture too: grows'
  // new data run in the Before dump, shrinks' old one in the After dump
  const onlyInsets = () => page.evaluate(() => [...document.querySelectorAll(
    "#panel .cmp:not(.pinned)")].map((el) => ({
    side: el.closest(".view").dataset.side,
    label: el.querySelector(".cmp-tag").textContent,
    rows: [...el.querySelectorAll(".cmp-photo > .wrow")].map((r) =>
      r.dataset.of),
    marked: [...el.closest(".view").querySelectorAll(".wrow.only")].map(
      (r) => r.dataset.slot),
  })).filter((x) => x.rows.length && x.rows.every((r) =>
    x.marked.includes(r))));
  for (const [p, side, label, run] of [
    ["grows", "before", "after", ["keccak(slot 0)",
      "keccak(slot 0) + 1"]],
    ["shrinks", "after", "before", ["keccak(slot 1)",
      "keccak(slot 1) + 1"]]]) {
    await setMode(side);
    await page.locator(`#tree li[data-path="${p}"] > .row`).hover();
    const got = await onlyInsets();
    const ok = got.length === 1 && got[0].side === side &&
      got[0].label === label &&
      got[0].rows.map((x) => names[x]).join() === run.join() &&
      got[0].marked.map((x) => names[x]).join() === run.join();
    if (!ok) problems.push(`${p} only-inset: ${JSON.stringify(got)}`);
  }
  await setMode("after");
  // shrinks in After: both runs (slot 1, lit; its old data, shown by a
  // "before" card) get their derivation label; no popover or card
  // covers a lit row's address label
  await setMode("after");
  await page.locator('#tree li[data-path="shrinks"] > .row').click();
  await page.mouse.move(1, 1);
  const labelled = await page.evaluate(() => {
    const v = document.querySelector('#panel .view[data-side="after"]');
    const pops = [...v.querySelectorAll(".pop:not(.pinned)")];
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
      a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const cells = [...v.querySelectorAll(".rows > .wrow > .addr .a")];
    const lit = cells.filter((c) => c.closest(".wrow.on, .wrow.only"));
    const box = (e) => e.getBoundingClientRect();
    const covered = [
      ...pops.flatMap((p) => lit.filter((c) => hit(box(p), box(c)))),
      ...[...v.querySelectorAll(".cmp:not(.pinned) .cmp-frame")].flatMap(
        (f) => lit.filter((c) => !f.closest(".wrow").contains(c) &&
          hit(box(f), box(c)))),
    ].map((c) => c.textContent);
    return { pops: pops.map((p) => p.querySelector(".pop-how").textContent),
      covered };
  });
  if (labelled.pops.length !== 2 ||
    !labelled.pops.some((t) => t.startsWith("slot 1")) ||
    !labelled.pops.some((t) => t.startsWith("keccak(slot 1) + 0 … + 1")) ||
    labelled.covered.length) {
    problems.push(`shrinks labels: ${JSON.stringify(labelled)}`);
  }
  await page.keyboard.press("Escape");
  // Each run's addresses sit in one group box in the gutter, and its
  // popover's arrow lands within that box (grows, shrinks; both states)
  for (const p of ["grows", "shrinks"]) {
    for (const m of ["before", "after"]) {
      await setMode(m);
      await page.locator(`#tree li[data-path="${p}"] > .row`).click();
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
      if (bad.length) problems.push(`${p} ${m} groups: ${bad}`);
      await page.keyboard.press("Escape");
    }
  }
  await setMode("after");
  // Each lit run has its card in both states, in place: the same count
  // in Before and After, and none in the tray
  for (const p of ["grows", "shrinks"]) {
    const n = [];
    for (const m of ["before", "after"]) {
      await setMode(m);
      await page.locator(`#tree li[data-path="${p}"] > .row`).hover();
      n.push(await page.locator("#panel .cmp:not(.pinned)").count());
      if (await page.locator("#panel .tray").count()) {
        problems.push(`${p} ${m}: tray used`);
      }
    }
    if (n[0] !== n[1] || !n[0]) problems.push(`${p} cards: ${n}`);
  }
  await setMode("after");
  const words = await page.locator("#panel .word:not(.cmp *)")
    .evaluateAll((ws) =>
    ws.map((w) => ({ side: w.dataset.side, slot: w.dataset.slot,
      zero: [...w.querySelectorAll(".b")].every((c) =>
        c.textContent === "00") })));
  const word = (side, n) => words.find((w) => w.side === side &&
    names[w.slot] === n);
  // shrinks: its old data slots are cleared after
  for (const n of ["keccak(slot 1)", "keccak(slot 1) + 1"]) {
    if (word("before", n)?.zero !== false || word("after", n)?.zero !== true) {
      problems.push(`shrinks: ${n} not cleared`);
    }
  }
  // grows: its data is a run of two consecutive slots, with no gap
  const run = await page.locator('#panel .view[data-side="after"] .rows')
    .evaluate((r) => [...r.children].map((c) => c.dataset.name ?? "gap"));
  const k0 = run.indexOf("keccak(slot 0)");
  if (k0 < 0 || run[k0 + 1] !== "keccak(slot 0) + 1") {
    problems.push(`grows run: ${run}`);
  }

  // At rest: no popover, and nothing in the dumps but addresses and
  // bytes (names live in the tree)
  await page.evaluate(() => window.select("token-transfer"));
  await page.locator("h1").hover();
  if ((await pops()).length) problems.push("popover at rest");
  await page.waitForTimeout(250);
  if (await page.locator("#panel.active, #tree.active").count()) {
    problems.push("dimmed at rest");
  }
  const dumpText = await page.locator("#panel .rows").allInnerTexts();
  const stray = dumpText.join(" ").replace(/[0-9a-f…⋯\s]/g, "");
  if (stray) problems.push(`text in the dump: ${stray.slice(0, 40)}`);
  // A hashed slot's popover says how it was found; a long value's
  // says how many more slots are lit
  await page.locator(`#tree li[data-path="${SENDER}.nonce"] > .row`).hover();
  pp0 = await pops();
  if (pp0.length !== 1 || !pp0[0].startsWith(
    "keccak(0xf39f…2266, slot 0) + 1 · read, written\n= 0x7230")) {
    problems.push(`pops nonce: ${pp0}`);
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
  await page.locator(`#tree li[data-path="${SENDER}.nonce"] > .row`).hover();
  aimed = [...aimed, ...await aim()];
  await setMode("after");
  if (aimed.length !== 2 || !aimed.every(Boolean)) {
    problems.push(`aim: ${aimed}`);
  }

  // The other state's picture beside the lit run. nonce: an "after"
  // card under its row in Before, a "before" card over it in After, at
  // bytes 24-31, in the same columns as the row
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
  const tops = () => page.locator("#panel .wrow:not(.cmp *)")
    .evaluateAll((rs) =>
      rs.map((r) => Math.round(r.getBoundingClientRect().top)).join());
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
  for (const m of ["before", "after"]) {
    await setMode(m);
    await page.locator("h1").hover();
    if ((await cmp()).length) problems.push(`${m}: card at rest`);
    const rest = await tops();
    const restBoxes = await boxes();
    const other = m === "before" ? "after" : "before";
    await page.locator(`#tree li[data-path="${SENDER}.nonce"] > .row`)
      .hover();
    let blocks = await cmp();
    const b0 = blocks[0];
    if (blocks.length !== 1 || b0.side !== m || b0.label !== other ||
      !(m === "before" ? b0.under : b0.over) ||
      b0.lines[0].bytes.join() !== range(24, 31).join() ||
      b0.lines[0].text !== (m === "before" ? "0000000000000001"
        : "0000000000000000") || !b0.lines[0].aligned || !b0.full) {
      problems.push(`${m}: nonce card: ${JSON.stringify(blocks)}`);
    }
    if (await popAt() !== (m === "before" ? "over" : "under")) {
      problems.push(`${m}: popover place: ${await popAt()}`);
    }
    // A struct lights a run of two slots: one card for the run, one
    // line per slot, aligned; no clashes; nothing moves, no scrollbar
    await page.locator(`#tree li[data-path="${SENDER}"] > .row`).hover();
    blocks = await cmp();
    if (blocks.length !== 1 || blocks[0].lines.length !== 2 ||
      blocks[0].lines[0].bytes.length !== 32 ||
      blocks[0].lines[1].bytes.join() !== range(23, 31).join() ||
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
    await page.locator(`#tree li[data-path="${SENDER}"] > .row`).hover();
    await page.waitForTimeout(300);
    await page.locator(".words").first().screenshot({
      path: shot("insets.png") });
  }
  // and by keyboard, from an address in the gutter
  await page.locator("h1").hover();
  await page.locator('#panel .view[data-side="after"] .wrow ' +
    `[tabindex]`).first().focus();
  pp0 = await pops();
  if (pp0.length !== 1) problems.push(`pops on focus: ${pp0}`);
  await page.locator("h1").hover();
  await page.evaluate(() => document.activeElement.blur());

  // Both dumps list the same slots, in ascending address order, with a
  // gap line before the first and wherever the addresses jump
  for (const id of ["token-transfer", "shop-place", "packed-set",
    "strings-update"]) {
    await page.evaluate((x) => window.select(x), id);
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
  await page.evaluate(() => window.select("shop-place"));
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
  await page.evaluate(() => window.select("packed-set"));
  await page.locator('#panel .word[data-side="after"] ' +
    '.b[data-owners="b"][data-i="30"]').click();
  await page.locator("h1").hover();
  if (name === "chromium") {
    await page.locator(".cols").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0,
      document.querySelector(".cols").offsetTop - 8));
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot("desktop-packed.png") });
  }

  // "How this was found": clicking any row selects it and shows its
  // derivation, changed or not. frozen did not change.
  await page.evaluate(() => window.select("token-transfer"));
  const row = (p) => page.locator(`#tree li[data-path="${p}"] > .row`);
  const how = () => page.locator("#how").textContent();
  await row(`${SENDER}.frozen`).click();
  let text = await how();
  for (const want of ["Template", "$keccak256", "Region", "offset",
    "from the program context", "from the trace", "same bytes in both"]) {
    if (!text.includes(want)) problems.push(`frozen how lacks "${want}"`);
  }
  // nonce did change; its source mark and region step
  await row(`${SENDER}.nonce`).click();
  const mark = await page.locator("#src mark").innerText();
  if (!mark.includes("struct Account")) problems.push(`mark: ${mark}`);
  await page.locator("#how li[data-region]").last().hover();
  const step = await lit();
  if (!Object.keys(step).every((k) => k.startsWith("after ")) ||
    Object.values(step).flat().join() !== range(24, 31).join()) {
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
  // a value with no template, unchanged: the program context gives its
  // region
  await row("totalSupply").click();
  text = await how();
  if (!text.includes("from the program context") ||
    !text.includes("no template")) {
    problems.push("totalSupply how");
  }

  // The mode: Before or After shows that dump only, and the derivation
  // and the tree follow it (After by default)
  const views = () => page.locator("#panel .view").evaluateAll((vs) =>
    vs.filter((v) => !v.hidden && v.offsetHeight).map((v) =>
      v.dataset.side).join());
  const sides = () => page.locator("#how li[data-region]").evaluateAll(
    (ls) => [...new Set(ls.map((l) => l.dataset.side))].join());
  await row(`${SENDER}.balance`).click();
  for (const [m, val] of [["before", "1000"], ["after", "975"]]) {
    await setMode(m);
    const v = await views();
    const d = await sides();
    const t = await how();
    const shownVal = await row(`${SENDER}.balance`)
      .locator(".val > span:first-child").innerText();
    if (v !== m) problems.push(`mode ${m}: views ${v}`);
    if (d !== m) problems.push(`mode ${m}: derivation for ${d}`);
    if (!t.includes(`${m} the transaction`)) {
      problems.push(`mode ${m}: panel does not say whose`);
    }
    if (shownVal.trim() !== val) {
      problems.push(`mode ${m}: tree shows ${shownVal}`);
    }
  }

  // The tree's cards: none at rest; a lit changed value gets one with
  // the other state's value (balance: "after 975" under it in Before,
  // "before 1000" over it in After); an unchanged one gets none
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
  for (const [m, want, place] of [["before", "after975", "under"],
    ["after", "before1000", "over"]]) {
    await setMode(m);
    await page.locator("h1").hover();
    if ((await tins()).length) problems.push(`${m}: tree card at rest`);
    await row(`${SENDER}.balance`).hover();
    const t = await tins();
    if (t.length !== 1 || t[0].path !== `${SENDER}.balance` ||
      t[0].text !== want || t[0].place !== place) {
      problems.push(`tree card ${m}: ${JSON.stringify(t)}`);
    }
    await row(`${SENDER}.frozen`).hover();
    if ((await tins()).length) problems.push(`${m}: card for unchanged`);
  }
  // No card for what did not change: selecting an unchanged value gives
  // none, in the tree or the dump, in either state
  for (const p of [`${TO}.nonce`, `${SENDER}.frozen`, "totalSupply"]) {
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
  await row(`${SENDER}.nonce`).hover();
  if ((await tins()).length ||
    await page.locator("#panel .cmp").count() ||
    !Object.keys(await lit()).length) {
    problems.push("insets off: still shown, or nothing lit");
  }
  if (!(await page.evaluate(() => location.hash)).includes("insets=0")) {
    problems.push("insets off: not in the hash");
  }
  await page.locator("#insets").check();
  await row(`${SENDER}.balance`).hover();
  if (!(await tins()).length ||
    (await page.evaluate(() => location.hash)).includes("insets=")) {
    problems.push("insets on again");
  }
  await page.locator("h1").hover();

  // Strings: shrinks goes long -> short. The panel forks where the two
  // derivations part: steps 1-3 once, the IF with both evaluations,
  // then one list per branch, this state's first
  await page.evaluate(() => window.select("strings-update"));
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
  await row("shrinks").click();
  let fk = await forkOf();
  if (fk.shared !== 4 || fk.evals.length !== 2 ||
    !/^before .* → else$/.test(fk.evals[0]) ||
    !/^after .* → then$/.test(fk.evals[1]) ||
    fk.branches.length !== 2 || !fk.branches[0].cls.includes("mine") ||
    fk.branches[0].head !== "after · then (short-string layout)" ||
    fk.branches[1].head !== "before · else (long-string layout)" ||
    fk.branches.some((b) => b.start !== "5") ||
    fk.branches[0].result !== "after" || fk.branches[1].result !== "before") {
    problems.push(`shrinks fork (after): ${JSON.stringify(fk)}`);
  }
  // in Before, the before branch comes first
  await setMode("before");
  fk = await forkOf();
  if (fk.branches[0]?.head !== "before · else (long-string layout)" ||
    fk.branches[0]?.result !== "before") {
    problems.push(`shrinks fork (before): ${JSON.stringify(fk)}`);
  }
  // with "show other state" off: one list, this state's only
  await page.locator("#insets").uncheck();
  fk = await forkOf();
  if (fk.branches.length || fk.evals.length) {
    problems.push(`shrinks, other state off: ${JSON.stringify(fk)}`);
  }
  await page.locator("#insets").check();
  await setMode("after");
  // grows: the result of this state's branch is the long data
  await row("grows").click();
  const result = () => page.locator("#how li.final").first().evaluate((l) =>
    [l.dataset.side, JSON.parse(l.dataset.region).slot]);
  let [rs, slot] = await result();
  if (rs !== "after" || !slot.startsWith("0x290d") ||
    !(await how()).includes("so take else")) {
    problems.push(`grows after: ${rs} ${slot}`);
  }
  await setMode("before");
  [rs, slot] = await result();
  if (rs !== "before" || BigInt(slot) !== 0n ||
    !(await how()).includes("so take then")) {
    problems.push(`grows before: ${rs} ${slot}`);
  }
  // hovering the result lights the before bytes now
  await page.locator("#how li.final").first().hover();
  const gl = Object.keys(await lit()).map((k) => k.split(" ")[0]);
  if (gl.join() !== "before") problems.push(`grows result lit: ${gl}`);
  // most (31 bytes both times) takes the same path
  await row("most").click();
  if (await page.locator("#how .branch, #how .evals").count() ||
    !(await how()).includes("same bytes in both")) {
    problems.push("most: reported a difference");
  }
  await setMode("after");
  await page.keyboard.press("Escape");

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

  // The URL hash keeps the view: loading with one restores the example,
  // the mode, the selection and the memory points; a stale one falls
  // back to the defaults
  const hp = await ctx.newPage();
  hp.on("pageerror", (e) => problems.push(`hash pageerror: ${e}`));
  hp.on("console", (m) => {
    if (m.type() === "error") problems.push(`hash console: ${m.text()}`);
  });
  await hp.goto(PAGE + "#ex=strings&mode=before&sel=grows&a=written&" +
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
  if (!same(hs, { ex: "strings-update", mode: "before", sel: "grows",
    how: "before", a: "written", b: "replaced", mmode: "before",
    msel: "names[1]",
    insets: false, hash: hs.hash }) || !hs.hash.includes("ex=strings") ||
    !hs.hash.includes("sel=grows")) {
    problems.push(`hash restore: ${JSON.stringify(hs)}`);
  }
  // changes go back into the hash
  await hp.locator('#mode button[data-mode="after"]').click();
  await hp.locator('#tree li[data-path="most"] > .row').click();
  const h2 = await hp.evaluate(() => location.hash);
  if (!h2.includes("mode=after") || !h2.includes("sel=most")) {
    problems.push(`hash write: ${h2}`);
  }
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
  if (stale.join() !== "token-transfer,after,0,built") {
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
  await pp.evaluate(() => window.select("strings-update"));
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
  await pp.locator('#tree li[data-path="grows"] > .row').click();
  if (await vbox() !== vrest) {
    problems.push(`phone: the words' box changed: ${vrest} -> ${
      await vbox()}`);
  }
  const phoneLit = await pp.locator("#panel .b.hl:not(.cmp *)").count();
  // before: 5 bytes of "short" and its length byte; after: the
  // long-length word (holds the flag byte) and 50 bytes of data across
  // two slots
  if (phoneLit !== 6 + 32 + 50) {
    problems.push(`phone: ${phoneLit} bytes lit for grows`);
  }
  const scrollX = await pp.evaluate(() =>
    document.documentElement.scrollWidth >
      document.documentElement.clientWidth);
  if (scrollX) problems.push("phone: page scrolls sideways");
  await pp.waitForFunction(() => window.memResults?.done);
  // the derivation panel forks into the two branches
  if (await pp.locator("#how .branch").count() !== 2) {
    problems.push("phone: no difference shown for grows");
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
  // example's data (HTTP 503)
  problems.push(...await retryCheck(browser, "vendor/pointers.js",
    { abort: true }));
  problems.push(...await retryCheck(browser,
    "fixtures/token-transfer.json", { via: "#tree .error button" }));
  if (name === "chromium") problems.push(...await slowLink(browser));

  console.log(`${name} ${browser.version()}: ${problems.length
    ? "FAIL\n  " + problems.join("\n  ") : "ok"}`);
  failed += problems.length;
  await browser.close();
}
server.close();
process.exit(failed ? 1 : 0);
