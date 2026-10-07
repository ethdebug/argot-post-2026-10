// The interface between the page and a debugger engine. The page (UI,
// highlighting, stepping) talks only to an Engine; the engine does all
// the debugging. soldbEngine() runs soldb-wasm in a Web Worker
// (soldb-worker.js); refEngine() runs ethdebug's reference
// implementation in another (ref-worker.js), for the BUG tab;
// sourceMapEngine() runs a source-map stepper, with no ethdebug, in a
// third (srcmap-worker.js), for the tab "The old way".
//
// An engine loads a dataset and returns every step at once, so the page
// steps and highlights with no round trip. Anything per step that is
// costly (the contract's state) comes on demand, and only when the
// dataset declares that capability. The page shows a feature only when
// its capability is present.

/**
 * Per-step data, index i = step i. Typed arrays may be transferred.
 * @typedef {Object} Steps
 * @property {number} n           number of steps
 * @property {Int32Array} pcs     program counter
 * @property {string[]} ops       opcode mnemonic
 * @property {Int32Array} spans   3 per step: source id, start, end
 *   (string positions in the source text); -1s when the step has no
 *   specific source range (compiler-generated code)
 * @property {(string|null)[]} files  source path, or null
 * @property {Int32Array} lineNo  1-based source line, or -1
 * @property {Int32Array} depths  call depth: the EVM's (soldb), or
 *   the number of frames in the call stack (reference engine)
 * @property {(string|null)[]} functions  function name, or null
 * @property {number[]} changes   steps where the source line changes
 * @property {(Inline|null)[]} [inline]  with the inline capability: a
 *   marker on each step in an inlined body, as the call stack has it
 *   (its innermost frame is an inlined one)
 * @property {string[]} [entries]  source map engine: each step's source
 *   map entry, `s:l:f:j`
 */

/**
 * @typedef {Object} Inline
 * @property {string|null} fn   the inlined function
 * @property {number[]|null} site  its call site: source id, start, end
 * @property {number} line      the call site's line, or -1
 * @property {string|null} text the call site's source text
 */

/**
 * @typedef {Object} Source
 * @property {string} text
 * @property {string} [lib]  set when the file is library code (not the
 *   contract's own); "Skip compiler and library code" skips its steps
 */

/**
 * Features beyond stepping. All optional; absent means not supported.
 * @typedef {Object} Capabilities
 * @property {boolean} [state]      engine.state(dataset, i) works
 * @property {string} [callStack]  engine.callStack(dataset, i) works;
 *   the stack is built from "contexts" (ethdebug's invoke and return)
 *   or "jumps" (a source map's i and o jump markers)
 * @property {boolean} [variables]  engine.variables(dataset, i) works
 * @property {boolean} [inline]     Steps carry `inline` markers
 * @property {string} [generated]  how the engine recognizes
 *   compiler-generated code (the steps it gives -1 spans), as the
 *   compiler marks it; e.g. "for solc, a source range covering the
 *   whole contract". The page's "Skip compiler and library code" skips
 *   these steps.
 * @property {string} [library]  how the engine recognizes library code
 *   (the sources it marks `lib`); e.g. "for Fe, a builtin-core:/ or
 *   builtin-std:/ file". Absent: WhyNot.library says why.
 */

/**
 * Why a data set lacks a panel's data, in plain words. The page shows
 * the same panels on every tab; a panel without its capability shows
 * this text instead. All optional.
 * @typedef {Object} WhyNot
 * @property {string} [callStack]  no call stack (capability callStack)
 * @property {string} [inline]     no inline markers (capability inline)
 * @property {string} [variables]  no variables (state or variables)
 * @property {string} [locals]     shown even with the state: what the
 *   variables panel lacks (local variables)
 * @property {{text: string, href?: string}} [library]  no library
 *   detection (capability library): why, and a link to the issue
 */

/**
 * @typedef {Object} Loaded
 * @property {Object} summary  engine-specific results and timings (ms),
 *   as { times: { label: ms }, ... }, for the details panel
 * @property {Steps} steps
 * @property {Object<number, Source>} sources  by source id
 * @property {number} main     source id to show first
 * @property {string} lang     language name for the highlighter
 * @property {Capabilities} capabilities
 * @property {string} [stackBase]  with a call stack: what its outermost
 *   entry is, in plain words
 */

/**
 * @typedef {Object} Variable
 * @property {string} name
 * @property {string} type
 * @property {string} value  "<...>" marks a placeholder (unknown, ...)
 * @property {string} [scope]  "storage" or "local" (variables only)
 * @property {string} [reason]  why it has no value (a local by type
 *   only)
 * @property {string} [inline]  the inlined function whose body it is a
 *   local of
 */

/**
 * A call stack frame, innermost first.
 * @typedef {Object} Frame
 * @property {string} name
 * @property {string|null} args  "name: value, ...", or null
 * @property {boolean} inline   an inlined (virtual) frame: no real call
 * @property {{line: number, text: string}|null} site  the call site
 * @property {number} at        the step where the frame opened
 * @property {string|null} [note]  more about the frame, in plain words
 */

/**
 * Progress while an engine loads: a file's bytes (see
 * fetch-progress.js, FileProgress), or the work that follows, as
 * { phase: "what the engine does" }.
 * @typedef {(p: Object) => void} OnProgress
 */

/**
 * @typedef {Object} Engine
 * @property {string} name
 * @property {Object<string, WhyNot>} whyNot  by data set
 * @property {(dataset: string, onProgress?: OnProgress) =>
 *   Promise<Loaded>} load
 * @property {(dataset: string, i: number) => Promise<Variable[]>} [state]
 *   the contract's state
 * @property {(dataset: string, i: number) => Promise<Variable[]>}
 *   [variables]  the variables in scope (storage and locals)
 * @property {(dataset: string, i: number) => Promise<Frame[]>}
 *   [callStack]
 * @property {(job: string, onProgress?: OnProgress) => Promise<Object>}
 *   [run]  engine-specific checks (soldb: "bug-check", "replay")
 * @property {() => Promise<{name: string, transferSize: number}[]>}
 *   requests  resource timing entries of the engine's own fetches
 */

// Calls into a module Web Worker: { id, op, args } out; { id, value }
// or { id, error } back, and { id, progress } meanwhile. The worker
// starts at the first call, so its code loads only when needed. A
// worker that fails (its code did not load) is dropped, and the next
// call starts a new one.
function client(name, file) {
  let worker = null;
  const pending = new Map();
  let next = 0;
  const start = () => {
    const w = new Worker(new URL(file, import.meta.url),
      { type: "module" });
    w.onmessage = ({ data: { id, value, error, progress } }) => {
      const p = pending.get(id);
      if (!p) return;
      if (progress) {
        p.onProgress?.(progress);
        return;
      }
      pending.delete(id);
      if (error === undefined) p.resolve(value);
      else p.reject(new Error(error));
    };
    w.onerror = (e) => {
      e.preventDefault();
      const err = new Error(`Could not start ${name}: its code did not ` +
        `load${e.message ? ` (${e.message})` : ""}`);
      for (const p of pending.values()) p.reject(err);
      pending.clear();
      w.terminate();
      if (worker === w) worker = null;
    };
    return w;
  };
  const call = (op, args, onProgress) => new Promise((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject, onProgress });
    (worker ??= start()).postMessage({ id, op, args });
  });
  // requests() only asks a worker that has started.
  call.started = () => worker !== null;
  return call;
}

/** @returns {Engine} soldb-wasm, in a module Web Worker. */
export function soldbEngine() {
  const call = client("soldb", "./soldb-worker.js");
  return {
    name: "soldb",
    whyNot: {
      sol: {
        callStack: "No call stack: solc emits no invoke or return " +
          "contexts yet.",
        inline: "No inlining: solc emits ethdebug only with the " +
          "optimizer off.",
        locals: "No local variables: solc does not emit them yet.",
        // solc's ethdebug gives every instruction the contract's own
        // source id, even code from imported files.
        library: { text: "Imported code: not detectable yet",
          href: "https://github.com/ethdebug/format/issues/329" },
      },
      fe: {
        callStack: "No call stack: Fe's export writes only source " +
          "ranges, no invoke or return contexts.",
        inline: "No inline markers: Fe tracks inlining internally, " +
          "but its export writes no inline contexts.",
        variables: "No variables: Fe's export has none.",
      },
    },
    load: (dataset, onProgress) => call("load", [dataset], onProgress),
    state: (dataset, i) => call("state", [dataset, i]),
    run: (job, onProgress) => call("run", [job], onProgress),
    requests: async () => call.started() ? call("requests", []) : [],
  };
}

/**
 * @returns {Engine} ethdebug's reference implementation (pointers, evm,
 * programs-react's trace reconstruction), in a module Web Worker.
 * Data sets "bug-O0" and "bug-O2".
 */
export function refEngine() {
  const call = client("reference", "./ref-worker.js");
  return {
    name: "reference",
    whyNot: {
      "bug-O0": { inline: "No inlining: at -O0, bugc inlines nothing.",
        library: { text: "Library code: none in BUG" } },
      "bug-O2": { library: { text: "Library code: none in BUG" } },
    },
    load: (dataset, onProgress) => call("load", [dataset], onProgress),
    variables: (dataset, i) => call("variables", [dataset, i]),
    callStack: (dataset, i) => call("callStack", [dataset, i]),
    requests: async () => call.started() ? call("requests", []) : [],
  };
}

/**
 * @returns {Engine} a source-map stepper, with no ethdebug: solc's
 * bytecode, source map and AST, in a module Web Worker. Data set
 * "old".
 */
export function sourceMapEngine() {
  const call = client("the source map stepper", "./srcmap-worker.js");
  const no = {
    variables: "No variables: a source map has none. solc writes no " +
      "output that says where a local variable is at a step.",
    inline: "No inlining: a source map has no inline marker. Here " +
      "solc inlined rolledHit, resetCombo and multiplied; their steps " +
      "carry only their own ranges.",
    library: { text: "Library code: none in this contract" },
  };
  return {
    name: "the source map stepper",
    whyNot: { old: no },
    load: (dataset, onProgress) => call("load", [dataset], onProgress),
    callStack: (dataset, i) => call("callStack", [dataset, i]),
    requests: async () => call.started() ? call("requests", []) : [],
  };
}
