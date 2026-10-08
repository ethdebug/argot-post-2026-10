// A Machine.State over a snapshot (vanilla decode.js storageState,
// memoryState): the storage words it knows, and its memory (bytes past
// the end read as zero, as in the EVM); any other part throws when read
import { Data, type Machine } from "./lib";
import type { Hex, Snapshot } from "./types";
import { slotHex } from "./hex";

export function machineState(s: Snapshot): Machine.State {
  const none = (what: string): never => {
    throw new Error(`${what} is not part of this state`);
  };
  return {
    storage: {
      async read({ slot, slice }) {
        const at = slotHex(slot.asUint());
        const w = s.storage.get(at);
        if (w === undefined) throw new Error(`slot ${at} is not known`);
        const word = Data.fromHex(w as Hex).resizeTo(32);
        if (!slice) return word;
        const o = Number(slice.offset);
        return Data.fromBytes(word.slice(o, o + Number(slice.length)));
      },
    },
    // dereference() reads the stack length up front, even for storage
    stack: {
      get length() {
        return Promise.resolve(0n);
      },
      peek: () => none("stack"),
    },
    get memory() {
      const mem = s.memory;
      if (!mem) return none("memory");
      return {
        get length() {
          return Promise.resolve(BigInt(mem.length));
        },
        async read({ slice }: { slice: { offset: bigint;
          length: bigint } }) {
          const o = Number(slice.offset);
          const out = new Uint8Array(Number(slice.length));
          out.set(mem.slice(o, Math.min(o + out.length, mem.length)));
          return Data.fromBytes(out);
        },
      } as unknown as Machine.State["memory"];
    },
    get calldata() { return none("calldata"); },
    get returndata() { return none("returndata"); },
    get transient() { return none("transient"); },
    get code() { return none("code"); },
    get traceIndex() { return Promise.resolve(0n); },
    get programCounter() { return Promise.resolve(0n); },
    get opcode() { return Promise.resolve("STOP"); },
  };
}
