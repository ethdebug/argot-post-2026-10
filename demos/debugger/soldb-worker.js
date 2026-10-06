// Runs soldb-wasm in a Web Worker, so the page stays responsive while
// soldb parses a trace and maps its steps. Every soldb call happens
// here; the page only displays what this worker sends back. Timings are
// taken here, around the soldb calls themselves.
//
// It is the soldb engine behind engine.js; the shapes it returns are
// documented there.
//
// Messages: { id, op, args } in; { id, value } or { id, error } out.
//   load(dataset)    "sol" or "fe": a Loaded (see engine.js)
//   state(dataset, i) soldb's state(i): the contract's state at step i
//   run(job)         "bug-check" or "replay": a soldb-only check
//   requests()       this worker's resource timing entries

const now = () => performance.now();
const text = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
};
const json = async (url) => JSON.parse(await text(url));
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

// Both data sets and the BUG check use the same lean module.
let lean;
const loadLean = () => lean ??= (async () => {
  const times = [];
  const mod = await timed(times, "import JS glue", () =>
    import("./pkg-lean/soldb_wasm.js"));
  const out = await timed(times, "fetch + compile + instantiate wasm", () =>
    mod.default({ module_or_path: "./pkg-lean/soldb_wasm_bg.wasm" }));
  return { mod, out, times };
})();

// Traces kept for state(i).
const traces = {};

// Solidity: Shop `place`, saved native trace, solc's ethdebug (Walnut's
// solidity PR #10). The deployed code gives soldb the immutables.
async function loadSolidity() {
  const { mod, out, times } = await loadLean();
  const traceText = await timed(times, "fetch saved trace", () =>
    text("./shop-debug-rpc.trace.json"));
  const trace = await timed(times, "Trace.fromJson (parse)", () =>
    mod.Trace.fromJson(traceText));
  const dir = "./art/walnut10-Shop";
  const [metadata, program, sol, code] = await timed(times,
    "fetch ethdebug artifacts + code", () => Promise.all([
      json(`${dir}/ethdebug_resources.json`),
      json(`${dir}/Shop_ethdebug-runtime.json`),
      text(`${dir}/Shop.sol`),
      json("./shop-code.json"),
    ]));
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: "Shop", metadata, program, sources: { 0: sol },
      address: code.address })));
  trace.provideCode(code.address, code.code);
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
    debugInfo: summary.debugInfo,
    wasmMemory: out.memory.buffer.byteLength,
  };
  return [{ summary: r, steps, sources: { 0: { text: sol } }, main: 0,
    lang: "solidity", capabilities: { state: true,
      generated: "for solc, a source range covering the whole contract" } },
  transfer(steps)];
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
  const { mod } = await loadLean();
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
      generated: "for Fe, an instruction with no source range" } },
    transfer(steps)];
}

// BUG: Tally on anvil, bugc's ethdebug program. soldb is fed as for Fe;
// the page adapts the file layout (bugc writes no resources file) and,
// for the second run, the source id (soldb reads numeric ids only).
const BUG = "bug";
async function bugCheck() {
  const { mod } = await loadLean();
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
    traceBytes: dbg.length, steps: trace.stepCount(),
    success: summary.success, asEmitted, numeric };
  return [r];
}

const loaders = { sol: loadSolidity, fe: loadFe };

// soldb's state(i): the contract's state at step i.
function state(key, i) {
  return JSON.parse(traces[key].state(i)).variables;
}

// The replay build: re-execute Token.transfer offline, from a file.
async function replay() {
  const times = [];
  const mod = await timed(times, "import JS glue", () =>
    import("./pkg-replay/soldb_wasm.js"));
  const out = await timed(times, "fetch + compile + instantiate wasm", () =>
    mod.default({ module_or_path: "./pkg-replay/soldb_wasm_bg.wasm" }));
  if (!mod.replayAvailable()) throw new Error("replay build has no Replay");
  const file = await timed(times, "fetch replay file", () =>
    json("./replay/transfer.json"));
  const s = JSON.stringify;
  const rp = await timed(times, "Replay.prepare", () =>
    mod.Replay.prepare(s(file.transaction), s(file.receipt), s(file.block),
      String(file.chainId)));
  let rounds = 0;
  let status = JSON.parse(rp.status());
  await timed(times, "provideState + run (EVM)", () => {
    while (status.status === "needsState") {
      if (rounds++ > 0) {
        throw new Error("replay file lacks state: " + s(status.requests));
      }
      rp.provideState(s(file.state));
      status = JSON.parse(rp.run());
    }
  });
  if (status.status !== "complete") throw new Error(s(status));
  const trace = await timed(times, "finish", () => rp.finish());
  const dir = "./art/walnut10-Token";
  const [metadata, program, sol] = await timed(times,
    "fetch ethdebug artifacts", () => Promise.all([
      json(`${dir}/ethdebug_resources.json`),
      json(`${dir}/Token_ethdebug-runtime.json`),
      text(`${dir}/Token.sol`),
    ]));
  await timed(times, "attachEthdebug", () => trace.attachEthdebug(
    JSON.stringify({ name: "Token", metadata, program, sources: { 0: sol } })));
  const { steps, counts } = await timed(times,
    "step() every step + JSON.parse", () =>
      walk(trace, { 0: source(0, sol) }));
  const summary = JSON.parse(trace.summary());
  const r = {
    ok: true, times: Object.fromEntries(times), rounds,
    version: mod.version(), steps: steps.n, ...counts,
    backend: summary.backend, success: summary.status ?? summary.success,
    debugInfo: summary.debugInfo,
    wasmMemory: out.memory.buffer.byteLength,
  };
  return [r];
}

const jobs = { "bug-check": bugCheck, replay };

const requests = () => [performance.getEntriesByType("resource")
  .map((e) => ({ name: e.name, transferSize: e.transferSize }))];

const ops = {
  load: (dataset) => loaders[dataset](),
  state: (dataset, i) => [state(dataset, i)],
  run: (job) => jobs[job](),
  requests,
};

self.onmessage = async ({ data: { id, op, args } }) => {
  try {
    const [value, buffers = []] = await ops[op](...args);
    self.postMessage({ id, value }, buffers);
  } catch (e) {
    self.postMessage({ id, error: String(e && e.stack || e) });
  }
};
