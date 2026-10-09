// A source over a run (authoring, and the snapshot build), and a
// scene's snapshot file made from one: the run's half of source.ts
import type {
  Compilation, Decoding, Hex, SourceRange, TxFacts,
} from "./types";
import type { Build, Moment, Run, Timeline } from "./run/types";
import type { Scene } from "./scene";
import type { BuildSlice, MomentSource, SceneSnapshot } from "./source";
import { annotator } from "./run/annotate";
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
// hashed with their slots, up to the moment: the transactions before it
// whole, and its own up to its step; one per KECCAK256 step, in order)
const KECCAK256 = 0x20;
function keccaks(run: Run, m: Moment): Hex[][] {
  const seen = new Set<string>();
  const upTo = (k: number) => {
    const t = run.txs[k];
    if (k < m.tx || m.step === "end") return t.keccakInputs;
    let n = 0;
    for (let i = 0; i < m.step && i < t.steps; i++) {
      if (t.op[i] === KECCAK256) n++;
    }
    return t.keccakInputs.slice(0, n);
  };
  return run.txs.slice(0, m.tx + 1).flatMap((_, k) => upTo(k))
    .filter((ws) => ws.length > 1 && !seen.has(ws.join()) &&
      !!seen.add(ws.join()));
}

// The facts of a moment's transaction (its reads and writes), with the
// mapping keys the run hashed up to it (keys from the trace)
const factsAt = (run: Run, m: Moment): TxFacts =>
  ({ ...factsOf(run, m.tx), keccakInputs: keccaks(run, m) });

// `t`: a scene's timeline (annotated here), or "all": every trace step
// of every transaction and each one's end (bare: annotated as they are
// visited)
// each transaction's greatest stack depth (once a run)
const peakOf = new WeakMap<Run, number[]>();
const peaks = (run: Run) => {
  if (!peakOf.has(run)) {
    peakOf.set(run, run.txs.map((t) => t.stack.reduce((m, s) =>
      Math.max(m, s.length), 0)));
  }
  return peakOf.get(run)!;
};

export function fromRun(run: Run, build: Build, t: Timeline | "all"):
  MomentSource {
  const at = annotator(run, build);
  const moments = t === "all"
    ? run.txs.flatMap((x, tx): Moment[] => [...Array.from({ length:
      x.steps }, (_, step) => ({ tx, step })), { tx, step: "end" }])
    : t.map((m) => at(m));
  // (each index's last range, found once: scanning back through its
  // transaction's trace steps)
  const lasts = new Map<number, SourceRange | undefined>();
  const last = (i: number): SourceRange | undefined => {
    if (lasts.has(i)) return lasts.get(i);
    const m = moments[i];
    if (m.step === "end") return undefined;
    let r = (m.range !== undefined || m.pc !== undefined ? m : at(m)).range;
    if (!r && m.step > 0) {
      // (the trace step before it, in "all"; else annotated afresh)
      const j = i > 0 && moments[i - 1].tx === m.tx &&
        moments[i - 1].step === m.step - 1 ? i - 1 : -1;
      r = j >= 0 ? last(j) : lastStep(m.tx, m.step - 1);
    }
    lasts.set(i, r);
    return r;
  };
  const lastStep = (tx: number, step: number): SourceRange | undefined => {
    for (let k = step; k >= 0; k--) {
      const r = at({ tx, step: k }).range;
      if (r) return r;
    }
    return undefined;
  };
  return {
    moments, build,
    moment: (i) => moments[i].pc !== undefined || moments[i].step === "end"
      ? moments[i] : at(moments[i]),
    last,
    async state(i) {
      const s = run.stateAt(moments[i]);
      return { ...s, storage: new RunStorage(s.storage) };
    },
    facts: (i) => factsAt(run, moments[i]),
    peak: (i) => peaks(run)[moments[i].tx],
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

