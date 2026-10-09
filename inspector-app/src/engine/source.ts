// A scene's moments and the state at each (addendum §3): from a run
// (authoring: every trace step there is; source-run.ts, never on the
// reader's path) or from a snapshot file (the reader: the scene's
// moments only). The one seam between the modes.
import type {
  Compilation, Decoding, Hex, Snapshot, SourceFile, TimelinePoint, TxFacts,
} from "./types";
import type { Build, Format, Moment } from "./run/types";
import { order, pointOf, sceneOf, type Scene } from "./scene";

export interface BuildSlice {     // a Build cut down to what a scene needs
  // (every compilation the scene's decodings read, and the decodings;
  // the addendum's one `compilation` is a list: the Vyper scene reads
  // solc's rule and Vyper's own)
  compilations: Compilation[];
  decodings: Decoding[];
  instructions: Record<number, Format.Program.Instruction>;   // pcs
  sources?: SourceFile[];
}
export interface SceneSnapshot {  // snapshots/<scene>.json
  scene: Scene;                   // with annotations filled
  build: BuildSlice;
  states: Snapshot[];             // one per moment, same order
  facts: (TxFacts | null)[];      // per moment
  digest: string;                 // the run's (run.ts digest)
}
export interface MomentSource {
  moments: Moment[];
  state(i: number): Promise<Snapshot>;
  facts(i: number): TxFacts | null;
  build: Build | BuildSlice;
  digest(): Promise<string>;
}

export function fromSnapshot(file: SceneSnapshot): MomentSource {
  return {
    moments: file.scene.timeline, build: file.build,
    state: async (i) => file.states[i],
    facts: (i) => file.facts[i],
    digest: async () => file.digest,
  };
}

// A scene's points, as the engine's Timeline points (decode, layout and
// the views read these): each moment's state and facts, its label
export async function pointsOf(scene: string, src: MomentSource):
  Promise<TimelinePoint[]> {
  return Promise.all(src.moments.map(async (m, i) => ({
    id: pointOf(scene, i), label: m.label ?? "",
    at: { tx: m.tx, step: m.step }, snapshot: await src.state(i),
    transaction: src.facts(i) ?? undefined })));
}

// ------------------------------------------------- the file

const hexOf = (b: Uint8Array): Hex => `0x${[...b].map((x) =>
  x.toString(16).padStart(2, "0")).join("")}`;
const bytesOf = (h: string) => Uint8Array.from(
  (h.slice(2).match(/../g) ?? []).map((b) => parseInt(b, 16)));
const sorted = (m: ReadonlyMap<Hex, Hex>) => Object.fromEntries([...m]
  .sort(([a], [b]) => (BigInt(a) < BigInt(b) ? -1 : 1)));

// as JSON: maps as objects (slots in order), bytes as 0x hex, sets as
// arrays
export function snapshotJson(f: SceneSnapshot): unknown {
  return {
    ...f,
    states: f.states.map((s) => ({
      storage: sorted(s.storage),
      ...(s.memory ? { memory: hexOf(s.memory) } : {}),
      ...(s.stack ? { stack: s.stack } : {}),
      ...(s.calldata ? { calldata: hexOf(s.calldata) } : {}),
      ...(s.transient?.size ? { transient: sorted(s.transient) } : {}),
    })),
    facts: f.facts.map((x) => x && { ...x, reads: [...x.reads].sort(),
      writes: [...x.writes].sort() }),
  };
}

type Json = Record<string, any>;
export function snapshotOf(json: unknown): SceneSnapshot {
  const j = json as Json;
  if (!j?.scene || !Array.isArray(j.states) || typeof j.digest !== "string"
    || !j.build?.compilations) {
    throw new Error("not a scene snapshot");
  }
  // (its scene, less the annotations, is a scene file's)
  const bare = sceneOf({ ...j.scene, timeline: j.scene.timeline.map(
    ({ tx, step, label }: Json) => ({ tx, step,
      ...(label !== undefined ? { label } : {}) })) });
  if (j.states.length !== bare.timeline.length ||
    j.facts.length !== bare.timeline.length) {
    throw new Error(`snapshot ${bare.id}: one state a moment`);
  }
  j.scene.timeline.forEach((m: Json, k: number) => {
    if (k && order(j.scene.timeline[k - 1]) >= order(m as never)) {
      throw new Error(`snapshot ${bare.id}: moments out of order`);
    }
  });
  const map = (o?: Record<string, string>) =>
    new Map(Object.entries(o ?? {}) as [Hex, Hex][]);
  return {
    scene: { ...bare, timeline: j.scene.timeline },
    build: j.build,
    states: j.states.map((s: Json): Snapshot => ({
      storage: map(s.storage),
      ...(s.memory ? { memory: bytesOf(s.memory) } : {}),
      ...(s.stack ? { stack: s.stack } : {}),
      ...(s.calldata ? { calldata: bytesOf(s.calldata) } : {}),
      transient: map(s.transient),
    })),
    facts: j.facts.map((x: Json | null) => x && { ...x,
      reads: new Set(x.reads), writes: new Set(x.writes) }),
    digest: j.digest,
  };
}
