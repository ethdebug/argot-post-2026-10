// The runner (addendum §2.1): a scenario's transactions executed with
// one build by @ethdebug/evm, through ./evm (injected: the lazy chunk
// in the browser, the module in Node), recorded per trace step; the
// state at a moment (§2.3); the run's digest (§2.4)
import type { Chain, Handlers, TxResult } from "./evm";
import type { Hex, Snapshot } from "../types";
import type {
  BuildId, Frame, Journal, MomentRef, Run, Scenario, TxRun,
} from "./types";
import { blockOf } from "./scenario";
import { inputOf } from "./abi";
import { opByte } from "./opcodes";
import { storageAt } from "./journal";

type EvmModule = typeof import("./evm");
// a Run as data: what a worker posts (stateAt is rebuilt from it)
export type RunData = Omit<Run, "stateAt">;

const SLOAD = opByte("SLOAD");
const SSTORE = opByte("SSTORE");
const TSTORE = opByte("TSTORE");
const KECCAK256 = opByte("KECCAK256");
const ZERO: Hex = `0x${"0".repeat(64)}`;

const word = (n: bigint): Hex => `0x${n.toString(16).padStart(64, "0")}`;
const hexOf = (b: Uint8Array): Hex => `0x${[...b].map((x) =>
  x.toString(16).padStart(2, "0")).join("")}`;

// KECCAK256's input (memory, zero past its end), in words
function words(memory: Uint8Array, offset: number, size: number): Hex[] {
  const bytes = new Uint8Array(size);
  bytes.set(memory.subarray(offset, Math.min(offset + size,
    memory.length)));
  const out: Hex[] = [];
  for (let k = 0; k < size; k += 32) out.push(hexOf(bytes.slice(k, k + 32)));
  return out;
}

// One transaction's recording: the trace handlers, then its TxRun
function recorder() {
  const pc: number[] = [], op: number[] = [], depth: number[] = [];
  const frame: number[] = [], stack: bigint[][] = [];
  const memory: Uint8Array[] = [];
  const frames: Frame[] = [], open: number[] = [];
  const storage: Journal = [], transient: Journal = [];
  const touched = new Set<Hex>();
  const keccakInputs: Hex[][] = [];
  const on: Handlers = {
    frame(e) {
      if (e.kind === "enter") {
        const { kind: _, ...f } = e;
        open.push(frames.length);
        frames.push({ ...f, first: pc.length, last: pc.length - 1,
          reverted: false });
        return;
      }
      const f = frames[open.pop()!];
      f.last = pc.length - 1;
      f.returnData = e.returnData;
      f.reverted = e.reverted;
    },
    step(t) {
      const i = pc.length;
      const b = t.op;
      const f = open[open.length - 1];
      const top = (k: number) => t.stack[t.stack.length - 1 - k];
      pc.push(t.pc);
      op.push(b);
      depth.push(t.depth);
      frame.push(f);
      stack.push(t.stack);
      memory.push(t.memory);
      // (the slots of the transaction's own address: its first frame's)
      const own = frames[f].address === frames[0].address;
      if (b === SSTORE || b === TSTORE) {
        (b === SSTORE ? storage : transient).push({ step: i, frame: f,
          slot: word(top(0)), value: word(top(1)) });
      }
      if ((b === SSTORE || b === SLOAD) && own) touched.add(word(top(0)));
      if (b === KECCAK256) {
        keccakInputs.push(words(t.memory, Number(top(0)),
          Number(top(1))));
      }
    },
  };
  const done = (label: string, from: Hex, input: Hex,
    r: TxResult): TxRun => ({
    label, from, input,
    result: { success: r.success, returnData: hexOf(r.returnData),
      gasUsed: r.gasUsed },
    steps: pc.length,
    pc: Int32Array.from(pc), op: Uint8Array.from(op),
    depth: Uint8Array.from(depth), frame: Uint16Array.from(frame),
    frames, stack, memory, storage, transient, touched, keccakInputs,
  });
  return { on, done };
}

// (`on`: the chain to run on, for a test that reads its state after)
export async function runScenario(s: Scenario, build: BuildId,
  evm: EvmModule, on?: Chain): Promise<Run> {
  const b = s.builds[build];
  if (!b) throw new Error(`scenario ${s.id} has no build ${build}`);
  const ch = on ?? evm.chain(s.chain.chainId);
  for (const a of s.accounts) await ch.fund(a.address, a.balance);
  const addressOf = new Map(s.accounts.map((a) => [a.name, a.address]));
  let address: Hex | undefined;
  const txs: TxRun[] = [];
  for (const [k, t] of s.transactions.entries()) {
    const { number, timestamp, prevrandao } = blockOf(s, k);
    const block = { number, timestamp, prevrandao };
    const from = addressOf.get(t.from)!;
    const r = recorder();
    if (t.kind === "create") {
      const x = await ch.send({ from, input: b.create, value: t.value,
        block }, r.on);
      if (!x.created) throw new Error(`${t.label}: no contract created`);
      address = x.created;
      txs.push(r.done(t.label, from, b.create, x));
      continue;
    }
    if (!address) throw new Error(`${t.label}: no contract yet`);
    const input = inputOf(t);
    txs.push(r.done(t.label, from, input, await ch.send({ from, to: address,
      input, value: t.value, block }, r.on)));
  }
  if (!address) throw new Error(`scenario ${s.id} creates no contract`);
  return runOf({ scenario: s.id, build, address, txs });
}

// a Run from its data
export const runOf = (d: RunData): Run =>
  ({ ...d, stateAt: stateOf(d.address, d.txs) });

// Run.stateAt (§2.3), from the recorded transactions: storage = the
// slots the transactions up to this one touch (all of this one's), each
// as it is at the moment; at "end", storage only, committed (transient
// storage cleared)
export function stateOf(address: Hex, txs: TxRun[]):
  (m: MomentRef) => Snapshot {
  const own = txs.map((t) =>
    t.storage.filter((w) => t.frames[w.frame].address === address));
  const slots: Hex[][] = [];
  txs.forEach((t, k) => slots.push([...new Set([...(slots[k - 1] ?? []),
    ...t.touched])]));
  const ends: Map<Hex, Hex>[] = [];
  const end = (k: number): ReadonlyMap<Hex, Hex> => {
    if (k < 0) return new Map();
    return ends[k] ??= storageAt(own[k], txs[k].frames, txs[k].steps,
      end(k - 1));
  };
  return ({ tx, step }) => {
    const t = txs[tx];
    if (!t) throw new Error(`no transaction ${tx}`);
    if (step !== "end" && !(step >= 0 && step < t.steps)) {
      throw new Error(`no trace step ${step} in transaction ${tx}`);
    }
    const at = storageAt(own[tx], t.frames, step === "end" ? t.steps : step,
      end(tx - 1));
    const storage = new Map(slots[tx].map((s) => [s, at.get(s) ?? ZERO]));
    if (step === "end") return { storage, transient: new Map() };
    return {
      storage,
      memory: t.memory[step],
      stack: t.stack[step].map(word),
      calldata: t.frames[t.frame[step]].calldata,
      transient: storageAt(t.transient.filter((w) =>
        t.frames[w.frame].address === address), t.frames, step, new Map()),
    };
  };
}

// sha-256 (hex) over every transaction's pc, op, stack, memory and
// journals: equal digests, equal traces (§2.4)
export async function digest(run: Run): Promise<string> {
  const parts: Uint8Array[] = [];
  const text = new TextEncoder();
  const put = (s: string) => parts.push(text.encode(s));
  for (const t of run.txs) {
    put(`tx ${t.steps}\n`);
    parts.push(new Uint8Array(t.pc.buffer, t.pc.byteOffset, t.pc.byteLength),
      t.op);
    for (let i = 0; i < t.steps; i++) {
      put(`${t.stack[i].map((v) => v.toString(16)).join(",")}\n`);
      // (memory: its bytes when they changed, else a mark)
      if (i > 0 && t.memory[i] === t.memory[i - 1]) put("=");
      else {
        put(`m${t.memory[i].length}`);
        parts.push(t.memory[i]);
      }
    }
    for (const [name, j] of [["s", t.storage], ["t", t.transient]] as const) {
      for (const w of j) put(`${name}${w.step},${w.frame},${w.slot},${
        w.value}\n`);
    }
  }
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return hexOf(new Uint8Array(await crypto.subtle.digest("SHA-256", all)))
    .slice(2);
}
