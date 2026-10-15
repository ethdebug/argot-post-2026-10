// A scene's moments and the state at each (addendum §3): from a run
// (authoring: every trace step there is; source-run.ts, never on the
// reader's path) or from a snapshot file (the reader: the scene's
// moments only). The one seam between the modes.
import type {
  Compilation, Decoding, Hex, Snapshot, SourceFile, SourceRange,
  TimelinePoint, TxFacts,
} from "./types";
import type { Build, Format, Moment } from "./run/types";
import { order, pointOf, sceneOf, type Scene } from "./scene";
import { momentPoint } from "./moment";

export interface BuildSlice {     // a Build cut down to what a scene needs
  // (every compilation the scene's decodings read, and the decodings;
  // the addendum's one `compilation` is a list: the Vyper scene reads
  // solc's rule and Vyper's own)
  compilations: Compilation[];
  decodings: Decoding[];
  instructions: Record<number, Format.Program.Instruction>;   // pcs
  // (a replay's: its runtime program's every instruction, "offset
  // MNEMONIC args…" a line; ui/Instructions.tsx)
  listing?: string;
  sources?: SourceFile[];
}
export interface SceneSnapshot {  // snapshots/<scene>.json
  scene: Scene;                   // with annotations filled
  build: BuildSlice;
  states: Snapshot[];             // one per moment, same order
  facts: (TxFacts | null)[];      // per moment
  // (the run's transactions: the timeline bar's track)
  txs: TxBrief[];
  digest: string;                 // the run's (run.ts digest)
}
export interface TxBrief { label: string; steps: number }
export interface MomentSource {
  moments: Moment[];
  // a moment, annotated (a run's "all": as it is visited), and the last
  // source range at or before it in its transaction (none: none yet)
  moment(i: number): Moment;
  last(i: number): SourceRange | undefined;
  state(i: number): Promise<Snapshot>;
  facts(i: number): TxFacts | null;
  // the run's transactions, each its label and trace step count
  txs: TxBrief[];
  // (a run's: the stack's greatest depth over the moment's transaction;
  // the debugger reserves it)
  peak?(i: number): number;
  build: Build | BuildSlice;
  digest(): Promise<string>;
}

export function fromSnapshot(file: SceneSnapshot): MomentSource {
  return {
    moments: file.scene.timeline, build: file.build,
    moment: (i) => file.scene.timeline[i],
    // (a snapshot's moments: their own ranges)
    last: (i) => file.scene.timeline[i]?.range,
    state: async (i) => file.states[i],
    facts: (i) => file.facts[i],
    txs: file.txs,
    digest: async () => file.digest,
  };
}

// A scene's points, as the engine's Timeline points (decode, layout and
// the views read these): each moment's state and facts, its label
export async function pointsOf(scene: string, src: MomentSource):
  Promise<TimelinePoint[]> {
  return Promise.all(src.moments.map(async (_, i) =>
    pointAt(pointOf(scene, i), src, i)));
}

// One moment as a point (engine/moment.ts momentPoint): its state, its
// facts, its locals and its range (or the last one before it, muted).
// (`all`: every variable its context lists, the storage ones too: the
// debugger's scope)
export async function pointAt(id: string, src: MomentSource, i: number,
  all = false): Promise<TimelinePoint> {
  const b = src.build as Build;
  return momentPoint(id, src.moment(i), await src.state(i), {
    ...b.programs && !all ? { build: b } : {},
    ...src.facts(i) ? { transaction: src.facts(i)! } : {},
    last: src.last(i) });
}

// ------------------------------------------------- the file

// A replay holds every trace step, each mostly its step before's, so the
// file holds each state, and each moment's facts, as its changes from
// the moment before's, and each distinct ethdebug context once (a table
// the timeline and the instructions share): gzip's window spans only a
// few whole moments. The reader rebuilds every moment whole on load.

const hexOf = (b: Uint8Array): Hex => `0x${[...b].map((x) =>
  x.toString(16).padStart(2, "0")).join("")}`;
const bytesOf = (h: string) => Uint8Array.from(
  (h.slice(2).match(/../g) ?? []).map((b) => parseInt(b, 16)));
const bySlot = (a: string, b: string) => (BigInt(a) < BigInt(b) ? -1 : 1);
const sorted = (m: ReadonlyMap<Hex, Hex>) =>
  Object.fromEntries([...m].sort(([a], [b]) => bySlot(a, b)));

type Json = Record<string, any>;
type Words = Record<string, string>;
// (a state as JSON, whole: maps as objects (slots in order), bytes as
// 0x hex)
interface Whole {
  storage: Words; memory?: string; stack?: string[]; calldata?: string;
  transient?: Words;
}
const EMPTY: Whole = { storage: {} };

// a map's changes: each slot set, or null if gone
function wordsDiff(a: Words = {}, b: Words = {}): Words | undefined {
  const d: Json = {};
  for (const k in b) if (a[k] !== b[k]) d[k] = b[k];
  for (const k in a) if (!(k in b)) d[k] = null;
  return Object.keys(d).length ? d : undefined;
}
function wordsApply(a: Words = {}, d: Json): Words {
  const o: Json = { ...a, ...d };
  return Object.fromEntries(Object.keys(o).filter((k) => o[k] !== null)
    .sort(bySlot).map((k) => [k, o[k]]));
}
// bytes' changes: the length, and each 32-byte word that differs from
// the bytes before (zeros past their end), by its index
const W = 64;
function bytesDiff(a = "0x", b: string): [number, Words] {
  const words: Words = {};
  for (let o = 2; o < b.length; o += W) {
    const w = b.slice(o, o + W);
    if (w !== a.slice(o, o + W).padEnd(w.length, "0")) words[(o - 2) / W] = w;
  }
  return [(b.length - 2) / 2, words];
}
function bytesApply(a = "0x", [n, words]: [number, Words]): string {
  let h = a.slice(0, 2 + 2 * n).padEnd(2 + 2 * n, "0");
  for (const [k, w] of Object.entries(words)) {
    const o = 2 + W * Number(k);
    h = h.slice(0, o) + w + h.slice(o + w.length);
  }
  return h;
}

// a state's changes from the one before: a field left out is the same,
// null is gone; the stack as [items popped, ...items pushed]
function stateDiff(a: Whole, b: Whole): Json {
  const d: Json = {};
  const storage = wordsDiff(a.storage, b.storage);
  if (storage) d.storage = storage;
  const transient = wordsDiff(a.transient, b.transient);
  if (transient) d.transient = transient;
  for (const f of ["memory", "calldata"] as const) {
    if (a[f] === b[f]) continue;
    d[f] = b[f] === undefined ? null : bytesDiff(a[f], b[f]);
  }
  if (JSON.stringify(a.stack) !== JSON.stringify(b.stack)) {
    if (!b.stack) d.stack = null;
    else {
      const s = a.stack ?? [];
      let j = 0;
      while (j < s.length && j < b.stack.length && s[j] === b.stack[j]) j++;
      d.stack = [s.length - j, ...b.stack.slice(j)];
    }
  }
  return d;
}
function stateApply(a: Whole, d: Json): Whole {
  const b: Whole = { storage: d.storage ? wordsApply(a.storage, d.storage)
    : a.storage };
  for (const f of ["memory", "calldata"] as const) {
    const v = f in d ? d[f] && bytesApply(a[f], d[f]) : a[f];
    if (v !== null && v !== undefined) b[f] = v;
  }
  const stack = "stack" in d ? d.stack && [...(a.stack ?? [])
    .slice(0, (a.stack?.length ?? 0) - d.stack[0]), ...d.stack.slice(1)]
    : a.stack;
  if (stack) b.stack = stack;
  const transient = d.transient ? wordsApply(a.transient, d.transient)
    : a.transient;
  if (transient && Object.keys(transient).length) b.transient = transient;
  return b;
}

// a moment's facts' changes from the last facts before it: its fields
// that differ, the KECCAK256 inputs as [how many of the last's it
// keeps, ...those it adds], and "-": fields gone
function factsDiff(a: Json, b: Json): Json {
  const d: Json = {};
  const same = (x: unknown, y: unknown) =>
    JSON.stringify(x) === JSON.stringify(y);
  for (const k in b) {
    if (k === "keccakInputs" && Array.isArray(a[k])) {
      let j = 0;
      while (j < a[k].length && j < b[k].length && same(a[k][j], b[k][j])) j++;
      if (j !== a[k].length || j !== b[k].length) {
        d[k] = [j, ...b[k].slice(j)];
      }
    } else if (!same(a[k], b[k])) d[k] = b[k];
  }
  const gone = Object.keys(a).filter((k) => !(k in b));
  if (gone.length) d["-"] = gone;
  return d;
}
function factsApply(a: Json, d: Json): Json {
  const b: Json = { ...a };
  for (const [k, v] of Object.entries(d)) {
    if (k === "-") continue;
    b[k] = k === "keccakInputs" && Array.isArray(a[k])
      ? [...a[k].slice(0, v[0]), ...v.slice(1)] : v;
  }
  for (const k of d["-"] ?? []) delete b[k];
  return b;
}

// as JSON: each distinct context once, in `contexts`, and in its place
// its index; each state and facts as their changes (above)
export function snapshotJson(f: SceneSnapshot): unknown {
  const ids = new Map<string, number>();
  const contexts: unknown[] = [];
  const id = (c: unknown) => {
    const k = JSON.stringify(c);
    if (!ids.has(k)) ids.set(k, contexts.push(c) - 1);
    return ids.get(k)!;
  };
  const indexed = <T extends { context?: unknown }>(x: T) =>
    x.context === undefined ? x : { ...x, context: id(x.context) };
  let state = EMPTY;
  let facts: Json = {};
  return {
    ...f,
    scene: { ...f.scene, timeline: f.scene.timeline.map(indexed) },
    build: { ...f.build, instructions: Object.fromEntries(Object.entries(
      f.build.instructions).map(([pc, x]) => [pc, indexed(x)])) },
    contexts,
    states: f.states.map((s) => {
      const whole: Whole = {
        storage: sorted(s.storage),
        ...(s.memory ? { memory: hexOf(s.memory) } : {}),
        ...(s.stack ? { stack: s.stack } : {}),
        ...(s.calldata ? { calldata: hexOf(s.calldata) } : {}),
        ...(s.transient?.size ? { transient: sorted(s.transient) } : {}),
      };
      const d = stateDiff(state, whole);
      state = whole;
      return d;
    }),
    facts: f.facts.map((x) => {
      if (!x) return null;
      const whole = { ...x, reads: [...x.reads].sort(),
        writes: [...x.writes].sort() };
      const d = factsDiff(facts, whole);
      facts = whole;
      return d;
    }),
  };
}

export function snapshotOf(json: unknown): SceneSnapshot {
  const j = json as Json;
  if (!j?.scene || !Array.isArray(j.states) || typeof j.digest !== "string"
    || !j.build?.compilations || !Array.isArray(j.contexts)) {
    throw new Error("not a scene snapshot");
  }
  const context = <T extends Json>(x: T): T =>
    typeof x.context === "number"
      ? { ...x, context: j.contexts[x.context] } : x;
  const timeline = j.scene.timeline.map(context);
  // (its scene, less the annotations, is a scene file's)
  const bare = sceneOf({ ...j.scene, timeline: timeline.map(
    ({ tx, step, label }: Json) => ({ tx, step,
      ...(label !== undefined ? { label } : {}) })) });
  if (j.states.length !== bare.timeline.length ||
    j.facts.length !== bare.timeline.length) {
    throw new Error(`snapshot ${bare.id}: one state a moment`);
  }
  timeline.forEach((m: Json, k: number) => {
    if (k && order(timeline[k - 1]) >= order(m as never)) {
      throw new Error(`snapshot ${bare.id}: moments out of order`);
    }
  });
  const map = (o?: Record<string, string>) =>
    new Map(Object.entries(o ?? {}) as [Hex, Hex][]);
  let state = EMPTY;
  let facts: Json = {};
  return {
    scene: { ...bare, timeline },
    build: { ...j.build, instructions: Object.fromEntries(Object.entries(
      j.build.instructions as Json).map(([pc, x]) => [pc, context(x)])) },
    states: j.states.map((d: Json): Snapshot => {
      const s = state = stateApply(state, d);
      return {
        storage: map(s.storage),
        ...(s.memory ? { memory: bytesOf(s.memory) } : {}),
        ...(s.stack ? { stack: s.stack as Hex[] } : {}),
        ...(s.calldata ? { calldata: bytesOf(s.calldata) } : {}),
        transient: map(s.transient),
      };
    }),
    facts: j.facts.map((d: Json | null) => {
      if (!d) return null;
      const x = facts = factsApply(facts, d);
      return { ...x, reads: new Set(x.reads), writes: new Set(x.writes) };
    }),
    txs: Array.isArray(j.txs) ? j.txs : [],
    digest: j.digest,
  };
}
