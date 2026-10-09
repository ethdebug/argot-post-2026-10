// A scene (addendum §1.5): a timeline of moments in one run, the lens
// that draws it, its caption and its reader controls. Scene files are
// data (scenes/<id>.json); their moments carry no annotations (the run
// or the snapshot fills those).
import type {
  Compilation, Decoding, Hex, KeySource, Local, Path, PointId, TimelineId,
} from "./types";
import type {
  BuildId, MomentRef, Scenario, ScenarioId, Timeline,
} from "./run/types";
import { compilationOf } from "./run/build";
import { VY_PLAYERS, vyperRule } from "./fixtures/vyper-rule";
import { slotHex } from "./hex";

export type SceneId = string;
export type LensId = string;
export interface Scene {
  id: SceneId; title: string;
  caption?: string;                // the figcaption (embed) text
  run: { scenario: ScenarioId; build: BuildId };
  lens: LensId;                    // the composition it draws
  timeline: Timeline;              // 1 moment = a static figure
  controls: "none" | "prev-next" | "scrub";   // reader mode (§3)
  initial?: { moment?: number; select?: Path;
              walk?: { step: number; focus?: Hex } };
  // (its storage dumps' rows: "touched" adds the slots the moment's
  // transaction read or wrote, owned by a value or not: unmapped rows)
  rows?: "touched";
  // (its views' roots: the values it is about, the rest not shown)
  roots?: Path[];
  // (named groups of its moments, each shown as one with its own first
  // selection: the memory section's pauses, "O0/mult" its two steps;
  // `scope`, the function its locals are in, a group of the tree)
  groups?: { id: string; title: string; moments: number[];
    select?: Path; scope?: string }[];
  // pointers written by hand for its one moment, to the stack and memory
  // words that mean something there (solc names no locals): each an
  // ethdebug variable, its type inline; dereferenced by the same code as
  // the compiler's, and always shown as hand-written (`<scene>/hand`)
  pointers?: Local[];
}

const CONTROLS = ["none", "prev-next", "scrub"];
const ANNOTATIONS = ["pc", "op", "depth", "range", "context"];

// (tx, step) as one number: "end" after every trace step
export const order = (m: MomentRef) =>
  m.tx * 2 ** 24 + (m.step === "end" ? 2 ** 24 - 1 : m.step);

export function sceneOf(json: unknown): Scene {
  const j = json as Partial<Scene> & Record<string, unknown>;
  const no = (what: string): never => {
    throw new Error(`scene ${j.id ?? "?"}: ${what}`);
  };
  for (const k of ["id", "title", "lens"] as const) {
    if (typeof j[k] !== "string") no(`no ${k}`);
  }
  if (typeof j.run?.scenario !== "string" ||
    typeof j.run?.build !== "string") no("no run");
  if (!CONTROLS.includes(j.controls as string)) {
    no(`controls ${j.controls}`);
  }
  if (!Array.isArray(j.timeline) || !j.timeline.length) no("no moment");
  const timeline = j.timeline!.map((m) => {
    if (!Number.isInteger(m.tx) || m.tx < 0) no(`tx ${m.tx}`);
    if (m.step !== "end" && !(Number.isInteger(m.step) && m.step >= 0)) {
      no(`step ${m.step}`);
    }
    const hand = ANNOTATIONS.find((k) => k in m);
    if (hand) no(`${hand} is filled from the run, not written`);
    return { tx: m.tx, step: m.step,
      ...(m.label !== undefined ? { label: m.label } : {}) };
  });
  timeline.forEach((m, k) => {
    if (k && order(timeline[k - 1]) >= order(m)) no("moments out of order");
  });
  if (j.rows !== undefined && j.rows !== "touched") no(`rows ${j.rows}`);
  for (const g of j.groups ?? []) {
    if (!g.moments.every((k) => k >= 0 && k < timeline.length)) {
      no(`group ${g.id}'s moments`);
    }
  }
  if (j.pointers !== undefined) {
    if (!Array.isArray(j.pointers) || timeline.length !== 1) {
      no("pointers: a list, for a scene of one moment");
    }
    for (const v of j.pointers!) {
      if (typeof v?.identifier !== "string" || typeof v.type !== "object" ||
        typeof v.pointer !== "object") no(`pointer ${v?.identifier}`);
    }
  }
  const n = j.initial?.moment;
  if (n !== undefined && !(n >= 0 && n < timeline.length)) {
    no(`initial moment ${n}`);
  }
  return { ...(j as Scene), timeline };
}

// ------------------------------------------------- a scene's decodings

// a scene's points, as the engine's timelines name them
export const timelineOf = (scene: SceneId): TimelineId => `scene:${scene}`;
// (a scene timeline's scene; none for another timeline: a run's)
export const sceneOfTimeline = (t: TimelineId): SceneId | undefined =>
  t.startsWith("scene:") ? t.slice("scene:".length) : undefined;
export const pointOf = (scene: SceneId, moment: number): PointId =>
  `${scene}:${moment}`;

// where each scenario's mapping keys are listed (Arcade: playerList
// lists players' keys; a mapping cannot list them)
const KEYS: Record<ScenarioId, KeySource> = {
  arcade: { from: "list", path: "playerList" },
};

// What the page knows of a build before it loads it (builds.json,
// written with the builds)
export interface BuildInfo { language: string; compiler: string;
  compilation: string; ethdebug: boolean }
// (solc's rule for players, read over another compiler's storage)
const PLAYERS = "arcade-sol-players";

// The decodings a scene's lens reads: the build's own rule over its
// state; for a build with no ethdebug (Vyper), solc's rule for players
// over its storage (keys from the run's hashes of Vyper's slot), and
// Vyper's own layout, written by hand, beside it (`<scene>/rule`). The
// first is the scene's, its id the scene's.
export function decodingsOf(scene: Scene,
  builds: Record<BuildId, BuildInfo>): Decoding[] {
  const timeline = timelineOf(scene.id);
  const b = builds[scene.run.build];
  if (!b) throw new Error(`scene ${scene.id}: no build ${scene.run.build}`);
  const keys = KEYS[scene.run.scenario] ?? { from: "trace" };
  if (b.ethdebug) {
    return [{ id: scene.id, compilation: b.compilation, timeline,
      variables: "state", keys },
    // (its hand-written pointers, read with the same compilation)
    ...scene.pointers ? [{ id: handOf(scene.id), compilation:
      b.compilation, timeline, variables: "locals" as const, keys,
      locals: scene.pointers, provenance: "hand-written" as const }] : []];
  }
  if (b.language !== "vyper") {
    throw new Error(`scene ${scene.id}: no rule for ${b.language}`);
  }
  const rule = `${scene.id}/rule`;
  return [
    { id: scene.id, compilation: PLAYERS, timeline, variables: "state",
      keys: { from: "trace", slot: slotHex(BigInt(VY_PLAYERS)) },
      foreign: { language: "vyper", rule } },
    { id: rule, compilation: b.compilation, timeline, variables: "state",
      keys: { from: "trace" } }];
}

// a scene's decoding of its hand-written pointers
export const handOf = (scene: SceneId) => `${scene}/hand`;

// … and the compilations they read, from the scenario's builds
export function compilationsOf(scene: Scene, s: Scenario): Compilation[] {
  const b = s.builds[scene.run.build];
  if (b.programs) return [compilationOf(b)];
  const sol = Object.values(s.builds).find((x) => x.language ===
    "solidity" && x.programs)!;
  return [compilationOf(sol, { id: PLAYERS, only: ["players"] }),
    { ...vyperRule({ compiler: b.compiler, base: VY_PLAYERS }),
      id: b.compilation }];
}

// ------------------------------------------------- authoring: pins

const same = (a: MomentRef, b: MomentRef) => a.tx === b.tx &&
  a.step === b.step;

// A scene with a moment pinned (in order; a moment pinned again takes
// the new label); its first moment shown stays the one it was
export function pin(s: Scene, ref: MomentRef, label?: string): Scene {
  const m = { tx: ref.tx, step: ref.step,
    ...(label ? { label } : {}) };
  const kept = s.timeline.filter((x) => !same(x, m));
  const timeline = [...kept, m].sort((a, b) => order(a) - order(b))
    .map((x) => ({ tx: x.tx, step: x.step,
      ...(x.label !== undefined ? { label: x.label } : {}) }));
  return withTimeline(s, timeline);
}

// … and one unpinned (a scene keeps one moment at least)
export function unpin(s: Scene, i: number): Scene {
  if (s.timeline.length <= 1) return s;
  return withTimeline(s, s.timeline.filter((_, k) => k !== i));
}

function withTimeline(s: Scene, timeline: Scene["timeline"]): Scene {
  const was = s.timeline[s.initial?.moment ?? 0];
  const k = was ? timeline.findIndex((x) => same(x, was)) : -1;
  const initial = { ...s.initial };
  if (k > 0) initial.moment = k;
  else delete initial.moment;
  return { ...s, timeline,
    controls: timeline.length === 1 ? "none" : s.controls === "none"
      ? "prev-next" : s.controls,
    ...Object.keys(initial).length ? { initial } : { initial: undefined } };
}

// A scene file's text: its keys in one order, two spaces, a newline
export function sceneJson(s: Scene): string {
  const { id, title, caption, run, lens, timeline, controls, rows,
    initial, groups, pointers } = s;
  return JSON.stringify({ id, title, caption, run, lens, timeline,
    controls, rows, initial, groups, pointers }, null, 2) + "\n";
}
