/* @ts-self-types="./soldb_wasm.d.ts" */

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
    static __wrap(ptr) {
        const obj = Object.create(Replay.prototype);
        obj.__wbg_ptr = ptr;
        ReplayFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ReplayFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_replay_free(ptr, 0);
    }
    /**
     * Exactly the parent-block state the completed replay depended on, as the JSON
     * `provideState()` accepts. Keep it to replay the same transaction again in one
     * run, offline, or share it so someone else can.
     * @returns {string}
     */
    exportState() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.replay_exportState(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Takes the completed replay as a `Trace`. Consumes this object.
     * @returns {Trace}
     */
    finish() {
        const ptr = this.__destroy_into_raw();
        const ret = wasm.replay_finish(ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Trace.__wrap(ret[0]);
    }
    /**
     * Whether the last run completed with nothing missing.
     * @returns {boolean}
     */
    isComplete() {
        const ret = wasm.replay_isComplete(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Prepares a replay from the `result` fields of `eth_getTransactionByHash`,
     * `eth_getTransactionReceipt`, and `eth_getBlockByNumber(number, true)` for the
     * transaction's block, plus the `eth_chainId` result.
     * @param {string} transaction_json
     * @param {string} receipt_json
     * @param {string} block_json
     * @param {string} chain_id
     * @returns {Replay}
     */
    static prepare(transaction_json, receipt_json, block_json, chain_id) {
        const ptr0 = passStringToWasm0(transaction_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(receipt_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(block_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(chain_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ret = wasm.replay_prepare(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Replay.__wrap(ret[0]);
    }
    /**
     * Prepares a call against the chain as it stood at a block: a fork, without a node
     * that can fork. `block_json` is the `result` of `eth_getBlockByNumber` for the fork
     * point; with `tx_index` the call runs inside that block after the transactions
     * before the index (fetch the block with full transactions), otherwise on top of
     * it. The rest of the loop is the same as for a transaction.
     * @param {string} from
     * @param {string} to
     * @param {string} calldata
     * @param {string} value
     * @param {string} block_json
     * @param {string} chain_id
     * @param {number | null} [tx_index]
     * @returns {Replay}
     */
    static prepareCall(from, to, calldata, value, block_json, chain_id, tx_index) {
        const ptr0 = passStringToWasm0(from, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(to, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(calldata, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(block_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ptr5 = passStringToWasm0(chain_id, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len5 = WASM_VECTOR_LEN;
        const ret = wasm.replay_prepareCall(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, isLikeNone(tx_index) ? Number.MAX_SAFE_INTEGER : (tx_index) >>> 0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Replay.__wrap(ret[0]);
    }
    /**
     * Supplies parent-block state as JSON (see `soldb_evm::StateBatch`): `accounts`
     * keyed by address with `balance`, `nonce`, and `code`; `storage` keyed by address
     * then slot; `blockHashes` keyed by block number.
     * @param {string} batch_json
     */
    provideState(batch_json) {
        const ptr0 = passStringToWasm0(batch_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.replay_provideState(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Runs the replay against the state supplied so far and returns the new status as
     * JSON. A failure is reported only when nothing was missing, so it is real.
     * @returns {string}
     */
    run() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.replay_run(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * Where the replay stands, as JSON (see [`replay::ReplayStatus`]): `complete`, or
     * `needsState` with the `block` to read at and the `requests` to answer.
     * @returns {string}
     */
    status() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.replay_status(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) Replay.prototype[Symbol.dispose] = Replay.prototype.free;

/**
 * A transaction or simulation trace held in WebAssembly memory.
 *
 * Build it once with one of the `from…` constructors, optionally attach the contract's
 * ETHDebug artifacts, then step through it or render documents from it as often as
 * needed; nothing is copied or re-parsed between calls. Call `free()` when done, since
 * the trace lives outside the JavaScript heap.
 */
export class Trace {
    static __wrap(ptr) {
        const obj = Object.create(Trace.prototype);
        obj.__wbg_ptr = ptr;
        TraceFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        TraceFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_trace_free(ptr, 0);
    }
    /**
     * Attaches a contract artifacts object (see [`pipeline::ContractArtifacts`]): the
     * contract `name`, the parsed global resource file as `metadata`, the parsed
     * `<Contract>_ethdebug-runtime.json` as `program`, and optionally `sources` mapping
     * source ids to contents. Replaces whatever was attached before.
     * @param {string} artifacts_json
     */
    attachEthdebug(artifacts_json) {
        const ptr0 = passStringToWasm0(artifacts_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.trace_attachEthdebug(this.__wbg_ptr, ptr0, len0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * Loads trace JSON produced by `toJson()` or saved by the native CLI.
     * @param {string} trace_json
     * @returns {Trace}
     */
    static fromJson(trace_json) {
        const ptr0 = passStringToWasm0(trace_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.trace_fromJson(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Trace.__wrap(ret[0]);
    }
    /**
     * Builds the trace of a simulated call from the call that was sent and the `result`
     * field of `debug_traceCall`.
     * @param {string} from
     * @param {string} to
     * @param {string} calldata
     * @param {string} value
     * @param {string} debug_trace_json
     * @returns {Trace}
     */
    static fromSimulation(from, to, calldata, value, debug_trace_json) {
        const ptr0 = passStringToWasm0(from, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(to, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(calldata, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len3 = WASM_VECTOR_LEN;
        const ptr4 = passStringToWasm0(debug_trace_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len4 = WASM_VECTOR_LEN;
        const ret = wasm.trace_fromSimulation(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Trace.__wrap(ret[0]);
    }
    /**
     * Builds a `debug-rpc` trace from the `result` fields of `debug_traceTransaction`,
     * `eth_getTransactionByHash`, and `eth_getTransactionReceipt`.
     * @param {string} debug_trace_json
     * @param {string} transaction_json
     * @param {string} receipt_json
     * @returns {Trace}
     */
    static fromTransaction(debug_trace_json, transaction_json, receipt_json) {
        const ptr0 = passStringToWasm0(debug_trace_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(transaction_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(receipt_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.trace_fromTransaction(ptr0, len0, ptr1, len1, ptr2, len2);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return Trace.__wrap(ret[0]);
    }
    /**
     * Whether debug info is attached, so steps carry source spans and variables.
     * @returns {boolean}
     */
    hasEthdebug() {
        const ret = wasm.trace_hasEthdebug(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * One step as JSON: program counter, opcode, gas, source span, enclosing function,
     * machine state, and decoded variables. `undefined` past the end of the trace.
     * @param {number} index
     * @returns {string | undefined}
     */
    step(index) {
        const ret = wasm.trace_step(this.__wbg_ptr, index);
        if (ret[3]) {
            throw takeFromExternrefTable0(ret[2]);
        }
        let v1;
        if (ret[0] !== 0) {
            v1 = getStringFromWasm0(ret[0], ret[1]).slice();
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v1;
    }
    /**
     * Number of opcode steps in the trace.
     * @returns {number}
     */
    stepCount() {
        const ret = wasm.trace_stepCount(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * The trace's header as JSON (see [`pipeline::TraceSummary`]): hash, parties,
     * gas, status, backend, capabilities, step count, and the attached debug info.
     * @returns {string}
     */
    summary() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.trace_summary(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * The trace as JSON, the input `fromJson` accepts.
     * @returns {string}
     */
    toJson() {
        let deferred2_0;
        let deferred2_1;
        try {
            const ret = wasm.trace_toJson(this.__wbg_ptr);
            var ptr1 = ret[0];
            var len1 = ret[1];
            if (ret[3]) {
                ptr1 = 0; len1 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred2_0 = ptr1;
            deferred2_1 = len1;
            return getStringFromWasm0(ptr1, len1);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
}
if (Symbol.dispose) Trace.prototype[Symbol.dispose] = Trace.prototype.free;

/**
 * Whether this build of the module carries the REVM replay backend, and so exports
 * `Replay`. The lean package reports `false`.
 * @returns {boolean}
 */
export function replayAvailable() {
    const ret = wasm.replayAvailable();
    return ret !== 0;
}

/**
 * The version of the debugger this module was built from.
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_bce6d499ff0a4aff: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_throw_9c31b086c2b26051: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./soldb_wasm_bg.js": import0,
    };
}

const ReplayFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_replay_free(ptr, 1));
const TraceFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_trace_free(ptr, 1));

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('soldb_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
