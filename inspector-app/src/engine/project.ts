// The project: the scenes (src/scenes) and their decodings, each scene's
// moments from a source (the reader: its snapshot file; authoring: its
// run), as timelines the engine decodes; and, until they become scenes,
// the raw moment and the memory section's fixtures
import type { Io } from "./io";
import type {
  Compilation, CompilationId, Decoding, DecodingId, Timeline, TimelineId,
} from "./types";
import type { ProjectBookmark } from "./fixtures/legacy";
import { fromMemory } from "./fixtures/memory";
import { fromRaw, RAW } from "./fixtures/raw";
import {
  compilationsOf, decodingsOf, pointOf, timelineOf, type BuildInfo,
  type Scene, type SceneId,
} from "./scene";
import {
  fromSnapshot, pointsOf, snapshotOf, type MomentSource,
} from "./source";
import type { BuildId, Run, Scenario, ScenarioId } from "./run/types";

// The runs, in this process (authoring; Node: the tests, the snapshot
// build): a scenario with its builds, and a build's run of it
export interface Runs {
  scenario(id: ScenarioId): Promise<Scenario>;
  run(s: Scenario, build: BuildId): Promise<Run>;
}

export interface Project {
  scenes: Scene[];
  // (the scenes the page's storage inspector shows, as its bookmarks:
  // a scene's moments are its points; and the memory section's)
  bookmarks: ProjectBookmark[];
  // the page's scenes, in order (fixtures/index.json), each by the lens
  // that shows it ("inspector": the storage inspector's bookmarks)
  page: { id: string; title: string; lens: string }[];
  decodings: Record<DecodingId, Decoding>;   // "mid", "vyper/rule", …
  source(scene: SceneId): Promise<MomentSource>;     // memoised
  timeline(id: TimelineId): Promise<Timeline>;        // memoised
  compilation(id: CompilationId): Promise<Compilation>;
  // the engine's results (decode), per project
  memo: Map<string, Promise<unknown>>;
}

interface PageScene { id: string; title: string; lens?: string;
  calldata?: { signature: string; param: string } }

// (a promise kept until it fails: the next ask tries again)
function memoised<T>(f: (k: string) => Promise<T>) {
  const m = new Map<string, Promise<T>>();
  return (k: string) => {
    if (!m.has(k)) {
      const p = f(k);
      p.catch(() => m.get(k) === p && m.delete(k));
      m.set(k, p);
    }
    return m.get(k)!;
  };
}

// A scene as the storage inspector's bookmark: its moments, its first
// selection, the side it opens on (two moments: the initial one)
const bookmarkOf = (s: Scene, page?: PageScene): ProjectBookmark => ({
  id: s.id, title: s.title,
  points: s.timeline.map((_, i) => pointOf(s.id, i)) as
    [string] | [string, string],
  ...(s.initial?.select ? { select: s.initial.select } : {}),
  ...(s.initial?.walk ? { walk: { step: s.initial.walk.step } } : {}),
  ...(s.timeline.length === 2 ? { side: s.initial?.moment === 0 ? "before"
    : "after" } : {}),
  ...(page?.calldata ? { calldata: page.calldata } : {}),
  timeline: timelineOf(s.id), decoding: s.id,
  ...(s.caption ? { summary: s.caption } : {}),
});

export async function load(io: Io, o: { scenes: Scene[];
  builds: Record<ScenarioId, Record<BuildId, BuildInfo>>; runs?: Runs;
  manifest?: string }): Promise<Project> {
  const [page, memJson] = await Promise.all([
    io.json<PageScene[]>(o.manifest ?? "fixtures/index.json"),
    io.json("fixtures/memory.json")]);
  const mem = fromMemory(memJson);
  const scenes = o.scenes;
  const shown = scenes.filter((s) => s.lens === "inspector");
  // (every scene of one or two moments, until a lens shows moments
  // without Before | After: §8 step 4)
  const bookmarks = [...scenes.filter((s) => s.timeline.length <= 2)
    .map((s) => bookmarkOf(s, page.find((x) => x.id === s.id))),
  ...mem.bookmarks];
  const decodings: Record<DecodingId, Decoding> = { ...mem.decodings };
  // (the scenes whose decodings read a compilation)
  const scenesOf = new Map<CompilationId, SceneId[]>();
  // (the storage inspector's first: a compilation is fetched with the
  // first of its scenes the page shows)
  for (const s of [...shown, ...scenes.filter((x) => !shown.includes(x))]) {
    if (!o.builds[s.run.scenario]?.[s.run.build]) continue;
    for (const d of decodingsOf(s, o.builds[s.run.scenario])) {
      decodings[d.id] = d;
      const ss = scenesOf.get(d.compilation) ?? [];
      if (!ss.includes(s.id)) scenesOf.set(d.compilation, [...ss, s.id]);
    }
  }
  // the raw moment (fixtures/raw.json): its bytes, with no variables
  decodings[RAW] = { id: RAW, compilation: RAW, timeline: RAW,
    variables: "state", keys: { from: "trace" } };
  const raw = memoised(() => io.json("fixtures/raw.json").then(fromRaw));
  // a call's calldata, by the ABI (a bookmark that names its function)
  for (const b of bookmarks) {
    if (!b.calldata) continue;
    decodings[`abi:${b.id}`] = { id: `abi:${b.id}`,
      compilation: decodings[b.decoding].compilation, timeline: b.timeline,
      variables: "abi", keys: { from: "trace" }, abi: b.calldata };
  }
  const scene = (id: SceneId) => {
    const s = scenes.find((x) => x.id === id);
    if (!s) throw new Error(`no scene ${id}`);
    return s;
  };
  // a scene's source, and the compilations its decodings read
  const asked = new Set<SceneId>();
  const loaded = memoised(async (id): Promise<{ src: MomentSource;
    compilations: Compilation[] }> => {
    const s = scene(id);
    asked.add(id);
    if (!o.runs) {
      const file = snapshotOf(await io.json(`snapshots/${id}.json`));
      return { src: fromSnapshot(file),
        compilations: file.build.compilations };
    }
    const scenario = await o.runs.scenario(s.run.scenario);
    const run = await o.runs.run(scenario, s.run.build);
    // (the run's code: never on the reader's path)
    const { fromRun } = await import("./source-run");
    return { src: fromRun(run, scenario.builds[s.run.build], s.timeline),
      compilations: compilationsOf(s, scenario) };
  });
  const sceneTimeline = memoised(async (id): Promise<Timeline> => {
    const sceneId = id.slice(timelineOf("").length);
    const { src } = await loaded(sceneId);
    const points = await pointsOf(sceneId, src);
    // (the call's input, as the calldata of a moment after it: the
    // calldata section reads it; on hold until the bugc stepper)
    for (const [i, p] of points.entries()) {
      if (!p.snapshot.calldata && p.transaction) {
        points[i] = { ...p, snapshot: { ...p.snapshot,
          calldata: bytesOf(p.transaction.input) } };
      }
    }
    return { id, contract: { address: points[0]?.transaction?.to ?? "0x",
      compilation: decodings[sceneId]?.compilation ?? "" }, points,
    bookmarks: [] };
  });
  return {
    scenes, bookmarks, decodings, memo: new Map(),
    page: page.map((s) => ({ id: s.id, title: s.title,
      lens: s.lens ?? "inspector" })),
    source: async (id) => (await loaded(id)).src,
    timeline: async (id) => mem.timelines.find((t) => t.id === id) ??
      (id === RAW ? (await raw(RAW)).timeline : sceneTimeline(id)),
    async compilation(id) {
      const bug = mem.compilations.find((c) => c.id === id);
      if (bug) return bug;
      if (id === RAW) return (await raw(RAW)).compilation;
      // (from a scene loaded already, if one reads it)
      const ss = scenesOf.get(id) ?? [];
      const s = ss.find((x) => asked.has(x)) ?? ss[0];
      const c = s && (await loaded(s)).compilations.find((x) => x.id === id);
      if (!c) throw new Error(`no compilation ${id}`);
      return c;
    },
  };
}

const bytesOf = (h: string) => Uint8Array.from(
  (h.slice(2).match(/../g) ?? []).map((b) => parseInt(b, 16)));
