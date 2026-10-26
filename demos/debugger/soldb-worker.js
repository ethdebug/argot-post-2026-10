// Runs soldb-wasm in a Web Worker, so the page stays responsive while
// soldb parses a trace and maps its steps. Every soldb call happens
// here; the page only displays what this worker sends back. Timings are
// taken here, around the soldb calls themselves.
//
// It is the soldb engine behind engine.js; the shapes it returns are
// documented there.
//
// Messages: { id, op, args } in; { id, value } or { id, error } out,
// and { id, progress } while a file arrives or a phase starts (see
// fetch-progress.js).
//   load(dataset)    "sol" or "fe": a Loaded (see engine.js), for
//                    Arcade, alice's second play()
//   state(dataset, i) soldb's state(i): the contract's state at step i
//   requests()       this worker's resource timing entries
// Each load fetches all its files at once, so a slow link pays its
// round trip once.

import { fetcher, serve, textOf } from "./fetch-progress.js";

const now = () => performance.now();
// Per call: `get` fetches with progress; `phase` names the work after.
const io = (report) => {
  const get = fetcher(report);
  return {
    get,
    text: async (url, label) => textOf(await get(url, label)),
    json: async (url, label) => JSON.parse(textOf(await get(url, label))),
    phase: (phase) => report({ phase }),
  };
};
const base = (p) => p.split("/").pop();

async function timed(times, label, fn) {
  const t = now();
  const v = await fn();
  times.push([label, now() - t]);
  return v;
}

// A span that covers most of the file is the whole contract: the step
// is compiler-generated code (dispatcher, ABI, checks), not one range.
const isWhole = (span, srcLen) => span.length >= 0.8 * srcLen;

const source = (id, text, extra) =>
  ({ id, text, ascii: !/[^\x00-\x7f]/.test(text), ...extra });

// soldb reports byte offsets. JS strings index UTF-16 units, so a file
// with non-ASCII text needs a conversion to draw the span (display only).
function charIndex(src, byte) {
  if (src.ascii) return byte;
  src.bytes ??= new TextEncoder().encode(src.text);
  return new TextDecoder().decode(src.bytes.subarray(0, byte)).length;
}

// Visits every step once, with soldb's step(i), and returns Steps (see
// engine.js): pc, op, span (-1s for compiler-generated code), soldb's
// line, EVM call depth and function name. Also the steps where the
// source line changes.
function walk(trace, sources) {
  const n = trace.stepCount();
  const spans = new Int32Array(3 * n).fill(-1);
  const lineNo = new Int32Array(n).fill(-1);
  const depths = new Int32Array(n);
  const pcs = new Int32Array(n);
  const ops = new Array(n);
  const files = new Array(n);
  const functions = new Array(n);
  const lines = new Array(n);
  const changes = [];
  const bySource = {};
  let generated = 0, mapped = 0, withFunction = 0, withVariables = 0;
  let noSource = 0;
  let last = null;
  for (let i = 0; i < n; i++) {
    const step = JSON.parse(trace.step(i));
    const s = step.source;
    depths[i] = step.depth;
    pcs[i] = step.pc;
    ops[i] = step.op;
    files[i] = s ? s.path : null;
    functions[i] = (step.function && step.function.name) || null;
    if (s) lineNo[i] = s.line;
    lines[i] = s ? `${base(s.path)}:${s.line}` : null;
    if (step.function) withFunction++;
    if (step.variables.length) withVariables++;
    const src = s && sources[s.source_id];
    // soldb's span: source.offset and source.length (bytes).
    const gen = !s || !src || isWhole(s, src.text.length);
    if (!gen) {
      spans[3 * i] = s.source_id;
      spans[3 * i + 1] = charIndex(src, s.offset);
      spans[3 * i + 2] = charIndex(src, s.offset + s.length);
    }
    if (s) {
      mapped++;
      bySource[s.source_id] = (bySource[s.source_id] ?? 0) + 1;
    }
    if (gen) generated++;
    if (!s || !src) noSource++;
    if (!gen && lines[i] !== last) {
      changes.push(i);
      last = lines[i];
    }
  }
  return {
    steps: { n, pcs, ops, spans, files, lineNo, depths, functions,
      changes },
    counts: { mapped, generated, noSource, bySource, withFunction,
      withVariables,
      lineChanges: changes.length,
      firstLines: changes.slice(0, 12).map((i) => lines[i]) },
  };
}

// The step data goes to the page as transferable buffers.
const transfer = (steps) =>
  [steps.pcs.buffer, steps.spans.buffer, steps.lineNo.buffer,
    steps.depths.buffer];

// Both data sets use the same lean module. A failed
// load is not kept, so a retry starts over.
let lean;
const loadLean = (io) => lean ??= (async () => {
  const times = [];
  const [mod, wasm] = await timed(times, "fetch JS glue + wasm", () =>
    Promise.all([import("./pkg-lean/soldb_wasm.js"),
      io.get("./pkg-lean/soldb_wasm_bg.wasm",
        "soldb (WebAssembly)")]));
  const out = await timed(times, "compile + instantiate wasm", () =>
    mod.default({ module_or_path: wasm }));
  return { mod, out, times };
})().catch((e) => { lean = null; throw e; });

// Traces kept for state(i).
const traces = {};

// Solidity: Arcade, alice's second `play()`, soldb's saved trace, the ethdebug output
// of Walnut's solc fork (walnuthq/solidity PR #10; via-IR, optimizer
// off), whose pointers give soldb the state variables.
async function loadSolidity(io) {
  const dir = "./sol/ethdebug";
  const t = now();
  const [lean, traceText, metadata, program, sol] = await Promise.all([
    loadLean(io),
    io.text("./sol/play.trace.json", "the transaction trace"),
    io.json(`${dir}/ethdebug_resources.json`, "solc's ethdebug data"),
    io.json(`${dir}/Arcade_ethdebug-runtime.json`, "solc's ethdebug data"),
    io.text("./sol/Arcade.sol", "the source"),
  ]);
  const { mod, out } = lean;
  const times = [...lean.times,
    ["fetch all (wasm, trace, ethdebug), compile wasm", now() - t]];
  io.phase("soldb parses the trace and maps each step");
  const trace = await timed(times, "Trace.fromJson (parse)", () =>
    mod.Trace.fromJson(traceText));
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: "Arcade", metadata, program,
      sources: { 0: sol } })));
  traces.sol = trace;
  const sources = { 0: source(0, sol) };
  const { steps, counts } = await timed(times,
    "step() every step + JSON.parse", () => walk(trace, sources));
  const summary = JSON.parse(trace.summary());
  const values = (i) => Object.fromEntries(state("sol", i)
    .map((v) => [v.name, v.value]));
  const r = {
    ok: true, times: Object.fromEntries(times),
    stateFirst: values(0), stateLast: values(steps.n - 1),
    replayAvailable: mod.replayAvailable(), version: mod.version(),
    traceBytes: traceText.length, steps: steps.n, ...counts,
    debugInfo: summary.debugInfo, success: summary.success,
    wasmMemory: out.memory.buffer.byteLength,
  };
  return [{ summary: r, steps, sources: { 0: { text: sol } }, main: 0,
    lang: "solidity", capabilities: { state: true,
      generated: "for solc, a source range covering the whole contract" } },
  transfer(steps)];
}

// Fe: Arcade `Play`, alice's second, on anvil, Fe 26.4.1's ethdebug (-O 0).
// The page adapts
// only the file layout (listed on the page): it picks the `call`
// program and supplies the source text that Fe's file leaves out.
const FE = "fe";
const FE_STD = {
  "builtin-core:/src/": `${FE}/src/core/`,
  "builtin-std:/src/": `${FE}/src/std/`,
};
async function loadFe(io) {
  const times = [];
  const node = "the node's saved responses";
  const [{ mod }, dbg, tx, receipt, artifact] = await timed(times,
    "fetch node responses + Fe ethdebug", () => Promise.all([
      loadLean(io),
      io.text(`${FE}/tx.debug-trace.json`, node),
      io.text(`${FE}/tx.transaction.json`, node),
      io.text(`${FE}/tx.receipt.json`, node),
      io.json(`${FE}/arcade.ethdebug.json`, "Fe's ethdebug data"),
    ]));
  // Adaptation 2 (below): Fe lists sources without contents; fetch the
  // text while soldb parses. The user file sits next to the artifact;
  // std-library files are copies from the Fe repository at tag v26.4.1
  // (blake3 hashes match).
  const list = artifact.compilation.sources;
  const textsReady = Promise.all(list.map((s) => {
    const pre = Object.keys(FE_STD).find((p) => s.uri.startsWith(p));
    return io.text(pre ? FE_STD[pre] + s.uri.slice(pre.length)
      : `${FE}/${base(s.path)}`, "the Fe source text");
  }));
  textsReady.catch(() => {});
  const trace = await timed(times, "Trace.fromTransaction (parse)", () =>
    mod.Trace.fromTransaction(dbg, tx, receipt));
  // Adaptation 1: Fe's file holds two programs; pass the runtime one.
  const program = artifact.programs.find((p) => p.environment === "call");
  const texts = await timed(times, "fetch Fe source text", () =>
    textsReady);
  io.phase("soldb maps each step");
  const sources = {};
  const textById = {};
  const shown = {};
  list.forEach((s, k) => {
    sources[s.id] = source(s.id, texts[k]);
    textById[s.id] = texts[k];
    shown[s.id] = { text: texts[k],
      ...(s.uri.startsWith("builtin-") ? { lib: s.uri } : {}) };
  });
  // `metadata` is Fe's whole file, unchanged: soldb reads the source ids
  // and paths from its `compilation`. No resources are added.
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: program.contract.name, metadata: artifact,
      program, sources: textById })));
  const { steps, counts } = await timed(times,
    "step() every step + JSON.parse", () => walk(trace, sources));
  const summary = JSON.parse(trace.summary());
  const r = {
    ok: true, times: Object.fromEntries(times),
    traceBytes: dbg.length, sourceCount: list.length,
    steps: steps.n, ...counts, userSteps: counts.bySource[0] ?? 0,
    debugInfo: summary.debugInfo, success: summary.success,
  };
  // Fe has no Shiki grammar; `rust` is a close approximation.
  return [{ summary: r, steps, sources: shown, main: 0, lang: "rust",
    capabilities: {
      generated: "for Fe, an instruction with no source range",
      library: "for Fe, a builtin-core:/ or builtin-std:/ file" } },
    transfer(steps)];
}

const loaders = { sol: loadSolidity, fe: loadFe };

// soldb's state(i): the contract's state at step i.
function state(key, i) {
  return JSON.parse(traces[key].state(i)).variables;
}

const requests = () => [performance.getEntriesByType("resource")
  .map((e) => ({ name: e.name, transferSize: e.transferSize }))];

serve({
  load: (report, dataset) => loaders[dataset](io(report)),
  state: (report, dataset, i) => [state(dataset, i)],
  requests,
});
