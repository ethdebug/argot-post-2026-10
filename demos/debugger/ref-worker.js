// The reference engine: ethdebug's reference implementation in a Web
// Worker, for the BUG tab. It is not soldb. Every ethdebug call happens
// here, through vendor/ethdebug-ref.js (see make-ref-vendor.sh):
// - @ethdebug/programs-react's trace reconstruction: the call stack
//   (buildCallStack, from `invoke` and `return` contexts), the context
//   that holds at a step (effectiveContextForStep: instruction contexts
//   are postconditions), its variables and its transforms;
// - @ethdebug/evm's Machine.State adapter (createMachineState), over
//   the saved trace;
// - @ethdebug/pointers' dereference, for each variable's pointer.
// The decoding of values (uint, address, bool) is this file's own: a
// stand-in for the format's planned interpretation layer.
//
// It implements the engine interface of engine.js. Messages:
// { id, op, args } in; { id, value } or { id, error } out, and
// { id, progress } while a file arrives or a phase starts (see
// fetch-progress.js).
//   load(dataset)          "bug-O0" or "bug-O2": a Loaded
//   variables(dataset, i)  Variable[] at step i
//   callStack(dataset, i)  Frame[] at step i, innermost first
//   requests()             this worker's resource timing entries

import {
  dereference, Data, createMachineState, buildCallStack,
  buildPcToInstructionMap, extractVariablesFromInstruction,
  extractTransformFromInstruction, effectiveContextForStep, commit,
} from "./vendor/ethdebug-ref.js";
import { fetcher, serve, textOf } from "./fetch-progress.js";

const now = () => performance.now();

async function timed(times, label, fn) {
  const t = now();
  const v = await fn();
  times[label] = now() - t;
  return v;
}

// One program, two optimization levels, by bugc from ethdebug/format
// main (local variables at every level).
const BUG = "bug";
const FILE = "scores.bug";
const DIRS = { "bug-O0": `${BUG}/scores-O0`,
  "bug-O2": `${BUG}/scores-O2` };

// The context tree's `code` ranges, each marked when it sits in a
// context with transform "inline" (an inlined body). In bugc's output
// an inlined instruction gathers the call site's range (unmarked) and
// the body's (marked).
function codes(ctx, inline = false, out = []) {
  if (!ctx) return out;
  const here = inline || (ctx.transform ?? []).includes("inline");
  if (ctx.code?.range) out.push({ ...ctx.code.range, inline: here });
  for (const c of ctx.gather ?? []) codes(c, false, out);
  for (const c of ctx.pick ?? []) codes(c, false, out);
  return out;
}

// The invoke contexts in a context tree.
function invokes(ctx, out = []) {
  if (!ctx) return out;
  if (ctx.invoke) out.push(ctx.invoke);
  for (const c of ctx.gather ?? []) invokes(c, out);
  for (const c of ctx.pick ?? []) invokes(c, out);
  return out;
}

const lineOf = (src, offset) => {
  let n = 1;
  for (let k = src.indexOf("\n"); k >= 0 && k < offset;
    k = src.indexOf("\n", k + 1)) n++;
  return n;
};

// A call stack frame's call site: the unmarked `code` range of the
// instruction that carries its invoke. The frame opens at the step
// after that instruction (contexts are postconditions), or a few steps
// later when the invoke repeats (a JUMP, then its JUMPDEST).
function siteOf(logs, map, f) {
  for (let j = f.stepIndex - 1; j >= Math.max(0, f.stepIndex - 4); j--) {
    const ctx = map.get(logs[j].pc)?.context;
    const c = invokes(ctx).some((v) => v.identifier === f.identifier)
      && codes(ctx).find((c) => !c.inline);
    if (c) return c;
  }
  return null;
}

const datasets = {};

async function load(report, key) {
  const dir = DIRS[key];
  const times = {};
  const get = fetcher(report);
  const text = async (url, label) => textOf(await get(url, label));
  const json = async (url, label) => JSON.parse(await text(url, label));
  const [program, dbg, src, before, runtime] = await timed(times,
    "fetch program, trace, source", () => Promise.all([
      json(`${dir}/scores.program.json`, "bugc's ethdebug program"),
      text(`${dir}/tx.debug-trace.json`, "the transaction trace"),
      text(`${BUG}/${FILE}`, "the source"),
      json(`${dir}/tx.storage-before.json`, "the storage before"),
      text(`${dir}/out/Scores.runtime.bin`, "the deployed code"),
    ]));
  report({ phase: "The reference implementation maps each step" });
  const logs = await timed(times, "parse trace", () =>
    JSON.parse(dbg).structLogs);
  const n = logs.length;
  const t = now();
  const map = buildPcToInstructionMap(program);
  const trace = logs.map((l) => ({ pc: l.pc, opcode: l.op }));
  const ctxAt = (i) => map.get(logs[i].pc)?.context;

  // Each function's declaration, from the invoke contexts.
  const decls = new Map();
  // An inlined body's function, by its call site's range.
  const inlined = new Map();
  for (const ins of program.instructions) {
    for (const inv of invokes(ins.context)) {
      const d = inv.declaration?.range;
      if (d) decls.set(inv.identifier, d);
      const tr = extractTransformFromInstruction(ins);
      const site = codes(ins.context).find((c) => !c.inline);
      if (tr.includes("inline") && site) {
        inlined.set(`${site.offset}:${site.length}`, inv.identifier);
      }
    }
  }
  const within = (r, at) => at >= r.offset && at < r.offset + r.length;
  const fnAt = (at) => {
    let best = null;
    for (const [name, r] of decls) {
      if (within(r, at) && (!best || r.length < decls.get(best).length)) {
        best = name;
      }
    }
    return best;
  };

  // Per step: the source span from the step's own instruction (the
  // inlined body's range, if any), as the reference trace viewer shows
  // it; the call stack from buildCallStack, and from it the call depth
  // and the inline marker.
  const pcs = new Int32Array(n);
  const spans = new Int32Array(3 * n).fill(-1);
  const lineNo = new Int32Array(n).fill(-1);
  const depths = new Int32Array(n);
  const ops = new Array(n), files = new Array(n), functions = new Array(n);
  const inline = new Array(n).fill(null);
  const changes = [];
  let last = -1, withInline = 0, maxDepth = 0, noCode = 0, whole = 0;
  for (let i = 0; i < n; i++) {
    pcs[i] = logs[i].pc;
    ops[i] = logs[i].op;
    const cs = codes(ctxAt(i));
    // Compiler-generated code: no `code` range, or one that covers most
    // of the program (the whole program, not one range): no span.
    const found = cs.find((c) => c.inline) ?? cs[0];
    const all = found && found.length >= 0.8 * src.length;
    const body = all ? null : found;
    if (!found) noCode++;
    if (all) whole++;
    files[i] = functions[i] = null;
    if (body) {
      spans[3 * i] = 0;
      spans[3 * i + 1] = body.offset;
      spans[3 * i + 2] = body.offset + body.length;
      lineNo[i] = lineOf(src, body.offset);
      files[i] = FILE;
      functions[i] = fnAt(body.offset);
      if (lineNo[i] !== last) changes.push(i);
      last = lineNo[i];
    }
    // The inline marker comes from the call stack: the step is in an
    // inlined body when its innermost frame is an inlined (virtual)
    // one, from the step after the inlined invoke through the step of
    // the instruction that carries the inlined return.
    const frames = buildCallStack(trace, map, i, program.context);
    const top = frames.at(-1);
    if (top?.isInline) {
      withInline++;
      const s = siteOf(logs, map, top);
      inline[i] = {
        fn: top.identifier,
        site: s ? [0, s.offset, s.offset + s.length] : null,
        line: s ? lineOf(src, s.offset) : -1,
        text: s ? src.slice(s.offset, s.offset + s.length) : null,
      };
    }
    depths[i] = frames.length;
    maxDepth = Math.max(maxDepth, depths[i]);
  }
  times["map steps, call stack per step"] = now() - t;

  // Storage before each step: the state before the transaction, then
  // each SSTORE in order. The trace has no storage of its own.
  const stores = [];
  for (let i = 0; i < n; i++) {
    if (logs[i].op !== "SSTORE") continue;
    const st = logs[i].stack;
    stores.push({ step: i, slot: BigInt(st[st.length - 1]),
      value: BigInt(st[st.length - 2]) });
  }
  const pre = new Map(Object.entries(before)
    .map(([k, v]) => [BigInt(k), BigInt(v)]));
  const code = Data.fromHex("0x" + runtime.trim());

  // The functions bugc inlines at this level: their locals are an
  // inlined body's.
  const inlinedFns = new Set(inlined.values());
  datasets[key] = { program, logs, map, trace, src, stores, pre, code,
    fnAt, inlinedFns };
  const steps = { n, pcs, ops, spans, files, lineNo, depths, functions,
    changes, inline };
  const summary = { ok: true, times, commit, steps: n,
    instructions: program.instructions.length, withInline, maxDepth,
    noCode, whole,
    traceBytes: dbg.length };
  return [{ summary, steps, sources: { 0: { text: src } }, main: 0,
    lang: "rust", stackBase: "the code block (transaction entry)",
    capabilities: { callStack: "contexts", variables: true,
      inline: withInline > 0,
      generated: "for bugc, an instruction with no code range" } },
  [pcs.buffer, spans.buffer, lineNo.buffer, depths.buffer]];
}

// @ethdebug/evm's Machine.State at step i. Its executor stands for the
// node: storage as it was before step i, and the deployed code.
function machineState(ds, i) {
  const l = ds.logs[i];
  const hex = (l.memory ?? []).join("");
  const executor = {
    async getStorage(slot) {
      let v = ds.pre.get(slot) ?? 0n;
      for (const s of ds.stores) {
        if (s.step >= i) break;
        if (s.slot === slot) v = s.value;
      }
      return v;
    },
    getCode: async () => ds.code,
  };
  return createMachineState(executor, {
    traceIndex: BigInt(i),
    traceStep: { pc: l.pc, opcode: l.op, stack: l.stack.map(BigInt),
      memory: Data.fromHex("0x" + hex) },
  });
}

// A simple decoding of one word by its type. The format's
// interpretation layer will do this properly; this is a stand-in.
function decode(data, type) {
  const v = data.asUint();
  if (type?.kind === "address") {
    return "0x" + v.toString(16).padStart(40, "0");
  }
  if (type?.kind === "bool") return String(v !== 0n);
  return v.toString();
}

const REASON = "no location here: not stored yet, or folded (#291)";

const typeName = (t) => {
  if (!t) return "?";
  if (t.kind === "uint" || t.kind === "int") {
    return `${t.kind}${t.bits ?? 256}`;
  }
  if (t.kind === "array") return `${typeName(t.contains?.type)}[]`;
  if (t.kind === "mapping") {
    return `mapping(${typeName(t.contains?.key?.type)} => ` +
      `${typeName(t.contains?.value?.type)})`;
  }
  return t.kind;
};

// The value a pointer names at step i, by its type: an array, from the
// regions bugc names `<name>-length` and `<name>-element` (memory) or
// `array-length` and `element` (storage); a struct,
// from one region per member; else the region named `name`, or the
// last region. A mapping's pointer names only its base slot, so the
// page shows no entries.
async function valueAt(ds, i, pointer, name, type) {
  if (type?.kind === "mapping") {
    return `<mapping at slot ${pointer.slot ?? "?"}>`;
  }
  const state = machineState(ds, i);
  const cursor = await dereference(pointer, { state });
  const view = await cursor.view(state);
  const read = async (r, t) => decode(await view.read(r), t);
  if (type?.kind === "array") {
    const named = (...ks) => ks.map((k) => view.regions.named(k))
      .find((x) => x?.length) ?? [];
    const length = named(`${name}-length`, "array-length").at(-1);
    const items = [];
    for (const r of named(`${name}-element`, "element")) {
      items.push(await read(r, type.contains?.type));
    }
    if (length) {
      return `length ${await read(length)}: [${items.join(", ")}]`;
    }
  }
  if (type?.kind === "struct" && Array.isArray(type.contains)) {
    const fields = [];
    for (const m of type.contains) {
      const r = view.regions.named(m.name)?.at(-1);
      if (r) fields.push(`${m.name}: ${await read(r, m.type)}`);
    }
    if (fields.length) return `{ ${fields.join(", ")} }`;
  }
  const region = view.regions.named(name)?.at(-1)
    ?? view.regions.at(-1);
  return read(region, type);
}

// Variables at step i: those of the context that holds at step i (the
// previous instruction's context, a postcondition), each read through
// its pointer from the state observed at step i. A local with no
// pointer is listed by type only: bugc gives a local a location only
// where its value is stored (before its MSTORE, while a jump copies
// phi values, or when the optimizer folds or removes it, it has none;
// the format cannot yet say "the value is this expression", #291).
// A local of a function that bugc inlines is marked with that function.
async function variables(key, i) {
  const ds = datasets[key];
  const context = effectiveContextForStep({
    programContext: ds.program.context,
    contextAtPc: (pc) => ds.map.get(pc)?.context,
    trace: ds.trace, stepIndex: i,
  });
  const vars = context ? extractVariablesFromInstruction({ context }) : [];
  const out = [];
  for (const v of vars) {
    // Storage if any of its regions is (a struct's pointer is a group).
    const scope = /"location":"storage"/.test(JSON.stringify(v.pointer))
      ? "storage" : "local";
    let value = "<no location>";
    if (v.pointer) {
      try {
        value = await valueAt(ds, i, v.pointer, v.identifier, v.type);
      } catch (e) {
        value = `<error: ${e.message}>`;
      }
    }
    const d = v.declaration?.range;
    const fn = scope === "local" && d && ds.fnAt(d.offset);
    out.push({ name: v.identifier, type: typeName(v.type), value, scope,
      ...(v.pointer ? {} : { reason: REASON }),
      ...(ds.inlinedFns.has(fn) ? { inline: fn } : {}) });
  }
  return [out];
}

// The call stack at step i, innermost first. Each frame: the function,
// its arguments read through their pointers (at the step the frame
// opened), whether it is an inlined (virtual) frame, and its call site:
// the range of the call, from the invoke instruction just before.
async function callStack(key, i) {
  const ds = datasets[key];
  const frames = buildCallStack(ds.trace, ds.map, i, ds.program.context);
  const out = [];
  for (const f of frames.reverse()) {
    const c = siteOf(ds.logs, ds.map, f);
    const site = c && { line: lineOf(ds.src, c.offset),
      text: ds.src.slice(c.offset, c.offset + c.length) };
    let args = null;
    if (f.argumentPointers) {
      args = [];
      for (const p of f.argumentPointers) {
        try {
          args.push(`${p.name}: ${await valueAt(ds, f.stepIndex, p,
            p.name)}`);
        } catch {
          args.push(`${p.name}: ?`);
        }
      }
      args = args.join(", ");
    }
    out.push({ name: f.identifier ?? "?", args, site,
      inline: !!f.isInline, at: f.stepIndex });
  }
  return [out];
}

const requests = () => [performance.getEntriesByType("resource")
  .map((e) => ({ name: e.name, transferSize: e.transferSize }))];

// The ops take a progress `report` first; only load uses it.
const skip = (f) => (report, ...args) => f(...args);
serve({ load, variables: skip(variables), callStack: skip(callStack),
  requests: skip(requests) });
