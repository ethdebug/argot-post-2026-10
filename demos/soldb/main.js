// The page: UI, highlighting and stepping. soldb-wasm does the
// debugging, in a Web Worker behind engine.js; the page only displays
// what the engine reports. One viewer steps two data sets with the same
// code: a Solidity transaction (solc's ethdebug) and a Fe transaction
// (Fe's ethdebug). The BUG tab links to ethdebug's reference viewer; the
// details run a soldb check on the BUG transaction. Part B (details)
// replays a transaction with the replay build. Results go to the DOM
// and to window.results.

import { soldbEngine } from "./engine.js";

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

const esc = (t) => t.replace(/[&<>]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const ms = (x) => `${x.toFixed(1)} ms`;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
const base = (p) => p.split("/").pop();

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

// The engine's per-step data, in the shape the stepping code uses:
// spans as [sourceId, start, end] or null (compiler-generated code).
function stepsOf(steps) {
  const { n, spans: sp, lineNo, depths, changes } = steps;
  const spans = new Array(n);
  for (let i = 0; i < n; i++) {
    spans[i] = sp[3 * i] < 0 ? null : [sp[3 * i], sp[3 * i + 1],
      sp[3 * i + 2]];
  }
  let lo = Infinity, hi = -Infinity;
  for (const d of depths) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
  return { n, spans, lineNo, depths, flat: lo === hi, changes };
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
  const stateBox = box.querySelector(".state");
  const stateTable = stateBox.querySelector("table");
  const buttons = [...box.querySelectorAll("button[data-go]")];
  const cache = new Map();
  let hl = null, ds = null, shown = null, before = null;
  // The contract's state at step i, from the engine's state(i), when the
  // data set has that capability (Solidity). It comes from the worker,
  // so it is async: a reply for a step that is no longer shown is
  // ignored. A value that differs from the state shown before is marked.
  let stateSeq = 0, stateDone = Promise.resolve();
  const showState = (i) => {
    const has = !!ds.capabilities.state;
    stateBox.hidden = !has;
    if (!has) return;
    const seq = ++stateSeq, cur = ds;
    stateDone = engine.state(ds.key, i).then((vars) => {
      if (seq === stateSeq && cur === ds) drawState(i, vars);
    }, (e) => console.error(e));
  };
  const drawState = (i, vars) => {
    stateBox.dataset.step = String(i);
    stateTable.innerHTML = "";
    for (const v of vars) {
      const tr = stateTable.insertRow();
      const name = tr.insertCell();
      name.textContent = v.name;
      name.title = v.type;
      const val = document.createElement("span");
      val.textContent = v.value.startsWith("<unknown") ? "<unknown>"
        : v.value;
      val.title = v.value;
      val.className = "val";
      // soldb's placeholders (unknown, a mapping) are muted, never marked.
      const placeholder = v.value.startsWith("<");
      if (placeholder) val.classList.add("unk");
      const old = before && before.get(v.name);
      if (!placeholder && old !== undefined && old !== v.value) {
        val.classList.add("chg");
      }
      tr.insertCell().append(val);
    }
    before = new Map(vars.map((v) => [v.name, v.value]));
  };
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
    const st = ds.steps;
    const span = ds.walked.spans[i];
    const fn = st.functions[i] ? ` in ${st.functions[i]}` : "";
    const loc = st.files[i] ? `${base(st.files[i])}:${st.lineNo[i]}`
      : "no source";
    where.textContent = `step ${i} / ${ds.walked.n - 1}: ` +
      `pc ${st.pcs[i]} ${st.ops[i]}, ${loc}${fn}`;
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
    showState(i);
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
    // Resolves when the state panel has the shown step's state.
    settled: () => stateDone,
    hide() { save(); ds = null; box.hidden = true; },
    async show(next) {
      hl = await shikiReady;
      save();
      ds = next;
      before = null;
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

window.stateReady = () => viewer.settled();

const engine = soldbEngine();
const BUG = "bug";
const entries = (times) => Object.entries(times);

// Solidity: Shop `place`, saved native trace, solc's ethdebug (Walnut's
// solidity PR #10). Fe: Tally `Add{n: 4}` on anvil, Fe 26.4.1's
// ethdebug; the engine adapts only the file layout (listed on the page).
// What each data set's details show, from the engine's summary.
const detail = {
  sol: (r) => [
    ["module", `soldb ${r.version}, replayAvailable() = ${r.replayAvailable}`],
    ["trace", `${kb(r.traceBytes)}, ${r.steps} steps, ` +
      `${r.mapped} with a source line (${r.generated} compiler-generated, ` +
      `whole-contract span), ${r.lineChanges} line changes`],
    ["wasm memory after", kb(r.wasmMemory)],
  ],
  fe: (r) => [
    ["trace", `${kb(r.traceBytes)}, ${r.steps} steps, ${r.mapped} with a ` +
      `source span (${r.userSteps} in tally.fe, ${r.mapped - r.userSteps} ` +
      `in Fe's standard library), ${r.lineChanges} line changes`],
    ["soldb's debug info", `${r.debugInfo.instructions} ` +
      `instructions, ${r.sourceCount} sources, variables at ` +
      `${r.debugInfo.pcsWithVariables} pcs`],
    ["functions / variables", `${r.withFunction} / ${r.withVariables} ` +
      "steps (soldb's function detection targets Solidity; Fe emits no " +
      "variables)"],
  ],
};

async function load(key, part) {
  const loaded = await engine.load(key);
  const sources = {};
  for (const [id, src] of Object.entries(loaded.sources)) {
    sources[id] = { id: +id, ...src };
  }
  const ds = { key, ...loaded, sources, walked: stepsOf(loaded.steps) };
  results[part] = loaded.summary;
  showTimes($(`${part}-times`), entries(loaded.summary.times),
    detail[key](loaded.summary));
  return ds;
}

// BUG: Tally on anvil, bugc's ethdebug program. soldb is fed as for Fe;
// the engine adapts the file layout (bugc writes no resources file)
// and, for the second run, the source id (soldb reads numeric ids only).
async function bugCheck() {
  const r = await engine.run("bug-check");
  results.bug = r;
  const row = (x) => `${x.spans} steps with a span; functions: ` +
    `${x.functions.join(", ") || "none"}; variables at ` +
    `${x.pcsWithVariables} pcs, on ${x.withVariables} steps, ` +
    `${x.decoded} decoded; as ${x.variables.join("; ") || "none"}`;
  showTimes($("bug-times"), entries(r.times), [
    ["trace", `${kb(r.traceBytes)}, ${r.steps} steps`],
    ["source id \"tally.bug\" (as emitted)", row(r.asEmitted)],
    ["source id 0", row(r.numeric)],
  ]);
}

// Part B: the replay build re-executes Token.transfer offline.
async function partB() {
  const r = await engine.run("replay");
  results.b = r;
  showTimes($("b-times"), entries(r.times), [
    ["module", `soldb ${r.version}, replayAvailable() = true`],
    ["replay", `${r.rounds} run(s), ${r.steps} steps, ` +
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

// The page's own requests and the engine's (the worker's fetches).
async function listRequests() {
  const el = $("reqs");
  el.innerHTML = "";
  const seen = new Set();
  const reqs = [...performance.getEntriesByType("resource"),
    ...await engine.requests()].filter((e) => !e.name.endsWith("/events")
    && !seen.has(e.name) && seen.add(e.name));
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
const loading = $("loading");
for (const [key, part] of [["sol", "a"], ["fe", "fe"]]) {
  try {
    datasets[key] = await load(key, part);
    window.walked[key] = datasets[key].walked;
    $(`${part}-status`).textContent = "Works.";
    $(`${part}-status`).className = "status ok";
    document.querySelector(`[data-ds=${key}]`).disabled = false;
    if (key === "sol") {
      results.solReadyMs = now() - t0;
      loading.hidden = true;
      await select("sol");
    }
  } catch (e) { fail(part, e); }
}
loading.hidden = true;
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
await listRequests();
results.done = true;
document.body.dataset.done = "1";
