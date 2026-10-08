// fixtures/raw.json (demos/inspector/bin/make-raw-fixture.mjs): one
// frozen moment of Arcade's story, inside carol's join, while her name
// is being written to storage: the contract's whole storage, memory, the
// stack and the call's calldata at that step. A Timeline of one point,
// and a Compilation with no variables: the raw lens's bytes, with no
// names (a decoding of it finds nothing to own them).
import type { Compilation, Hex, Timeline } from "../types";

export const RAW = "raw";

interface RawJson {
  summary: string;
  contract: { name: string; file: string; compiler: string; address: Hex };
  tx: { hash: Hex; input: Hex };
  step: { index: number; of: number; pc: number; op: string;
    range?: { offset: number; length: number } };
  stack: Hex[];                 // top last
  memory: Hex; calldata: Hex;
  storage: Record<Hex, Hex>;
}

const bytesOf = (h: Hex) => Uint8Array.from((h.slice(2).match(/../g) ?? [])
  .map((b) => parseInt(b, 16)));

export function fromRaw(json: unknown): { compilation: Compilation;
  timeline: Timeline } {
  const r = json as RawJson;
  return {
    compilation: { id: RAW, language: "solidity",
      compiler: r.contract.compiler, provenance: "compiler", sources: [],
      types: {}, templates: {}, stateVariables: [] },
    timeline: { id: RAW, contract: { address: r.contract.address,
      compilation: RAW }, bookmarks: [], points: [{
      id: RAW, label: r.summary,
      at: { tx: r.tx.hash, step: r.step.index },
      snapshot: { storage: new Map(Object.entries(r.storage) as [Hex, Hex][]),
        memory: bytesOf(r.memory), stack: r.stack,
        calldata: bytesOf(r.calldata) },
      paused: { step: r.step.index, op: r.step.op, of: r.step.of,
        ...(r.step.range ? { range: { source: r.contract.file,
          ...r.step.range } } : {}) },
    }] },
  };
}
