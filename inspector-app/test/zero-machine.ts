// A machine state that holds zeros everywhere, of every location the
// pointer schema names: what the schema's examples are walked against
// (they imply no state of their own)
import { Data, type Machine } from "../src/engine/lib";

const zeros = (n: bigint) => Data.fromBytes(new Uint8Array(Number(n)));
const sliced = (slice?: { offset: bigint; length: bigint }) =>
  zeros(slice?.length ?? 32n);
const segment = {
  get length() { return Promise.resolve(1024n); },
  async read({ slice }: { slice: { offset: bigint; length: bigint } }) {
    return zeros(slice.length);
  },
};
const keyed = {
  async read({ slice }: { slice?: { offset: bigint; length: bigint } }) {
    return sliced(slice);
  },
};

export const zeroMachine = {
  storage: keyed, transient: keyed,
  stack: {
    get length() { return Promise.resolve(16n); },
    async peek({ slice }: { slice?: { offset: bigint; length: bigint } }) {
      return sliced(slice);
    },
  },
  memory: segment, calldata: segment, returndata: segment, code: segment,
  get traceIndex() { return Promise.resolve(0n); },
  get programCounter() { return Promise.resolve(0n); },
  get opcode() { return Promise.resolve("STOP"); },
} as unknown as Machine.State;
