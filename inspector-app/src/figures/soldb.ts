// soldb, as the old debugger demo drives it (demos/debugger/engine.js
// soldbEngine: soldb-wasm in a module Web Worker, soldb-worker.js), its
// code loaded from where the site serves it, beside this app
// (../debugger/), on first use: none of it in the app's bundle. The
// shapes are engine.js's (its typedefs); what the figure reads of them
// is typed here.

// one file's progress (fetch-progress.js FileProgress), or a phase
export type Progress = { path?: string; label?: string; loaded?: number;
  total?: number | null; done?: boolean; phase?: string };

export interface Steps {
  n: number; pcs: Int32Array; ops: string[];
  // 3 a step: source id, start, end (characters); -1s: no range of its
  // own (compiler-generated code)
  spans: Int32Array;
  files: (string | null)[]; lineNo: Int32Array; depths: Int32Array;
  functions: (string | null)[];
  changes: number[];                    // steps where the line changes
}
export interface Loaded {
  steps: Steps; main: number; lang: string;
  sources: Record<number, { text: string; lib?: string }>;
  capabilities: { state?: boolean; generated?: string; library?: string };
  summary: { times: Record<string, number> };
}
export interface Variable { name: string; type: string; value: string }
export interface Engine {
  whyNot: Record<string, { callStack?: string; variables?: string;
    locals?: string; inline?: string }>;
  load(dataset: string, onProgress?: (p: Progress) => void):
    Promise<Loaded>;
  state(dataset: string, i: number): Promise<Variable[]>;
  requests(): Promise<{ name: string; transferSize: number }[]>;
}

// (the page's own directory's sibling: /demos/debugger/, on the dev
// server too: bin/vite-debugger.ts)
const at = () => new URL("../debugger/engine.js", document.baseURI).href;

// a new engine (its worker starts at its first call); the module is
// the browser's to cache
export const soldb = async (): Promise<Engine> => (await import(
  /* @vite-ignore */ at()) as { soldbEngine(): Engine }).soldbEngine();
