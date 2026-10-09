// A transaction's facts (spec §1.2), derived from its run: the slots it
// read and wrote (its own address's), its KECCAK256 inputs
import type { Hex, TxFacts } from "../types";
import type { Run } from "./types";
import { opByte } from "./opcodes";

const SLOAD = opByte("SLOAD");
const SSTORE = opByte("SSTORE");
const word = (n: bigint): Hex => `0x${n.toString(16).padStart(64, "0")}`;

export function factsOf(run: Run, tx: number): TxFacts {
  const t = run.txs[tx];
  if (!t) throw new Error(`no transaction ${tx}`);
  const reads = new Set<Hex>();
  const writes = new Set<Hex>();
  for (let i = 0; i < t.steps; i++) {
    const op = t.op[i];
    if (op !== SLOAD && op !== SSTORE) continue;
    if (t.frames[t.frame[i]].address !== run.address) continue;
    (op === SLOAD ? reads : writes).add(word(t.stack[i].at(-1)!));
  }
  return { from: t.from, to: run.address, input: t.input, reads, writes,
    keccakInputs: t.keccakInputs };
}
