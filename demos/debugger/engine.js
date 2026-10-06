// The interface between the page and a debugger engine. The page (UI,
// highlighting, stepping) talks only to an Engine; the engine does all
// the debugging. soldbEngine() runs soldb-wasm in a Web Worker
// (soldb-worker.js); refEngine() runs ethdebug's reference
// implementation in another (ref-worker.js), for the BUG tab.
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
 *   marker on each step whose instruction is part of an inlined body
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
 * @property {string} [lib]  set when the file is a standard library
 */

/**
 * Features beyond stepping. All optional; absent means not supported.
 * @typedef {Object} Capabilities
 * @property {boolean} [state]      engine.state(dataset, i) works
 * @property {boolean} [callStack]  engine.callStack(dataset, i) works
 * @property {boolean} [variables]  engine.variables(dataset, i) works
 * @property {boolean} [inline]     Steps carry `inline` markers
 * @property {string} [generated]  how the engine recognizes
 *   compiler-generated code (the steps it gives -1 spans), as the
 *   compiler marks it; e.g. "for solc, a source range covering the
 *   whole contract". The page's "Skip compiler code" skips these steps.
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
 */

/**
 * @typedef {Object} Variable
 * @property {string} name
 * @property {string} type
 * @property {string} value  "<...>" marks a placeholder (unknown, ...)
 * @property {string} [scope]  "storage" or "local" (variables only)
 */

/**
 * A call stack frame, innermost first.
 * @typedef {Object} Frame
 * @property {string} name
 * @property {string|null} args  "name: value, ...", or null
 * @property {boolean} inline   an inlined (virtual) frame: no real call
 * @property {{line: number, text: string}|null} site  the call site
 * @property {number} at        the step where the frame opened
 */

/**
 * @typedef {Object} Engine
 * @property {string} name
 * @property {Object<string, WhyNot>} whyNot  by data set
 * @property {(dataset: string) => Promise<Loaded>} load
 * @property {(dataset: string, i: number) => Promise<Variable[]>} [state]
 *   the contract's state
 * @property {(dataset: string, i: number) => Promise<Variable[]>}
 *   [variables]  the variables in scope (storage and locals)
 * @property {(dataset: string, i: number) => Promise<Frame[]>}
 *   [callStack]
 * @property {(job: string) => Promise<Object>} [run]  engine-specific
 *   checks (soldb: "bug-check", "replay")
 * @property {() => Promise<{name: string, transferSize: number}[]>}
 *   requests  resource timing entries of the engine's own fetches
 */

// Calls into a module Web Worker: { id, op, args } out, { id, value }
// or { id, error } back.
function client(name, file) {
  const worker = new Worker(new URL(file, import.meta.url),
    { type: "module" });
  const pending = new Map();
  let next = 0;
  worker.onmessage = ({ data: { id, value, error } }) => {
    const p = pending.get(id);
    pending.delete(id);
    if (error === undefined) p.resolve(value);
    else p.reject(new Error(error));
  };
  worker.onerror = (e) => {
    e.preventDefault();
    const err = new Error(`${name} worker: ${e.message
      || "failed to start"}`);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
  return (op, ...args) => new Promise((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, op, args });
  });
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
      },
      fe: {
        callStack: "No call stack: Fe's export writes only source " +
          "ranges, no invoke or return contexts.",
        inline: "No inline markers: Fe tracks inlining internally, " +
          "but its export writes no inline contexts.",
        variables: "No variables: Fe's export has none.",
      },
    },
    load: (dataset) => call("load", dataset),
    state: (dataset, i) => call("state", dataset, i),
    run: (job) => call("run", job),
    requests: () => call("requests"),
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
      "bug-O0": { inline: "No inlining: at -O0, bugc inlines nothing." },
    },
    load: (dataset) => call("load", dataset),
    variables: (dataset, i) => call("variables", dataset, i),
    callStack: (dataset, i) => call("callStack", dataset, i),
    requests: () => call("requests"),
  };
}
