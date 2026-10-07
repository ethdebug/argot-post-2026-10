// The old way: a source-map stepper in a Web Worker, for the tab "The
// old way". It reads no ethdebug. It has what tools had before ethdebug:
// solc's runtime bytecode, its source map (`srcmap-runtime`) and its AST,
// all from `solc --combined-json` (old/combined.json), and the node's
// trace (each step's pc). It follows the source map format as solc's
// documentation gives it:
// - each instruction has one entry, `s:l:f:j`: start and length in bytes,
//   source file index (-1: no source), and the jump type: `i` (a jump
//   into a function), `o` (a return from one) or `-` (a plain jump);
// - entries are compressed: an empty field repeats the one before.
// Each step's span is its instruction's range. A range that covers most
// of the file (the whole contract), or no source (-1), is no span here,
// as on the other tabs. The call stack is built the way older tools
// built it: a JUMP marked `i` pushes a frame and a JUMP marked `o` pops
// one. A frame's function is the AST function definition that holds the
// range of the jump's target; its call site is the range of the jump.
//
// It implements the engine interface of engine.js. Messages:
// { id, op, args } in; { id, value } or { id, error } out, and
// { id, progress } while a file arrives or a phase starts.
//   load(dataset)          "old": a Loaded
//   callStack(dataset, i)  Frame[] at step i, innermost first
//   requests()             this worker's resource timing entries

import { fetcher, serve, textOf } from "./fetch-progress.js";

const now = () => performance.now();
const TRACE = "old/play.trace.json";
const NAME = "Arcade.sol";

// The offset of each instruction in the code: index k is the kth
// instruction, the one the kth source map entry describes. PUSH1 to
// PUSH32 (0x60 to 0x7f) carry 1 to 32 bytes of data.
function instructionPcs(hex) {
  const code = hex.replace(/^0x/, "");
  const pcs = [];
  for (let pc = 0; pc < code.length / 2;) {
    pcs.push(pc);
    const op = parseInt(code.slice(2 * pc, 2 * pc + 2), 16);
    pc += 1 + (op >= 0x60 && op <= 0x7f ? op - 0x5f : 0);
  }
  return pcs;
}

// The source map, decompressed: one [s, l, f, j] per instruction.
function decode(map) {
  let last = [0, 0, 0, "-"];
  return map.split(";").map((e) => {
    const f = e.split(":");
    last = last.map((v, k) => f[k] === undefined || f[k] === "" ? v
      : k < 3 ? +f[k] : f[k]);
    return last;
  });
}

// The AST's function definitions: name and range.
function functionsOf(ast, out = []) {
  if (Array.isArray(ast)) {
    for (const x of ast) functionsOf(x, out);
  } else if (ast && typeof ast === "object") {
    if (ast.nodeType === "FunctionDefinition") {
      const [s, l] = ast.src.split(":").map(Number);
      out.push({ name: ast.name, s, l });
    }
    for (const v of Object.values(ast)) functionsOf(v, out);
  }
  return out;
}

const lineOf = (src, offset) => {
  let n = 1;
  for (let k = src.indexOf("\n"); k >= 0 && k < offset;
    k = src.indexOf("\n", k + 1)) n++;
  return n;
};

const datasets = {};

async function load(report, key) {
  const times = {};
  const get = fetcher(report);
  const text = async (url, label) => textOf(await get(url, label));
  let t = now();
  const [combined, src, traceText] = await Promise.all([
    text("old/combined.json", "solc's bytecode, source map and AST"),
    text(`sol/${NAME}`, "the source"),
    text(TRACE, "the transaction trace"),
  ]);
  times["fetch bytecode, source map, AST, source, trace"] = now() - t;
  report({ phase: "The source map stepper maps each step" });
  t = now();
  const out = JSON.parse(combined);
  const c = out.contracts[`${NAME}:Arcade`];
  const pcs = instructionPcs(c["bin-runtime"]);
  const map = decode(c["srcmap-runtime"]);
  const entryAt = new Map(pcs.map((pc, k) => [pc, map[k]]));
  // Source map and AST ranges are in bytes; the page draws string
  // positions (the source has non-ASCII text in its comments).
  const bytes = new TextEncoder().encode(src);
  const dec = new TextDecoder();
  const ch = (b) => dec.decode(bytes.subarray(0, b)).length;
  const fns = functionsOf(out.sources[NAME].AST).map((f) =>
    ({ name: f.name, s: ch(f.s), l: ch(f.s + f.l) - ch(f.s) }));
  // Steps in the contract itself (it makes no calls; depth 1).
  const logs = JSON.parse(traceText).structLogs.filter((l) => l.depth === 1);
  const n = logs.length;
  const spans = new Int32Array(3 * n).fill(-1);
  const lineNo = new Int32Array(n).fill(-1);
  const depths = new Int32Array(n);
  const stepPcs = new Int32Array(n);
  const ops = new Array(n), files = new Array(n), functions = new Array(n);
  const entries = new Array(n);
  const changes = [];
  const fnAt = (s, l) => {
    let best = null;
    for (const f of fns) {
      if (s >= f.s && s + l <= f.s + f.l && (!best || f.l < best.l)) best = f;
    }
    return best?.name ?? null;
  };
  // Each step's range: [start, length] in string positions, or null (no
  // source, or the whole contract).
  const rangeAt = (i) => {
    const [s, l, f] = entryAt.get(logs[i].pc) ?? [-1, -1, -1, "-"];
    return s < 0 || f !== 0 || l >= 0.8 * bytes.length ? null
      : [ch(s), ch(s + l) - ch(s)];
  };
  // The call stack, as events: at step `at`, a frame opens or closes.
  const frames = [];
  const counts = { whole: 0, none: 0, specific: 0, into: 0, outOf: 0 };
  let last = -1, stack = [];
  for (let i = 0; i < n; i++) {
    const e = entryAt.get(logs[i].pc) ?? [-1, -1, -1, "-"];
    stepPcs[i] = logs[i].pc;
    ops[i] = logs[i].op;
    entries[i] = e.join(":");
    files[i] = functions[i] = null;
    const r = rangeAt(i);
    if (e[0] < 0 || e[2] < 0) counts.none++;
    else if (!r) counts.whole++;
    else counts.specific++;
    if (r) {
      spans[3 * i] = 0;
      spans[3 * i + 1] = r[0];
      spans[3 * i + 2] = r[0] + r[1];
      lineNo[i] = lineOf(src, r[0]);
      files[i] = NAME;
      functions[i] = fnAt(r[0], r[1]);
      if (lineNo[i] !== last) changes.push(i);
      last = lineNo[i];
    }
    // A JUMP marked i or o: the frame opens or closes at the next step,
    // the jump's target.
    if (logs[i].op === "JUMP" && e[3] === "i" && i + 1 < n) {
      counts.into++;
      const target = rangeAt(i + 1);
      const f = { name: target ? fnAt(...target) : null, at: i + 1,
        until: n, site: r ? { line: lineOf(src, r[0]),
          text: src.slice(r[0], r[0] + r[1]) } : null,
        jump: { step: i, pc: logs[i].pc, entry: entries[i] },
        target: entryAt.get(logs[i + 1].pc).join(":") };
      frames.push(f);
      stack.push(f);
    } else if (logs[i].op === "JUMP" && e[3] === "o") {
      counts.outOf++;
      const f = stack.pop();
      if (f) f.until = i + 1;
    }
  }
  // depths[i]: the frames open at step i.
  for (let i = 0; i < n; i++) {
    depths[i] = frames.filter((f) => f.at <= i && i < f.until).length;
  }
  times["map steps, call stack"] = now() - t;
  datasets[key] = { frames, src };
  const steps = { n, pcs: stepPcs, ops, spans, files, lineNo, depths,
    functions, changes, entries };
  const summary = { ok: true, times, steps: n, ...counts,
    instructions: pcs.length, maxDepth: Math.max(0, ...depths),
    traceBytes: traceText.length,
    jumps: frames.map((f) => ({ ...f.jump, target: f.target,
      name: f.name, site: f.site?.text ?? null, opens: f.at,
      closes: f.until })) };
  return [{ summary, steps, sources: { 0: { text: src } }, main: 0,
    lang: "solidity", stackBase: "the contract's entry (the transaction)",
    capabilities: { callStack: "jumps",
      generated: "a source map entry covering the whole contract, or " +
        "no source (-1)" } },
  [stepPcs.buffer, spans.buffer, lineNo.buffer, depths.buffer]];
}

// The call stack at step i, innermost first: the frames open at i.
async function callStack(key, i) {
  const ds = datasets[key];
  const open = ds.frames.filter((f) => f.at <= i && i < f.until).reverse();
  return [open.map((f) => ({ name: f.name ?? "unknown function",
    args: null, inline: false, site: f.site, at: f.at,
    note: f.name ? null : `its target's entry is ${f.target}` }))];
}

const requests = () => [performance.getEntriesByType("resource")
  .map((e) => ({ name: e.name, transferSize: e.transferSize }))];

const skip = (f) => (report, ...args) => f(...args);
serve({ load, callStack: skip(callStack), requests: skip(requests) });
