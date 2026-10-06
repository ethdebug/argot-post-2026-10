// The page: UI, highlighting and stepping. Engines do the debugging,
// each in a Web Worker behind engine.js; the page only displays what an
// engine reports. One viewer steps every data set with the same code: a
// Solidity transaction (solc's ethdebug) and a Fe transaction (Fe's
// ethdebug), by soldb-wasm; a BUG transaction at two optimization
// levels (bugc's ethdebug), by ethdebug's reference implementation. The
// details run a soldb check on another BUG transaction. Part B
// (details) replays a transaction with the replay build. Results go to
// the DOM and to window.results.
//
// Loading: only the default tab (Solidity) loads at first. Each other
// tab, each BUG level and the details load when first opened, and, once
// the default tab is ready, in idle time (see prefetch). While a tab
// loads, the debugger keeps its layout: a skeleton, a progress bar and
// a status line, from the engine's progress reports; on failure, the
// reason and a retry button.

import { soldbEngine, refEngine } from "./engine.js";

const results = { env: {}, a: null, fe: null, ref: null, bug: null,
  b: null, shiki: null, tabs: {} };
window.results = results;

const $ = (id) => document.getElementById(id);
const now = () => performance.now();
// Display only: Shiki colours the source and draws soldb's span. It
// never computes a source mapping. Fe has no Shiki grammar; `rust` is a
// close approximation. Shiki's core with its JavaScript regex engine
// and only the two grammars and two themes the page uses: the same
// HTML as its full bundle for every source here, at a quarter of the
// bytes. It starts once the default tab's files are in, so it does not
// compete with them. Until it is ready, the source shows as plain text,
// with the same span marks.
const ESM = "https://esm.sh";
const THEMES = { light: "github-light", dark: "github-dark" };
let shikiStarted = null;
const startShiki = () => shikiStarted ??= (async () => {
  const t = performance.now();
  const [core, js, sol, rust, light, dark] = await Promise.all([
    import(`${ESM}/shiki@3.13.0/core?bundle`),
    import(`${ESM}/shiki@3.13.0/engine/javascript?bundle`),
    import(`${ESM}/@shikijs/langs@3.13.0/solidity`),
    import(`${ESM}/@shikijs/langs@3.13.0/rust`),
    import(`${ESM}/@shikijs/themes@3.13.0/github-light`),
    import(`${ESM}/@shikijs/themes@3.13.0/github-dark`),
  ]);
  const hl = await core.createHighlighterCore({
    themes: [light.default, dark.default],
    langs: [sol.default, rust.default],
    engine: js.createJavaScriptRegexEngine(),
  });
  results.shiki = { loadMs: performance.now() - t, renders: 0, maxMs: 0 };
  viewer.upgrade(hl);
  return hl;
})().catch((e) => {
  console.warn("Shiki failed to load; the source stays plain text", e);
  return null;
});

const esc = (t) => t.replace(/[&<>]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

// The source as plain text, in Shiki's markup (a span.line per line),
// with the same decorations (a class on a range of string positions).
function plain(text, decorations) {
  let at = 0;
  const lines = text.split("\n").map((line) => {
    const from = at, to = at + line.length;
    at = to + 1;
    const cuts = new Set([from, to]);
    for (const d of decorations) {
      for (const x of [d.start, d.end]) if (x > from && x < to) cuts.add(x);
    }
    const xs = [...cuts].sort((a, b) => a - b);
    let html = "";
    for (let k = 0; k + 1 < xs.length; k++) {
      const [a, b] = [xs[k], xs[k + 1]];
      const cls = decorations.filter((d) => d.start <= a && d.end >= b)
        .map((d) => d.properties.class);
      const t = esc(text.slice(a, b));
      html += cls.length ? `<span class="${cls.join(" ")}">${t}</span>` : t;
    }
    return `<span class="line">${html}</span>`;
  });
  return `<pre><code>${lines.join("\n")}</code></pre>`;
}

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
// spans as [sourceId, start, end] or null (compiler-generated code);
// `lib` is true where the span is in a library file (the engine marks
// the source with `lib`).
function stepsOf(steps, sources) {
  const { n, spans: sp, lineNo, depths, changes } = steps;
  const spans = new Array(n);
  for (let i = 0; i < n; i++) {
    spans[i] = sp[3 * i] < 0 ? null : [sp[3 * i], sp[3 * i + 1],
      sp[3 * i + 2]];
  }
  let lo = Infinity, hi = -Infinity;
  for (const d of depths) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
  const lib = spans.map((s) => !!s && !!sources[s[0]].lib);
  return { n, spans, lib, lineNo, depths, flat: lo === hi, changes,
    inline: steps.inline };
}

// Stepping, computed by the page from two fields the engine reports per
// step: the source span and the call depth. `go` is "into", "over" or
// "out"; `d` is 1 (forward) or -1 (back). With `skip`, compiler-generated
// steps (no span) and library steps are never a stop; without it, a run
// of compiler-generated steps is one stop. Returns a step, or undefined.
function nav(w, i, go, d, skip) {
  const key = (j) => skip && (!w.spans[j] || w.lib[j]) ? null
    : w.spans[j] ? w.spans[j].join(":") : "generated";
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
  const range = box.querySelector("input[type=range]");
  const srcEl = box.querySelector(".src");
  const note = box.querySelector(".gen-note");
  const where = $("where");
  const msg = $("msg");
  const stateBox = box.querySelector(".state");
  const stateTable = stateBox.querySelector("table");
  const framesBox = box.querySelector(".frames");
  const framesList = framesBox.querySelector("ol");
  const framesExtra = framesBox.querySelector(".extra");
  const inlBox = box.querySelector(".inlining");
  const inlCur = inlBox.querySelector(".cur");
  const buttons = [...box.querySelectorAll("button[data-go]")];
  const skip = $("skip");
  const skipNote = $("skip-note");
  const cache = new Map();
  let hl = null, ds = null, shown = null, before = null;
  // Every tab shows the same panels. A panel whose capability the data
  // set lacks keeps its place and says why (engine.js, whyNot).
  const why = (panel, has, text) => {
    for (const e of panel.querySelectorAll("[data-has]")) e.hidden = !has;
    panel.querySelector(".why:not(.locals)").textContent = has ? ""
      : text ?? "Not available for this data set.";
  };
  // The panels at step i, when the data set has their capability: the
  // contract's state from the engine's state(i) (Solidity), or the
  // variables in scope from variables(i) (BUG), in the same table; and
  // the call stack from callStack(i) (BUG). They come from a worker, so
  // they are async: a reply for a step that is no longer shown is
  // ignored. A value that differs from the one shown before is marked.
  let stateSeq = 0, stateDone = Promise.resolve();
  const showState = (i) => {
    const caps = ds.capabilities, no = ds.whyNot;
    const vars = caps.state ? "state" : caps.variables ? "variables" : null;
    for (const p of stateBox.querySelectorAll("[data-cap]")) {
      p.hidden = p.dataset.cap !== vars;
    }
    why(stateBox, !!vars, no.variables);
    stateBox.querySelector(".locals").textContent = no.locals ?? "";
    why(framesBox, !!caps.callStack, no.callStack);
    // Without a call stack: the engine's own function detection, if it
    // has one, labelled as such and never drawn as a stack.
    const fn = !caps.callStack && ds.steps.functions[i];
    framesExtra.replaceChildren(...fn
      ? [`${ds.engine.name}'s own function detection: `, code(fn)] : []);
    if (!vars && !caps.callStack) return;
    const seq = ++stateSeq, cur = ds, e = ds.engine;
    stateDone = Promise.all([vars && e[vars](ds.key, i),
      caps.callStack && e.callStack(ds.key, i)]).then(([v, f]) => {
      if (seq !== stateSeq || cur !== ds) return;
      if (v) drawState(i, v);
      if (f) drawFrames(i, f);
    }, (e) => console.error(e));
  };
  const badge = (t) => {
    const b = document.createElement("span");
    b.className = "badge";
    b.textContent = t;
    return b;
  };
  const code = (t) => {
    const c = document.createElement("code");
    c.textContent = t;
    return c;
  };
  // The call stack, innermost first; each frame with its call site.
  const drawFrames = (i, frames) => {
    framesBox.dataset.step = String(i);
    framesBox.dataset.depth = String(frames.length);
    framesList.innerHTML = "";
    for (const f of frames) {
      const li = framesList.appendChild(document.createElement("li"));
      li.append(code(f.args === null ? f.name : `${f.name}(${f.args})`));
      if (f.inline) li.append(" ", badge("inline"));
      if (f.site) {
        li.append(` ${f.inline ? "inlined at" : "called at"} line ` +
          `${f.site.line}: `, code(f.site.text.trim()));
      }
    }
    const li = framesList.appendChild(document.createElement("li"));
    li.className = "muted";
    li.textContent = "the code block (transaction entry)";
  };
  const drawState = (i, vars) => {
    stateBox.dataset.step = String(i);
    stateTable.innerHTML = "";
    for (const v of vars) {
      const tr = stateTable.insertRow();
      const name = tr.insertCell();
      name.textContent = v.name;
      name.title = v.type;
      if (v.scope) tr.dataset.scope = v.scope;
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
      if (v.scope) {
        const c = tr.insertCell();
        c.className = "muted";
        c.textContent = `${v.scope}, ${v.type}`;
        // A local of an inlined body, and why a local has no value.
        if (v.inline) c.append(" ", badge("inline"), ` in ${v.inline}`);
        if (v.reason) {
          const r = c.appendChild(document.createElement("span"));
          r.className = "reason";
          r.textContent = `; ${v.reason}`;
        }
      }
    }
    if (!vars.length) {
      const c = stateTable.insertRow().insertCell();
      c.className = "muted";
      c.textContent = "None in this step's context.";
    }
    before = new Map(vars.map((v) => [v.name, v.value]));
  };
  // `site`: an inlined body's call site, outlined (same source only).
  const render = (src, span, site) => {
    const decorations = span
      ? [{ start: span[1], end: span[2], properties: { class: "hl" } }]
      : [];
    if (site && site[0] === src.id) {
      decorations.push({ start: site[1], end: site[2],
        properties: { class: "site" } });
    }
    if (!hl) return plain(src.text, decorations);
    const key = `${ds.key}:${src.id}:${span ? span.join(":") : ""}` +
      (site ? `:${site.join(":")}` : "");
    let html = cache.get(key);
    if (html === undefined) {
      const t = now();
      html = hl.codeToHtml(src.text, {
        lang: ds.lang, themes: THEMES, defaultColor: false, decorations,
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
    const fn = st.functions[i] ? `, function ${st.functions[i]}` : "";
    const loc = st.files[i] ? `${base(st.files[i])}:${st.lineNo[i]}`
      : "no source range";
    where.textContent = `step ${i} / ${ds.walked.n - 1}: ` +
      `pc ${st.pcs[i]} ${st.ops[i]}, ${loc}${fn}`;
    const src = ds.sources[span ? span[0] : ds.main];
    shown = src.id;
    msg.textContent = "";
    for (const b of buttons) {
      b.target = nav(ds.walked, i, b.dataset.go, +b.dataset.d,
        skip.checked);
      b.disabled = b.target === undefined ||
        (ds.walked.flat && b.dataset.go !== "into");
      b.title = b.disabled && ds.walked.flat && b.dataset.go !== "into"
        ? "Every step here is at EVM call depth 1." : "";
    }
    // An inlined body (reference engine): the step's span is in the
    // body; the marker names the function and its call site.
    const inl = st.inline && st.inline[i];
    why(inlBox, !!ds.capabilities.inline, ds.whyNot.inline);
    inlCur.replaceChildren(...!inl ? ["This step is not in an inlined body."]
      : [badge("inline"), ` This step is in the body of ${inl.fn ?? "?"}, ` +
        `inlined at line ${inl.line}.`]);
    srcEl.innerHTML = render(src, span, inl && inl.site);
    showState(i);
    srcEl.classList.toggle("faded", !span);
    note.textContent = !span
      ? "Compiler-generated code: no source range."
      : src.lib ? `In Fe's standard library: ${src.lib}` : "";
    if (inl) {
      note.append(badge("inline"), ` The body of ${inl.fn ?? "?"}, ` +
        "inlined at the call ", code((inl.text ?? "?").trim()),
        ` (line ${inl.line}, outlined). No call happens.`);
    }
    note.dataset.inline = inl ? inl.fn ?? "?" : "";
    note.classList.toggle("on", !span || !!src.lib || !!inl);
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
  // Skip compiler and library code: the buttons' targets change; the
  // step does not.
  skip.onchange = () => ds && step(+range.value);
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
    if (!ds || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest(
      "input:not([type=checkbox]), textarea, select")) {
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
    if (!el || !ds) return;
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
    // While a data set loads: the same boxes, with a skeleton (CSS,
    // #stepper.loading) and no controls.
    loading() {
      save();
      ds = null;
      box.classList.add("loading");
      box.setAttribute("aria-busy", "true");
      for (const b of buttons) b.disabled = true;
      range.disabled = true;
      skip.disabled = true;
      where.textContent = "Loading...";
      srcEl.innerHTML = "";
      note.classList.remove("on");
      msg.textContent = "";
      skipNote.textContent = "";
    },
    // Shiki is ready: colour the source from now on.
    upgrade(h) {
      hl = h;
      cache.clear();
      if (ds) step(+range.value);
    },
    async show(next) {
      save();
      ds = next;
      before = null;
      range.max = String(ds.walked.n - 1);
      range.disabled = false;
      skip.disabled = false;
      box.classList.remove("loading");
      box.removeAttribute("aria-busy");
      // How this engine recognizes compiler and library code.
      const caps = ds.capabilities, no = ds.whyNot.library;
      const issue = (href) => {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = `#${href.split("/").pop()}`;
        return a;
      };
      skipNote.replaceChildren(`Compiler code: ${caps.generated}. `,
        ...caps.library ? [`Library code: ${caps.library}`]
          : [no.text, ...no.href ? [" (", issue(no.href), ")"] : []],
        ". ethdebug has no explicit marker for either yet.");
      // Open at the first step in the contract's own file.
      const c = ds.walked.changes;
      step(ds.pos ?? c.find((i) => ds.walked.spans[i][0] === ds.main)
        ?? c[0] ?? 0);
    },
  };
})();

window.walked = {};

const engine = soldbEngine();
const ref = refEngine();
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
    ["WebAssembly memory after", kb(r.wasmMemory)],
  ],
  fe: (r) => [
    ["trace", `${kb(r.traceBytes)}, ${r.steps} steps, ${r.mapped} with a ` +
      `source span (${r.userSteps} in tally.fe, ${r.mapped - r.userSteps} ` +
      `in Fe's standard library), ${r.lineChanges} line changes`],
    ["soldb's debug info", `${r.debugInfo.instructions} ` +
      `instructions, ${r.sourceCount} sources, variables at ` +
      `${r.debugInfo.pcsWithVariables} pcs`],
    ["functions / variables", `${r.withFunction} / ${r.withVariables} ` +
      "steps (soldb's function detection targets Solidity, and Fe " +
      "emits no variables)"],
  ],
};

const ok = (el, text) => {
  el.textContent = text;
  el.className = "status ok";
};
// A data set that failed to load: its reason in the details too (the
// debugger shows it with a retry button).
const bad = (el, e) => {
  el.textContent = `Failed: ${e.message ?? e}.`;
  el.className = "status bad";
};

async function load(key, eng, onProgress) {
  const loaded = await eng.load(key, onProgress);
  const sources = {};
  for (const [id, src] of Object.entries(loaded.sources)) {
    sources[id] = { id: +id, ...src };
  }
  const ds = { key, engine: eng, ...loaded, sources,
    whyNot: eng.whyNot[key] ?? {},
    walked: stepsOf(loaded.steps, sources) };
  window.walked[key] = ds.walked;
  return ds;
}

// Solidity and Fe, by soldb.
async function loadSoldb(key, part, onProgress) {
  const ds = await load(key, engine, onProgress)
    .catch((e) => { bad($(`${part}-status`), e); throw e; });
  results[part] = ds.summary;
  showTimes($(`${part}-times`), entries(ds.summary.times),
    detail[key](ds.summary));
  ok($(`${part}-status`), "Works.");
  return ds;
}

// BUG: Scores on anvil, at optimization level 0 or 2, by bugc from
// ethdebug/format main; debugged by ethdebug's reference
// implementation (ref-worker.js), not soldb.
const refRows = { times: [], rows: [] };
async function loadRef(lvl, onProgress) {
  const ds = await load(`bug-${lvl}`, ref, onProgress)
    .catch((e) => { bad($("ref-status"), e); throw e; });
  const s = ds.summary;
  results.ref = { ...results.ref, ok: true, [lvl]: s };
  for (const [k, v] of entries(s.times)) {
    refRows.times.push([`-${lvl}: ${k}`, v]);
  }
  refRows.rows.push([`-${lvl}: trace`, `${kb(s.traceBytes)}, ${s.steps} ` +
    `steps, ${s.instructions} instructions; call stack up to ` +
    `${s.maxDepth} frames; ${s.withInline} steps in an inlined body`]);
  showTimes($("ref-times"), refRows.times, refRows.rows);
  ok($("ref-status"), `Works. ethdebug/format at ${s.commit.slice(0, 9)}.`);
  return ds;
}

// BUG: Tally on anvil, bugc's ethdebug program. soldb is fed as for Fe;
// the engine adapts the file layout (bugc writes no resources file)
// and, for the second run, the source id (soldb reads numeric ids only).
async function bugCheck(onProgress) {
  const r = await engine.run("bug-check", onProgress);
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
  ok($("bug-status"), "Works.");
}

// Part B: the replay build re-executes Token.transfer offline.
async function partB(onProgress) {
  const r = await engine.run("replay", onProgress);
  results.b = r;
  showTimes($("b-times"), entries(r.times), [
    ["module", `soldb ${r.version}, replayAvailable() = true`],
    ["replay", `${r.rounds} run(s), ${r.steps} steps, ` +
      `${r.mapped} with a source line (${r.generated} compiler-generated, ` +
      `whole-contract span), ${r.lineChanges} line changes`],
    ["WebAssembly memory after", kb(r.wasmMemory)],
  ]);
  ok($("b-status"), "Works. No node was contacted.");
}

// A failed check in the details: its reason and a retry button.
function fail(part, e) {
  results[part] = { ok: false, error: String(e && e.stack || e) };
  const el = $(`${part}-status`);
  el.textContent = `Failed: ${e.message ?? e}. `;
  el.className = "status bad";
  el.append(retryButton(() => ensure("details").catch(() => {})));
  console.error(e);
}

// The details' two soldb checks. Both run; the section fails if either
// does, so a retry runs both again.
async function details(onProgress) {
  let failed = null;
  for (const [part, run] of [["bug", bugCheck], ["b", partB]]) {
    $(`${part}-status`).textContent = "Running...";
    $(`${part}-status`).className = "status";
    try { await run(onProgress); } catch (e) { fail(part, e); failed = e; }
  }
  if (failed) throw failed;
}

// What loads on demand, by key: each data set the debugger shows, and
// the details. `start` names the first thing that happens, before any
// file arrives.
const SECTIONS = {
  sol: { tab: "sol", start: "Starting soldb, Walnut's debugger",
    load: (p) => loadSoldb("sol", "a", p) },
  fe: { tab: "fe", start: "Starting soldb, Walnut's debugger",
    load: (p) => loadSoldb("fe", "fe", p) },
  "bug-O0": { tab: "bug", start: "Starting ethdebug's reference " +
    "implementation", load: (p) => loadRef("O0", p) },
  "bug-O2": { tab: "bug", start: "Starting ethdebug's reference " +
    "implementation", load: (p) => loadRef("O2", p) },
  details: { load: details },
};

// Each section's load, once: its promise and value, and its progress
// (each file's bytes, then the phase of the work). A failed load is
// forgotten, so the next ensure() tries again.
const sections = {};
let inflight = 0;
function ensure(key) {
  const s = sections[key] ??= {};
  if (s.promise) return s.promise;
  Object.assign(s, { files: new Map(), phase: null, error: null });
  const onProgress = (p) => {
    if (p.phase) {
      s.phase = p.phase;
      // This section's files are in: Shiki no longer competes.
      startShiki();
    } else {
      s.files.set(p.path, p);
    }
    drawLoader();
  };
  inflight++;
  const settle = () => {
    inflight--;
    startShiki();
    drawLoader();
    maybeDone();
  };
  s.promise = SECTIONS[key].load(onProgress).then((v) => {
    s.value = v ?? true;
    settle();
    return v;
  }, (e) => {
    s.promise = null;
    s.error = e;
    settle();
    throw e;
  });
  return s.promise;
}

// The loader in the source card, for the section shown.
const loader = {
  box: $("loading"),
  status: $("loading").querySelector(".load-status"),
  bar: $("loading").querySelector(".progress"),
  fill: $("loading").querySelector(".progress > i"),
  retry: $("loading").querySelector(".btn"),
};
const size = (n, total) => total >= 1e6
  ? (n / 1e6).toFixed(1) : String(Math.round(n / 1e3));
const unit = (total) => total >= 1e6 ? "MB" : "KB";

// The status line and the bar, from a section's progress: the files in
// flight, grouped by what they are; the group with the most bytes still
// to come is named. A known total gives a bar of bytes received;
// otherwise, or while the engine works, the bar is indeterminate.
function progressOf(key) {
  const s = sections[key] ?? {};
  if (s.error) return { error: s.error.message ?? String(s.error) };
  const files = [...(s.files ?? new Map()).values()];
  const groups = new Map();
  for (const f of files) {
    const g = groups.get(f.label) ?? { label: f.label, loaded: 0, total: 0,
      known: true, done: true };
    g.loaded += f.loaded;
    g.total += f.total ?? 0;
    g.known &&= f.total !== null;
    g.done &&= f.done;
    groups.set(f.label, g);
  }
  const left = (g) => (g.known ? g.total : g.loaded) - g.loaded;
  const busy = [...groups.values()].filter((g) => !g.done)
    .sort((a, b) => left(b) - left(a));
  const known = files.length > 0 && files.every((f) => f.total !== null);
  const loaded = files.reduce((n, f) => n + f.loaded, 0);
  const total = files.reduce((n, f) => n + (f.total ?? 0), 0);
  if (busy.length) {
    const g = busy[0];
    const amount = g.known
      ? `${size(g.loaded, g.total)} of ${size(g.total, g.total)} ` +
        unit(g.total)
      : `${size(g.loaded, g.loaded)} ${unit(g.loaded)}`;
    return { text: `Loading ${g.label} (${amount})...`,
      fraction: known ? loaded / total : null };
  }
  if (s.phase) return { text: `${s.phase}...`, fraction: null };
  return { text: `${SECTIONS[key].start}...`, fraction: null };
}

let current = null, drawing = false;
function drawLoader() {
  if (drawing) return;
  drawing = true;
  requestAnimationFrame(() => {
    drawing = false;
    if (!current || sections[current]?.value) return;
    const p = progressOf(current);
    loader.box.classList.toggle("err", !!p.error);
    loader.status.textContent = p.error ? `${p.error}.` : p.text;
    loader.retry.hidden = !p.error;
    const indet = p.fraction === null || p.fraction === undefined;
    loader.bar.classList.toggle("indet", indet);
    if (indet) {
      loader.bar.removeAttribute("aria-valuenow");
    } else {
      const pct = Math.round(100 * Math.min(1, p.fraction));
      loader.bar.setAttribute("aria-valuenow", String(pct));
      loader.fill.style.width = `${pct}%`;
    }
  });
}

function retryButton(onclick) {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = "Retry";
  b.onclick = onclick;
  return b;
}

// Show a tab, loading its data set first if needed. The BUG tab shows
// one of two data sets: the same program at optimization level 0 or 2.
let bugLevel = "O0";
async function select(tab) {
  const key = tab === "bug" ? `bug-${bugLevel}` : tab;
  current = key;
  for (const t of document.querySelectorAll("[role=tab]")) {
    t.setAttribute("aria-selected", String(t.dataset.ds === tab));
  }
  for (const p of document.querySelectorAll("[data-about]")) {
    p.hidden = !p.dataset.about.split(" ").includes(tab);
  }
  const t = now();
  if (!sections[key]?.value) {
    viewer.loading();
    drawLoader();
  }
  let ds;
  try {
    ds = await ensure(key);
  } catch (e) {
    console.error(e);
    drawLoader();
    return;
  }
  if (current !== key) return;
  await viewer.show(ds);
  // From the click to a usable debugger (0 when it was loaded before).
  results.tabs[key] ??= { usableMs: now() - t, at: now() };
  if (key === "sol" && !results.ready) ready();
}

// The default tab is usable: from the start of navigation. Then
// prefetch, once Shiki is in.
function ready() {
  results.solReadyMs = results.readyMs = now();
  results.ready = true;
  startShiki().then(prefetch);
}
loader.retry.onclick = () =>
  select(SECTIONS[current].tab);
for (const t of document.querySelectorAll("[role=tab]")) {
  t.onclick = () => select(t.dataset.ds);
}
for (const b of document.querySelectorAll("[data-lvl]")) {
  b.onclick = () => {
    bugLevel = b.dataset.lvl;
    for (const c of document.querySelectorAll("[data-lvl]")) {
      c.setAttribute("aria-checked", String(c === b));
    }
    return select("bug");
  };
}
window.select = select;
window.selectLevel = (lvl) =>
  document.querySelector(`[data-lvl=${lvl}]`).onclick();

window.stateReady = () => viewer.settled();

// The details run their checks when opened.
const more = document.querySelector("details");
more.addEventListener("toggle", () => {
  if (more.open) ensure("details").catch(() => {});
});

// The page's own requests and the engine's (the worker's fetches).
async function listRequests() {
  const el = $("reqs");
  el.innerHTML = "";
  const seen = new Set();
  const reqs = [...performance.getEntriesByType("resource"),
    ...await engine.requests(), ...await ref.requests()]
    .filter((e) => !e.name.endsWith("/events")
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
    "for Shiki (esm.sh), which colours the source. Shiki is display " +
    "code only. The engines need none of these requests.";
}

// Done: every section loaded (by the user, by prefetch or by loadAll).
const t0 = now();
let finishing = false;
async function maybeDone() {
  if (finishing || !Object.keys(SECTIONS).every((k) => sections[k]?.value)) {
    return;
  }
  finishing = true;
  await startShiki();
  results.totalMs = now() - t0;
  await listRequests();
  results.done = true;
  document.body.dataset.done = "1";
}

// Load everything now (the checks use it): every tab and the details.
window.loadAll = async () => {
  more.open = true;
  await Promise.allSettled(Object.keys(SECTIONS).map(ensure));
};

// After the default tab is ready: the other tabs' data and the replay
// build, one at a time, in idle time, and only while nothing the user
// opened is loading. Not on a connection that asks to save data or is
// 2G. The tabs load as when opened (each in its engine's worker); for
// the details, only the replay build's WebAssembly is fetched, into
// the HTTP cache, so its checks still run when the section opens.
function prefetch() {
  const c = navigator.connection;
  if (c && (c.saveData || /2g/.test(c.effectiveType ?? ""))) return;
  const queue = [() => ensure("fe"), () => ensure("bug-O0"),
    () => ensure("bug-O2"),
    () => fetch("pkg-replay/soldb_wasm_bg.wasm", { priority: "low" })
      .then((r) => r.arrayBuffer())];
  const idle = (f) => window.requestIdleCallback
    ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 300);
  const next = () => idle(() => {
    if (inflight > 0) return next();
    const job = queue.shift();
    if (job) job().then(next, next);
  });
  next();
}

results.env = {
  userAgent: navigator.userAgent,
  crossOriginIsolated: self.crossOriginIsolated,
  sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
};
$("env").textContent = navigator.userAgent;

select("sol");
