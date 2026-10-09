// The runner's one seam to @ethdebug/evm, and the lazy chunk's entry
// (addendum §2.5): a chain the runner sends transactions to, each
// recorded (@ethdebug/evm's createTrace) and given back in the runner's
// own terms. Only this file names the package's API, so a re-pin
// changes only it.
import { createTrace, Executor } from "@ethdebug/evm";
import type { Hex } from "../types";

// a trace step: the state before its instruction (`memory` is the
// previous step's array when memory did not change: do not mutate it)
export interface StepEvent {
  pc: number; op: number; depth: number;
  stack: readonly bigint[]; memory: Uint8Array;
}
// a message frame: its trace steps, first to last
export interface FrameEvent {
  depth: number; address: Hex; codeAddress: Hex; caller: Hex;
  calldata: Uint8Array; first: number; last: number;
  returnData: Uint8Array; reverted: boolean;
}
export interface Block { number: bigint; timestamp: bigint; prevrandao: Hex }
export interface TxResult {
  success: boolean; returnData: Uint8Array; gasUsed: bigint;
  created?: Hex;              // a create's new contract
  steps: StepEvent[];
  frameOf: number[];          // each step's frame, an index into frames
  frames: FrameEvent[];       // in the order they began
}
export interface Chain {
  fund(address: Hex, balance: bigint): Promise<void>;
  // a create (no `to`) or a call; the transaction ends after it
  send(tx: { from: Hex; to?: Hex; input: Hex; value?: bigint;
    block: Block }): Promise<TxResult>;
  storage(address: Hex, slot: bigint): Promise<bigint>;
}

const lower = (h: string) => h.toLowerCase() as Hex;

export function chain(chainId: bigint): Chain {
  const ex = new Executor({ chainId });
  return {
    fund: (address, balance) => ex.fund(address, balance),
    async send({ from, to, input, value, block }) {
      const trace = createTrace({ memory: "changed" });
      const created = to === undefined
        ? await ex.deploy({ from, create: input, value, block }, trace)
        : undefined;
      const r = created ??
        await ex.call({ from, to: to!, input, value, block }, trace);
      const frames = trace.frames;
      return {
        success: r.success, returnData: r.returnValue, gasUsed: r.gasUsed,
        ...(created?.address ? { created: lower(created.address) } : {}),
        steps: trace.steps.map((t, i) => {
          const s = trace.stateAt(i);
          return { pc: t.pc, op: t.op, depth: t.depth, stack: s.stack,
            memory: s.memory };
        }),
        frameOf: trace.steps.map((_, i) =>
          frames.indexOf(trace.frameAt(i))),
        frames: frames.map((f) => ({ depth: f.depth,
          address: lower(f.address), codeAddress: lower(f.codeAddress),
          caller: lower(f.caller), calldata: f.calldata, first: f.first,
          last: f.end - 1, returnData: f.returnData,
          reverted: f.reverted })),
      };
    },
    storage: (address, slot) => ex.getStorage(slot, address),
  };
}
