// A Machine.State over a snapshot (vanilla decode.js storageState,
// memoryState): the storage words it knows, its memory and calldata
// (bytes past the end read as zero, as in the EVM), its stack (none:
// empty); any other part throws when read
import { Data, type Machine } from "./lib";
import type { Hex, Snapshot } from "./types";
import { slotHex } from "./hex";

// a word's bytes, or a slice of them
const sliced = (word: Data, slice?: { offset: bigint; length: bigint }) =>
  !slice ? word : Data.fromBytes(word.slice(Number(slice.offset),
    Number(slice.offset + slice.length)));

export function machineState(s: Snapshot): Machine.State {
  const none = (what: string): never => {
    throw new Error(`${what} is not part of this state`);
  };
  // a segment of bytes (memory, calldata)
  const bytes = (what: string, b?: Uint8Array) => {
    if (!b) return none(what);
    return {
      get length() {
        return Promise.resolve(BigInt(b.length));
      },
      async read({ slice }: { slice: { offset: bigint;
        length: bigint } }) {
        const o = Number(slice.offset);
        const out = new Uint8Array(Number(slice.length));
        out.set(b.slice(o, Math.min(o + out.length, b.length)));
        return Data.fromBytes(out);
      },
    } as unknown as Machine.State["memory"];
  };
  return {
    storage: {
      async read({ slot, slice }) {
        const at = slotHex(slot.asUint());
        const w = s.storage.get(at);
        if (w === undefined) throw new Error(`slot ${at} is not known`);
        return sliced(Data.fromHex(w as Hex).resizeTo(32), slice);
      },
    },
    // (dereference() reads the stack length up front, even for storage)
    stack: {
      get length() {
        return Promise.resolve(BigInt(s.stack?.length ?? 0));
      },
      async peek({ depth, slice }) {
        const st = s.stack ?? [];
        const w = st[st.length - 1 - Number(depth)];
        if (w === undefined) throw new Error(`no stack item ${depth}`);
        return sliced(Data.fromHex(w).resizeTo(32), slice);
      },
    },
    get memory() { return bytes("memory", s.memory); },
    get calldata() { return bytes("calldata", s.calldata); },
    get returndata() { return none("returndata"); },
    get transient() { return none("transient"); },
    get code() { return none("code"); },
    get traceIndex() { return Promise.resolve(0n); },
    get programCounter() { return Promise.resolve(0n); },
    get opcode() { return Promise.resolve("STOP"); },
  };
}
