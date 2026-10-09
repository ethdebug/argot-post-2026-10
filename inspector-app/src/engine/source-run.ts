// A source over a run (authoring, and the snapshot build), and a
// scene's snapshot file made from one: the run's half of source.ts
import type {
  Compilation, Decoding, Hex, TxFacts,
} from "./types";
import type { Build, Moment, Run, Timeline } from "./run/types";
import type { Scene } from "./scene";
import type { BuildSlice, MomentSource, SceneSnapshot } from "./source";
import { annotate } from "./run/annotate";
import { factsOf } from "./run/facts";
import { digest } from "./run/run";
import { slotHex } from "./hex";

const ZERO: Hex = `0x${"0".repeat(64)}`;

// A run's storage: every slot of a contract it deployed; a slot no
// transaction wrote is zero (its keys: the slots known so far)
class RunStorage extends Map<Hex, Hex> {
  get(k: Hex): Hex { return super.get(k) ?? ZERO; }
  has(): boolean { return true; }
}

// (the KECCAK256 inputs of more than one word, each once: mapping keys
// hashed with their slots, up to the transaction)
function keccaks(run: Run, tx: number): Hex[][] {
  const seen = new Set<string>();
  return run.txs.slice(0, tx + 1).flatMap((t) => t.keccakInputs)
    .filter((ws) => ws.length > 1 && !seen.has(ws.join()) &&
      !!seen.add(ws.join()));
}

// The facts of a moment's transaction (its reads and writes), with the
// mapping keys the run hashed up to it (keys from the trace)
const factsAt = (run: Run, tx: number): TxFacts =>
  ({ ...factsOf(run, tx), keccakInputs: keccaks(run, tx) });

// `t`: a scene's timeline (annotated here), or "all": every trace step
// of every transaction and each one's end (bare: annotated as they are
// visited)
export function fromRun(run: Run, build: Build, t: Timeline | "all"):
  MomentSource {
  const moments = t === "all"
    ? run.txs.flatMap((x, tx): Moment[] => [...Array.from({ length:
      x.steps }, (_, step) => ({ tx, step })), { tx, step: "end" }])
    : t.map((m) => annotate(run, build, m));
  return {
    moments, build,
    async state(i) {
      const s = run.stateAt(moments[i]);
      return { ...s, storage: new RunStorage(s.storage) };
    },
    facts: (i) => factsAt(run, moments[i].tx),
    digest: () => digest(run),
  };
}

// A scene's snapshot, from a source over its run: its annotated moments,
// and at each, the state its decodings need: the storage slots the run
// touched so far and `slots(i)`, the slots the decodings read (those no
// transaction wrote, as zero; a variable's own slot, read or not)
export async function snapshotFile(scene: Scene, src: MomentSource,
  need: { compilations: Compilation[]; decodings: Decoding[];
    slots(i: number): Promise<Iterable<Hex>>; sources?: boolean }):
  Promise<SceneSnapshot> {
  const states = await Promise.all(src.moments.map(async (_, i) => {
    const s = await src.state(i);
    const keep = new Set<Hex>([...s.storage.keys(),
      ...[...await need.slots(i)].map((h) => slotHex(BigInt(h)))]);
    return { ...s, storage: new Map([...keep].map((k) =>
      [k, s.storage.get(k) ?? ZERO])) };
  }));
  const build = src.build as Build;
  const programs = [build.programs?.runtime, build.programs?.create];
  const instructions: BuildSlice["instructions"] = {};
  for (const m of src.moments) {
    const ins = m.pc === undefined ? undefined : programs.flatMap((p) =>
      p?.instructions ?? []).find((x) => x.offset === m.pc);
    if (ins) instructions[m.pc!] = ins;
  }
  return {
    scene: { ...scene, timeline: src.moments },
    build: { compilations: need.compilations, decodings: need.decodings,
      instructions,
      ...(need.sources !== false ? { sources: build.sources } : {}) },
    states, facts: src.moments.map((_, i) => src.facts(i)),
    digest: await src.digest(),
  };
}

