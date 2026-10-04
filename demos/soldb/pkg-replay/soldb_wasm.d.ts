/* tslint:disable */
/* eslint-disable */

/**
 * A host-driven replay of a mined transaction, for nodes without `debug_traceTransaction`.
 *
 * REVM runs inside the module but cannot fetch state itself, so the host works in
 * rounds: `status()` lists the parent-block state the next run needs, the host fetches
 * it with `eth_getBalance`, `eth_getTransactionCount`, `eth_getCode`,
 * `eth_getStorageAt`, and `eth_getBlockByNumber` at the block `status()` names, passes
 * the results to `provideState()`, and calls `run()`. Missing values default to empty
 * and are recorded, so a run either completes or reports exactly what it still lacks;
 * the loop converges in a few rounds. The transactions before the target in its block
 * run only until they run clean, after which each round re-executes the target alone.
 * `finish()` then yields the `Trace`, and `exportState()` the state it depended on.
 */
export class Replay {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Exactly the parent-block state the completed replay depended on, as the JSON
     * `provideState()` accepts. Keep it to replay the same transaction again in one
     * run, offline, or share it so someone else can.
     */
    exportState(): string;
    /**
     * Takes the completed replay as a `Trace`. Consumes this object.
     */
    finish(): Trace;
    /**
     * Whether the last run completed with nothing missing.
     */
    isComplete(): boolean;
    /**
     * Prepares a replay from the `result` fields of `eth_getTransactionByHash`,
     * `eth_getTransactionReceipt`, and `eth_getBlockByNumber(number, true)` for the
     * transaction's block, plus the `eth_chainId` result.
     */
    static prepare(transaction_json: string, receipt_json: string, block_json: string, chain_id: string): Replay;
    /**
     * Prepares a call against the chain as it stood at a block: a fork, without a node
     * that can fork. `block_json` is the `result` of `eth_getBlockByNumber` for the fork
     * point; with `tx_index` the call runs inside that block after the transactions
     * before the index (fetch the block with full transactions), otherwise on top of
     * it. The rest of the loop is the same as for a transaction.
     */
    static prepareCall(from: string, to: string, calldata: string, value: string, block_json: string, chain_id: string, tx_index?: number | null): Replay;
    /**
     * Supplies parent-block state as JSON (see `soldb_evm::StateBatch`): `accounts`
     * keyed by address with `balance`, `nonce`, and `code`; `storage` keyed by address
     * then slot; `blockHashes` keyed by block number.
     */
    provideState(batch_json: string): void;
    /**
     * Runs the replay against the state supplied so far and returns the new status as
     * JSON. A failure is reported only when nothing was missing, so it is real.
     */
    run(): string;
    /**
     * Where the replay stands, as JSON (see [`replay::ReplayStatus`]): `complete`, or
     * `needsState` with the `block` to read at and the `requests` to answer.
     */
    status(): string;
}

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
    readonly __wbg_replay_free: (a: number, b: number) => void;
    readonly __wbg_trace_free: (a: number, b: number) => void;
    readonly replayAvailable: () => number;
    readonly replay_exportState: (a: number) => [number, number, number, number];
    readonly replay_finish: (a: number) => [number, number, number];
    readonly replay_isComplete: (a: number) => number;
    readonly replay_prepare: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly replay_prepareCall: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => [number, number, number];
    readonly replay_provideState: (a: number, b: number, c: number) => [number, number];
    readonly replay_run: (a: number) => [number, number, number, number];
    readonly replay_status: (a: number) => [number, number, number, number];
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
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
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
