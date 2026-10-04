/* tslint:disable */
/* eslint-disable */

/**
 * A transaction or simulation trace held in WebAssembly memory.
 *
 * Build it once with one of the `from…` constructors, optionally attach the contract's
 * ETHDebug artifacts, then step through it or render documents from it as often as
 * needed; nothing is copied or re-parsed between calls. Call `free()` when done, since
 * the trace lives outside the JavaScript heap.
 */
export class Trace {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Attaches a contract artifacts object (see [`pipeline::ContractArtifacts`]): the
     * contract `name`, the parsed global resource file as `metadata`, the parsed
     * `<Contract>_ethdebug-runtime.json` as `program`, and optionally `sources` mapping
     * source ids to contents. Replaces whatever was attached before.
     */
    attachEthdebug(artifacts_json: string): void;
    /**
     * Loads trace JSON produced by `toJson()` or saved by the native CLI.
     */
    static fromJson(trace_json: string): Trace;
    /**
     * Builds the trace of a simulated call from the call that was sent and the `result`
     * field of `debug_traceCall`.
     */
    static fromSimulation(from: string, to: string, calldata: string, value: string, debug_trace_json: string): Trace;
    /**
     * Builds a `debug-rpc` trace from the `result` fields of `debug_traceTransaction`,
     * `eth_getTransactionByHash`, and `eth_getTransactionReceipt`.
     */
    static fromTransaction(debug_trace_json: string, transaction_json: string, receipt_json: string): Trace;
    /**
     * Whether debug info is attached, so steps carry source spans and variables.
     */
    hasEthdebug(): boolean;
    /**
     * One step as JSON: program counter, opcode, gas, source span, enclosing function,
     * machine state, and decoded variables. `undefined` past the end of the trace.
     */
    step(index: number): string | undefined;
    /**
     * Number of opcode steps in the trace.
     */
    stepCount(): number;
    /**
     * The trace's header as JSON (see [`pipeline::TraceSummary`]): hash, parties,
     * gas, status, backend, capabilities, step count, and the attached debug info.
     */
    summary(): string;
    /**
     * The trace as JSON, the input `fromJson` accepts.
     */
    toJson(): string;
}

/**
 * Whether this build of the module carries the REVM replay backend, and so exports
 * `Replay`. The lean package reports `false`.
 */
export function replayAvailable(): boolean;

/**
 * The version of the debugger this module was built from.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_trace_free: (a: number, b: number) => void;
    readonly replayAvailable: () => number;
    readonly trace_attachEthdebug: (a: number, b: number, c: number) => [number, number];
    readonly trace_fromJson: (a: number, b: number) => [number, number, number];
    readonly trace_fromSimulation: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number];
    readonly trace_fromTransaction: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly trace_hasEthdebug: (a: number) => number;
    readonly trace_step: (a: number, b: number) => [number, number, number, number];
    readonly trace_stepCount: (a: number) => number;
    readonly trace_summary: (a: number) => [number, number, number, number];
    readonly trace_toJson: (a: number) => [number, number, number, number];
    readonly version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
