// The interface between the page and a debugger engine. The page (UI,
// highlighting, stepping) talks only to an Engine; the engine does all
// the debugging. soldbEngine() runs soldb-wasm in a Web Worker
// (soldb-worker.js). Another engine (for example, ethdebug's reference
// implementation) can implement the same interface.
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
 * @property {Int32Array} depths  EVM call depth
 * @property {(string|null)[]} functions  function name, or null
 * @property {number[]} changes   steps where the source line changes
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
 * @property {boolean} [callStack]  Steps carry a call stack (reserved)
 * @property {boolean} [variables]  Steps carry variables (reserved)
 * @property {boolean} [inline]     Steps mark inlined code (reserved)
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
 */

/**
 * @typedef {Object} Engine
 * @property {string} name
 * @property {(dataset: string) => Promise<Loaded>} load
 * @property {(dataset: string, i: number) => Promise<Variable[]>} state
 * @property {(job: string) => Promise<Object>} run  engine-specific
 *   checks (soldb: "bug-check", "replay")
 * @property {() => Promise<{name: string, transferSize: number}[]>}
 *   requests  resource timing entries of the engine's own fetches
 */

/** @returns {Engine} soldb-wasm, in a module Web Worker. */
export function soldbEngine() {
  const worker = new Worker(new URL("./soldb-worker.js", import.meta.url),
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
    const err = new Error(`soldb worker: ${e.message || "failed to start"}`);
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };
  const call = (op, ...args) => new Promise((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, op, args });
  });
  return {
    name: "soldb",
    load: (dataset) => call("load", dataset),
    state: (dataset, i) => call("state", dataset, i),
    run: (job) => call("run", job),
    requests: () => call("requests"),
  };
}
