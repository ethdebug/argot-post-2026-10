// Runs soldb-wasm in the page. One viewer steps two data sets with the
// same code: a Solidity transaction (solc's ethdebug) and a Fe
// transaction (Fe's ethdebug). The BUG tab links to ethdebug's reference
// viewer; the details run a soldb check on the BUG transaction. Part B
// (details) replays a transaction with the replay build. Results go to
// the DOM and to window.results.

const results = { env: {}, a: null, fe: null, bug: null, b: null,
  shiki: null };
window.results = results;

const $ = (id) => document.getElementById(id);
const now = () => performance.now();
const text = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
};
const json = async (url) => JSON.parse(await text(url));
// Display only: Shiki colours the source and draws soldb's span. It
// never computes a source mapping. Fe has no Shiki grammar; `rust` is a
// close approximation.
const SHIKI = "https://esm.sh/shiki@3.13.0";
const THEMES = { light: "github-light", dark: "github-dark" };
const shikiReady = (async () => {
  const t = performance.now();
  const shiki = await import(SHIKI);
  const hl = await shiki.createHighlighter({
    themes: Object.values(THEMES), langs: ["solidity", "rust"],
  });
  results.shiki = { loadMs: performance.now() - t, renders: 0, maxMs: 0 };
  return hl;
})().catch((e) => { console.warn("Shiki failed to load", e); return null; });

// A span that covers most of the file is the whole contract: the step
// is compiler-generated code (dispatcher, ABI, checks), not one range.
const isWhole = (span, srcLen) => span.length >= 0.8 * srcLen;

const esc = (t) => t.replace(/[&<>]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const ms = (x) => `${x.toFixed(1)} ms`;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const base = (p) => p.split("/").pop();

async function timed(times, label, fn) {
  const t = now();
  const v = await fn();
  times.push([label, now() - t]);
  return v;
}

function showTimes(el, times, extra) {
  el.innerHTML = "";
  const add = (k, v, n) => {
    const tr = el.insertRow();
    tr.insertCell().textContent = k;
    const c = tr.insertCell();
    c.textContent = v;
    if (n) c.className = "n";
  };
  for (const [k, v] of times) add(k, ms(v), true);
  for (const [k, v] of extra) add(k, v);
}

const source = (id, text, extra) =>
  ({ id, text, ascii: !/[^\x00-\x7f]/.test(text), ...extra });

// soldb reports byte offsets. JS strings index UTF-16 units, so a file
// with non-ASCII text needs a conversion to draw the span (display only).
function charIndex(src, byte) {
  if (src.ascii) return byte;
  src.bytes ??= new TextEncoder().encode(src.text);
  return new TextDecoder().decode(src.bytes.subarray(0, byte)).length;
}

// Visits every step once. Returns per-step spans [sourceId, start, end]
// (null for compiler-generated code), soldb's line and EVM call depth
// (for stepping), and the steps where the source line changes.
function walk(trace, sources) {
  const n = trace.stepCount();
  const spans = new Array(n);
  const lines = new Array(n);
  const lineNo = new Array(n);
  const depths = new Array(n);
  const changes = [];
  const bySource = {};
  let generated = 0, mapped = 0, last = null;
  for (let i = 0; i < n; i++) {
    const step = JSON.parse(trace.step(i));
    const s = step.source;
    depths[i] = step.depth;
    lineNo[i] = s ? s.line : null;
    lines[i] = s ? `${base(s.path)}:${s.line}` : null;
    const src = s && sources[s.source_id];
    // soldb's span: source.offset and source.length (bytes).
    const gen = !s || !src || isWhole(s, src.text.length);
    spans[i] = gen ? null : [s.source_id, charIndex(src, s.offset),
      charIndex(src, s.offset + s.length)];
    if (s) {
      mapped++;
      bySource[s.source_id] = (bySource[s.source_id] ?? 0) + 1;
    }
    if (gen) generated++;
    if (!gen && lines[i] !== last) {
      changes.push(i);
      last = lines[i];
    }
  }
  const flat = Math.min(...depths) === Math.max(...depths);
  return { n, spans, lines, lineNo, depths, flat, changes, mapped,
    generated, bySource };
}

// Stepping, computed by the page from two fields soldb reports per step:
// the source span and the EVM call depth. `go` is "into", "over" or
// "out"; `d` is 1 (forward) or -1 (back). Returns a step, or undefined.
function nav(w, i, go, d) {
  const key = (j) => w.spans[j] && w.spans[j].join(":");
  const find = (from, ok) => {
    for (let j = from; j >= 0 && j < w.n; j += d) if (ok(j)) return j;
  };
  if (go === "out") {
    const j = find(i + d, (j) => w.depths[j] < w.depths[i]);
    return j === undefined ? undefined : find(j, key);
  }
  let j = find(i + d, (j) => key(j) && key(j) !== key(i) &&
    (go === "into" || w.depths[j] <= w.depths[i]));
  // Back: go to the first step of that span.
  while (d < 0 && j > 0 && key(j - 1) === key(j)) j--;
  return j;
}

// Run to here: the next step whose soldb line is `line` in source `id`.
// From that line itself, the next visit to it.
function runTo(w, i, id, line) {
  const on = (j) => w.spans[j] && w.spans[j][0] === id
    && w.lineNo[j] === line;
  let j = i + 1;
  if (on(i)) while (j < w.n && (on(j) || !w.spans[j])) j++;
  for (; j < w.n; j++) if (on(j)) return j;
}

// The one viewer. `show(ds)` switches the data set; Solidity and Fe go
// through the same code.
const viewer = (() => {
  const box = $("stepper");
  const range = box.querySelector("input");
  const srcEl = box.querySelector(".src");
  const note = box.querySelector(".gen-note");
  const where = $("where");
  const msg = $("msg");
  const buttons = [...box.querySelectorAll("button[data-go]")];
  const cache = new Map();
  let hl = null, ds = null, shown = null;
  const render = (src, span) => {
    const key = `${ds.key}:${src.id}:${span ? span.join(":") : ""}`;
    let html = cache.get(key);
    if (html === undefined) {
      const t = now();
      html = hl.codeToHtml(src.text, {
        lang: ds.lang, themes: THEMES, defaultColor: false,
        decorations: span
          ? [{ start: span[1], end: span[2], properties: { class: "hl" } }]
          : [],
      });
      const dt = now() - t;
      results.shiki.renders++;
      results.shiki.maxMs = Math.max(results.shiki.maxMs, dt);
      cache.set(key, html);
    }
    return html;
  };
  const step = (i) => {
    range.value = String(i);
    const s = JSON.parse(ds.trace.step(i));
    const span = ds.walked.spans[i];
    const fn = s.function && s.function.name ? ` in ${s.function.name}` : "";
    const loc = s.source ? `${base(s.source.path)}:${s.source.line}`
      : "no source";
    where.textContent =
      `step ${i} / ${ds.walked.n - 1}: pc ${s.pc} ${s.op}, ${loc}${fn}`;
    const src = ds.sources[span ? span[0] : ds.main];
    shown = src.id;
    msg.textContent = "";
    for (const b of buttons) {
      b.target = nav(ds.walked, i, b.dataset.go, +b.dataset.d);
      b.disabled = b.target === undefined ||
        (ds.walked.flat && b.dataset.go !== "into");
      b.title = b.disabled && ds.walked.flat && b.dataset.go !== "into"
        ? "Every step here is at EVM call depth 1" : "";
    }
    srcEl.innerHTML = hl ? render(src, span) : `<pre>${esc(src.text)}</pre>`;
    srcEl.classList.toggle("faded", !span);
    note.textContent = !span
      ? "compiler-generated code (no specific source)"
      : src.lib ? `in Fe's standard library: ${src.lib}` : "";
    note.classList.toggle("on", !span || !!src.lib);
    const marks = srcEl.querySelectorAll(".hl");
    if (marks.length) {
      // Centre the span's start line (or the span, if it fits) in the
      // code box. Scroll the box only, never the page.
      const top = marks[0].getBoundingClientRect().top;
      const bot = marks[marks.length - 1].getBoundingClientRect().bottom;
      const box0 = srcEl.getBoundingClientRect();
      const h = Math.min(bot - top, srcEl.clientHeight / 2);
      srcEl.scrollTop += top + h / 2 - (box0.top + srcEl.clientHeight / 2);
    } else {
      srcEl.scrollTop = 0;
    }
  };
  range.oninput = () => step(+range.value);
  for (const b of buttons) {
    b.onclick = () => b.target !== undefined && step(b.target);
  }
  // Keys: arrows step into, Shift+arrows step over, Shift+up/down out.
  // The slider keeps its own arrow keys (one instruction).
  const KEYS = {
    ArrowRight: ["into", 1], ArrowLeft: ["into", -1],
    "Shift+ArrowRight": ["over", 1], "Shift+ArrowLeft": ["over", -1],
    "Shift+ArrowDown": ["out", 1], "Shift+ArrowUp": ["out", -1],
  };
  document.addEventListener("keydown", (e) => {
    if (box.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) {
      return;
    }
    const k = KEYS[(e.shiftKey ? "Shift+" : "") + e.key];
    if (!k) return;
    e.preventDefault();
    const b = buttons.find((b) => b.dataset.go === k[0]
      && +b.dataset.d === k[1]);
    if (!b.disabled) b.click();
  });
  // Run to here: click a source line.
  srcEl.onclick = (e) => {
    const el = e.target.closest(".line");
    if (!el) return;
    const line = [...srcEl.querySelectorAll(".line")].indexOf(el) + 1;
    const i = +range.value;
    const j = runTo(ds.walked, i, shown, line);
    if (j !== undefined) step(j);
    else msg.textContent = `Line ${line} is not reached after step ${i}.`;
  };
  const save = () => { if (ds) ds.pos = +range.value; };
  return {
    hide() { save(); ds = null; box.hidden = true; },
    async show(next) {
      hl = await shikiReady;
      save();
      ds = next;
      range.max = String(ds.walked.n - 1);
      box.hidden = false;
      // Open at the first step in the contract's own file.
      const c = ds.walked.changes;
      step(ds.pos ?? c.find((i) => ds.walked.spans[i][0] === ds.main)
        ?? c[0] ?? 0);
    },
  };
})();

const datasets = {};
window.walked = {};

async function select(key) {
  if (key !== "bug" && !datasets[key]) return;
  for (const t of document.querySelectorAll("[role=tab]")) {
    t.setAttribute("aria-selected", String(t.dataset.ds === key));
  }
  for (const p of document.querySelectorAll("[data-about]")) {
    p.hidden = !p.dataset.about.split(" ").includes(key);
  }
  if (key !== "bug") return viewer.show(datasets[key]);
  viewer.hide();
  const pre = $("bug-src");
  if (!pre.textContent) pre.textContent = await text(`${BUG}/tally.bug`);
}
for (const t of document.querySelectorAll("[role=tab]")) {
  t.onclick = () => select(t.dataset.ds);
}
window.select = select;

// Both data sets use the same lean module.
const lean = (async () => {
  const times = [];
  const mod = await timed(times, "import JS glue", () =>
    import("./pkg-lean/soldb_wasm.js"));
  const out = await timed(times, "fetch + compile + instantiate wasm", () =>
    mod.default({ module_or_path: "./pkg-lean/soldb_wasm_bg.wasm" }));
  return { mod, out, times };
})();

// Solidity: Shop `place`, saved native trace, solc's ethdebug (#16990).
async function loadSolidity() {
  const { mod, out, times } = await lean;
  const traceText = await timed(times, "fetch saved trace", () =>
    text("./shop-debug-rpc.trace.json"));
  const trace = await timed(times, "Trace.fromJson (parse)", () =>
    mod.Trace.fromJson(traceText));
  const dir = "./art/pr16990-Shop";
  const [metadata, program, sol] = await timed(times,
    "fetch ethdebug artifacts", () => Promise.all([
      json(`${dir}/ethdebug_resources.json`),
      json(`${dir}/Shop_ethdebug-runtime.json`),
      text(`${dir}/Shop.sol`),
    ]));
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: "Shop", metadata, program, sources: { 0: sol } })));
  const sources = { 0: source(0, sol) };
  const walked = await timed(times, "step() every step + JSON.parse", () =>
    walk(trace, sources));
  const summary = JSON.parse(trace.summary());
  const r = {
    ok: true, times: Object.fromEntries(times),
    replayAvailable: mod.replayAvailable(), version: mod.version(),
    traceBytes: traceText.length, steps: walked.n, mapped: walked.mapped,
    lineChanges: walked.changes.length, generated: walked.generated,
    firstLines: walked.changes.slice(0, 12).map((i) => walked.lines[i]),
    debugInfo: summary.debugInfo,
    wasmMemory: out.memory.buffer.byteLength,
  };
  results.a = r;
  showTimes($("a-times"), times, [
    ["module", `soldb ${r.version}, replayAvailable() = ${r.replayAvailable}`],
    ["trace", `${kb(r.traceBytes)}, ${r.steps} steps, ` +
      `${r.mapped} with a source line (${r.generated} compiler-generated, ` +
      `whole-contract span), ${r.lineChanges} line changes`],
    ["wasm memory after", kb(r.wasmMemory)],
  ]);
  return { key: "sol", trace, sources, main: 0, lang: "solidity", walked };
}

// Fe: Tally `Add{n: 4}` on anvil, Fe 26.4.1's ethdebug. The page adapts
// only the file layout (listed on the page): it picks the `call`
// program and supplies the source text that Fe's file leaves out.
const FE = "fe";
const FE_STD = {
  "builtin-core:/src/": `${FE}/src/core/`,
  "builtin-std:/src/": `${FE}/src/std/`,
};
async function loadFe() {
  const { mod } = await lean;
  const times = [];
  const [dbg, tx, receipt, artifact] = await timed(times,
    "fetch node responses + Fe ethdebug", () => Promise.all([
      text(`${FE}/tx.debug-trace.json`), text(`${FE}/tx.transaction.json`),
      text(`${FE}/tx.receipt.json`), json(`${FE}/tally.ethdebug.json`),
    ]));
  const trace = await timed(times, "Trace.fromTransaction (parse)", () =>
    mod.Trace.fromTransaction(dbg, tx, receipt));
  // Adaptation 1: Fe's file holds two programs; pass the runtime one.
  const program = artifact.programs.find((p) => p.environment === "call");
  // Adaptation 2: Fe lists sources without contents; fetch the text.
  // The user file sits next to the artifact; std-library files are
  // copies from the Fe repository at tag v26.4.1 (blake3 hashes match).
  const list = artifact.compilation.sources;
  const texts = await timed(times, "fetch Fe source text", () =>
    Promise.all(list.map((s) => {
      const pre = Object.keys(FE_STD).find((p) => s.uri.startsWith(p));
      return text(pre ? FE_STD[pre] + s.uri.slice(pre.length)
        : `${FE}/${base(s.path)}`);
    })));
  const sources = {};
  const textById = {};
  list.forEach((s, k) => {
    sources[s.id] = source(s.id, texts[k],
      s.uri.startsWith("builtin-") ? { lib: s.uri } : {});
    textById[s.id] = texts[k];
  });
  // `metadata` is Fe's whole file, unchanged: soldb reads the source ids
  // and paths from its `compilation`. No resources are added.
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: program.contract.name, metadata: artifact,
      program, sources: textById })));
  const walked = await timed(times, "step() every step + JSON.parse", () =>
    walk(trace, sources));
  const summary = JSON.parse(trace.summary());
  let withFunction = 0, withVariables = 0;
  for (let i = 0; i < walked.n; i++) {
    const s = JSON.parse(trace.step(i));
    if (s.function) withFunction++;
    if (s.variables.length) withVariables++;
  }
  const userSteps = walked.bySource[0] ?? 0;
  const r = {
    ok: true, times: Object.fromEntries(times),
    steps: walked.n, mapped: walked.mapped, userSteps,
    lineChanges: walked.changes.length, generated: walked.generated,
    bySource: walked.bySource, withFunction, withVariables,
    firstLines: walked.changes.slice(0, 12).map((i) => walked.lines[i]),
    debugInfo: summary.debugInfo, success: summary.success,
  };
  results.fe = r;
  showTimes($("fe-times"), times, [
    ["trace", `${kb(dbg.length)}, ${r.steps} steps, ${r.mapped} with a ` +
      `source span (${userSteps} in tally.fe, ${r.mapped - userSteps} in ` +
      `Fe's standard library), ${r.lineChanges} line changes`],
    ["soldb's debug info", `${summary.debugInfo.instructions} ` +
      `instructions, ${list.length} sources, variables at ` +
      `${summary.debugInfo.pcsWithVariables} pcs`],
    ["functions / variables", `${withFunction} / ${withVariables} steps ` +
      "(soldb's function detection targets Solidity; Fe emits no variables)"],
  ]);
  return { key: "fe", trace, sources, main: 0, lang: "rust", walked };
}

// BUG: Tally on anvil, bugc's ethdebug program. soldb is fed as for Fe;
// the page adapts the file layout (bugc writes no resources file) and,
// for the second run, the source id (soldb reads numeric ids only).
const BUG = "bug";
async function bugCheck() {
  const { mod } = await lean;
  const times = [];
  const [dbg, tx, receipt, programText, bug] = await timed(times,
    "fetch node responses + bugc program", () => Promise.all([
      text(`${BUG}/tx.debug-trace.json`), text(`${BUG}/tx.transaction.json`),
      text(`${BUG}/tx.receipt.json`), text(`${BUG}/tally.program.json`),
      text(`${BUG}/tally.bug`),
    ]));
  const trace = await timed(times, "Trace.fromTransaction (parse)", () =>
    mod.Trace.fromTransaction(dbg, tx, receipt));
  // What soldb reports, over every step.
  const report = (id, program) => {
    trace.attachEthdebug(JSON.stringify({ name: "Tally", program,
      metadata: { compilation: { sources: [{ id, path: "tally.bug" }] } },
      sources: id === 0 ? { 0: bug } : {} }));
    const r = { spans: 0, withVariables: 0, decoded: 0 };
    const fns = new Set(), vars = new Set();
    for (let i = 0; i < trace.stepCount(); i++) {
      const s = JSON.parse(trace.step(i));
      if (s.source) r.spans++;
      if (s.function) fns.add(s.function.name);
      if (s.variables.length) r.withVariables++;
      for (const v of s.variables) {
        vars.add(`${v.name}: ${v.ty} (${v.location.kind}[` +
          `${v.location.offset}], ${v.value.status})`);
        if (v.value.status === "decoded") r.decoded++;
      }
    }
    const info = JSON.parse(trace.summary()).debugInfo;
    return { ...r, functions: [...fns], variables: [...vars],
      pcsWithVariables: info.pcsWithVariables };
  };
  const asEmitted = report("tally.bug", JSON.parse(programText));
  const numeric = report(0, JSON.parse(
    programText.replaceAll('"id": "tally.bug"', '"id": 0')));
  const summary = JSON.parse(trace.summary());
  const r = { ok: true, times: Object.fromEntries(times),
    steps: trace.stepCount(), success: summary.success, asEmitted, numeric };
  results.bug = r;
  const row = (x) => `${x.spans} steps with a span; functions: ` +
    `${x.functions.join(", ") || "none"}; variables at ` +
    `${x.pcsWithVariables} pcs, on ${x.withVariables} steps, ` +
    `${x.decoded} decoded; as ${x.variables.join("; ") || "none"}`;
  showTimes($("bug-times"), times, [
    ["trace", `${kb(dbg.length)}, ${r.steps} steps`],
    ["source id \"tally.bug\" (as emitted)", row(asEmitted)],
    ["source id 0", row(numeric)],
  ]);
}

async function partB() {
  const times = [];
  const mod = await timed(times, "import JS glue", () =>
    import("./pkg-replay/soldb_wasm.js"));
  const out = await timed(times, "fetch + compile + instantiate wasm", () =>
    mod.default({ module_or_path: "./pkg-replay/soldb_wasm_bg.wasm" }));
  if (!mod.replayAvailable()) throw new Error("replay build has no Replay");
  const file = await timed(times, "fetch replay file", () =>
    json("./replay/transfer.json"));
  const s = JSON.stringify;
  const replay = await timed(times, "Replay.prepare", () =>
    mod.Replay.prepare(s(file.transaction), s(file.receipt), s(file.block),
      String(file.chainId)));
  let rounds = 0;
  let status = JSON.parse(replay.status());
  await timed(times, "provideState + run (EVM)", () => {
    while (status.status === "needsState") {
      if (rounds++ > 0) {
        throw new Error("replay file lacks state: " + s(status.requests));
      }
      replay.provideState(s(file.state));
      status = JSON.parse(replay.run());
    }
  });
  if (status.status !== "complete") throw new Error(s(status));
  const trace = await timed(times, "finish", () => replay.finish());
  const dir = "./art/pr16990-Token";
  const [metadata, program, sol] = await timed(times,
    "fetch ethdebug artifacts", () => Promise.all([
      json(`${dir}/ethdebug_resources.json`),
      json(`${dir}/Token_ethdebug-runtime.json`),
      text(`${dir}/Token.sol`),
    ]));
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: "Token", metadata, program, sources: { 0: sol } })));
  const walked = await timed(times, "step() every step + JSON.parse", () =>
    walk(trace, { 0: source(0, sol) }));
  const summary = JSON.parse(trace.summary());
  const r = {
    ok: true, times: Object.fromEntries(times), rounds,
    version: mod.version(), steps: walked.n, mapped: walked.mapped,
    lineChanges: walked.changes.length, generated: walked.generated,
    firstLines: walked.changes.slice(0, 12).map((i) => walked.lines[i]),
    backend: summary.backend, success: summary.status ?? summary.success,
    debugInfo: summary.debugInfo,
    wasmMemory: out.memory.buffer.byteLength,
  };
  results.b = r;
  showTimes($("b-times"), times, [
    ["module", `soldb ${r.version}, replayAvailable() = true`],
    ["replay", `${rounds} run(s), ${r.steps} steps, ` +
      `${r.mapped} with a source line (${r.generated} compiler-generated, ` +
      `whole-contract span), ${r.lineChanges} line changes`],
    ["wasm memory after", kb(r.wasmMemory)],
  ]);
  $("b-status").textContent = "Works. No node was contacted.";
  $("b-status").className = "status ok";
}

function fail(part, e) {
  results[part] = { ok: false, error: String(e && e.stack || e) };
  $(`${part}-status`).textContent = `Failed: ${e}`;
  $(`${part}-status`).className = "status bad";
  console.error(e);
}

function listRequests() {
  const el = $("reqs");
  el.innerHTML = "";
  const reqs = performance.getEntriesByType("resource")
    .filter((e) => !e.name.endsWith("/events"));
  results.requests = reqs.map((e) => e.name);
  const here = reqs.filter((e) => new URL(e.name).origin === location.origin);
  results.cdnRequests = reqs.length - here.length;
  for (const e of here) {
    const tr = el.insertRow();
    tr.insertCell().textContent = decodeURI(new URL(e.name).pathname);
    const c = tr.insertCell();
    c.className = "n";
    c.textContent = e.transferSize ? kb(e.transferSize) : "";
  }
  $("cdn").textContent = `Not listed: ${results.cdnRequests} requests ` +
    "for Shiki (esm.sh), which colours the source. It is display code " +
    "only; soldb needs none of them.";
}

results.env = {
  userAgent: navigator.userAgent,
  crossOriginIsolated: self.crossOriginIsolated,
  sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
};
$("env").textContent = navigator.userAgent;

const t0 = now();
for (const [key, part, load] of [["sol", "a", loadSolidity],
  ["fe", "fe", loadFe]]) {
  try {
    datasets[key] = await load();
    window.walked[key] = datasets[key].walked;
    $(`${part}-status`).textContent = "Works.";
    $(`${part}-status`).className = "status ok";
    document.querySelector(`[data-ds=${key}]`).disabled = false;
    if (key === "sol") await select("sol");
  } catch (e) { fail(part, e); }
}
if (!datasets.sol && datasets.fe) await select("fe");
$("bug-status").textContent = "Running...";
try {
  await bugCheck();
  $("bug-status").textContent = "Works.";
  $("bug-status").className = "status ok";
} catch (e) { fail("bug", e); }
$("b-status").textContent = "Running...";
try { await partB(); } catch (e) { fail("b", e); }
results.totalMs = now() - t0;
listRequests();
results.done = true;
document.body.dataset.done = "1";
