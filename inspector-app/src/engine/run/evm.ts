// The runner's one seam to @ethdebug/evm, and the lazy chunk's entry
// (addendum §2.5): a chain the runner sends transactions to, reporting
// each trace step and message frame in the runner's own terms. Only
// this file names the package's API, so a re-pin changes only it.
import { Executor, type TraceOptions } from "@ethdebug/evm";
import type { Hex } from "../types";
import { opByte } from "./opcodes";

// a trace step: the state before its instruction (`memory` may be the
// previous step's array when memory did not change: do not mutate it)
export interface StepEvent {
  pc: number; op: number; depth: number;
  stack: bigint[]; memory: Uint8Array;
}
export type FrameEvent =
  | { kind: "enter"; depth: number; address: Hex; codeAddress: Hex;
      caller: Hex; calldata: Uint8Array }
  | { kind: "exit"; returnData: Uint8Array; reverted: boolean };
export interface Handlers {
  step(e: StepEvent): void;
  frame(e: FrameEvent): void;
}
export interface Block { number: bigint; timestamp: bigint; prevrandao: Hex }
export interface TxResult {
  success: boolean; returnData: Uint8Array; gasUsed: bigint;
  created?: Hex;              // a create's new contract
}
export interface Chain {
  fund(address: Hex, balance: bigint): Promise<void>;
  // a create (no `to`) or a call; the transaction ends after it
  send(tx: { from: Hex; to?: Hex; input: Hex; value?: bigint;
    block: Block }, on: Handlers): Promise<TxResult>;
  storage(address: Hex, slot: bigint): Promise<bigint>;
}

const NONE = new Uint8Array();
const lower = (h: string) => h.toLowerCase() as Hex;

export function chain(chainId: bigint): Chain {
  const ex = new Executor({ chainId });
  const trace = (on: Handlers): TraceOptions => ({
    memory: "changed",
    step: (t) => on.step({ pc: t.pc, op: opByte(t.opcode),
      depth: t.depth ?? 0, stack: t.stack, memory: t.memory ?? NONE }),
    frame: (e) => on.frame(e.kind === "enter"
      ? { kind: "enter", depth: e.frame.depth,
        address: lower(e.frame.address),
        codeAddress: lower(e.frame.codeAddress),
        caller: lower(e.frame.caller), calldata: e.frame.calldata }
      : { kind: "exit", returnData: e.returnData, reverted: e.reverted }),
  });
  return {
    fund: (address, balance) => ex.fund(address, balance),
    async send({ from, to, input, value, block }, on) {
      if (to === undefined) {
        const r = await ex.deploy({ from, create: input, value, block },
          trace(on));
        return { success: r.success, returnData: r.returnValue,
          gasUsed: r.gasUsed,
          ...(r.address ? { created: lower(r.address) } : {}) };
      }
      const r = await ex.call({ from, to, input, value, block }, trace(on));
      return { success: r.success, returnData: r.returnValue,
        gasUsed: r.gasUsed };
    },
    storage: (address, slot) => ex.getStorage(slot, address),
  };
}
