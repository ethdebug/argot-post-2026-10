// The project: the scenes (src/scenes) and their decodings, each scene's
// moments from a source (the reader: its snapshot file; authoring: its
// run), as timelines the engine decodes
import type { Io } from "./io";
import type {
  Bookmark, Compilation, CompilationId, Decoding, DecodingId, PointId,
  Timeline,
  TimelineId, TimelinePoint,
} from "./types";
import {
  compilationsOf, decodingsOf, marksOf, pointOf, replayOf, timelineOf,
  type BuildInfo,
  type Scene, type SceneId,
} from "./scene";
import {
  fromSnapshot, pointAt, pointsOf, snapshotOf, type MomentSource,
} from "./source";
import type { BuildId, Run, Scenario, ScenarioId } from "./run/types";

// The runs, in this process (authoring; Node: the tests, the snapshot
// build; the browser: run/client.ts): a scenario with its builds (at
// least those named), and a build's run of it
export interface Runs {
  scenario(id: ScenarioId, builds: BuildId[]): Promise<Scenario>;
  run(s: Scenario, build: BuildId): Promise<Run>;
}

// A scene as a bookmark: its timeline, the decoding it shows, its
// caption for the page's summary line
export type ProjectBookmark = Bookmark &
  { timeline: TimelineId; decoding: DecodingId; summary?: string;
    // (a replay's: its points every trace step, once its source loads;
    // `marks`, the indexes of the scene's own moments among them)
    replay?: true; marks?: number[] };

export interface Project {
  scenes: Scene[];
  // (every scene, as a bookmark: a scene's moments are its points)
  bookmarks: ProjectBookmark[];
  // the page's scenes, in order (src/scenes page), each by the lens
  // that shows it ("inspector": the storage inspector's bookmarks)
  page: { id: string; title: string; lens: string }[];
  decodings: Record<DecodingId, Decoding>;   // "mid", "vyper/rule", …
  source(scene: SceneId): Promise<MomentSource>;     // memoised
  // (authoring: a scene's run, every trace step and transaction end a
  // moment: "run:<scene>", its bookmark's points filled once it ran)
  point(timeline: TimelineId, id: PointId): Promise<TimelinePoint>;
  timeline(id: TimelineId): Promise<Timeline>;        // memoised
  compilation(id: CompilationId): Promise<Compilation>;
  // the engine's results (decode), per project
  memo: Map<string, Promise<unknown>>;
}

interface PageScene { id: string; title: string; lens: string }

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
const bookmarkOf = (s: Scene): ProjectBookmark => ({
  id: s.id, title: s.title,
  points: s.timeline.map((_, i) => pointOf(s.id, i)) as
    [string] | [string, string],
  ...(s.initial?.select ? { select: s.initial.select } : {}),
  ...(s.initial?.walk ? { walk: { step: s.initial.walk.step } } : {}),
  ...(s.initial?.collapse ? { collapse: s.initial.collapse } : {}),
  ...(s.initial?.related ? { related: true } : {}),
  ...(s.timeline.length === 2 ? { side: s.initial?.moment === 0 ? "before"
    : "after" } : {}),
  // (more moments: the one it opens at, its first unless it says)
  ...(s.timeline.length > 2 ? { moment: s.initial?.moment ?? 0 } : {}),
  timeline: timelineOf(s.id), decoding: s.id,
  ...(s.caption ? { summary: s.caption } : {}),
  ...(s.replay ? { replay: true as const,
    marks: s.timeline.map((_, i) => i) } : {}),
});

export async function load(io: Io, o: { scenes: Scene[];
  builds: Record<ScenarioId, Record<BuildId, BuildInfo>>; runs?: Runs;
  page?: PageScene[] }): Promise<Project> {
  const page = o.page ?? [];
  const scenes = o.scenes;
  // (the storage inspector's scenes the page shows: src/scenes page's;
  // raw-named, an embed's, is not one)
  const shown = scenes.filter((s) => s.lens === "inspector" &&
    page.some((x) => x.id === s.id));
  // (every scene)
  const bookmarks = scenes.map(bookmarkOf);
  const decodings: Record<DecodingId, Decoding> = {};
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
  // (authoring: each scene's run as a scene of its own, "run:<id>":
  // everything in scope at every moment)
  const RUN = "run:";
  if (o.runs) {
    for (const s of scenes) {
      const main = decodings[s.id];
      if (!main) continue;
      const id = `${RUN}${s.id}`;
      decodings[id] = { ...main, id, timeline: id, variables: "scope" };
      bookmarks.push({ id, title: `${s.title}: the run`, points: [] as
        unknown as [string], timeline: id, decoding: id });
    }
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
      const src = fromSnapshot(file);
      if (s.replay) dense(s, src);
      return { src, compilations: file.build.compilations };
    }
    // (its build, and for one with no ethdebug, solc's: its rule)
    const info = o.builds[s.run.scenario];
    const need = [s.run.build, ...info[s.run.build].ethdebug ? []
      : Object.keys(info).filter((b) => info[b].language === "solidity")];
    const scenario = await o.runs.scenario(s.run.scenario, need);
    const run = await o.runs.run(scenario, s.run.build);
    // (the run's code: never on the reader's path)
    const { fromRun } = await import("./source-run");
    const src = fromRun(run, scenario.builds[s.run.build], s.replay
      ? replayOf(s, run.txs[s.timeline[0].tx].steps) : s.timeline);
    if (s.replay) dense(s, src);
    return { src, compilations: compilationsOf(s, scenario) };
  });
  // (a replay's bookmark, once its source loads: every trace step a
  // point, its own moments its marks, the one it opens at a mark)
  const dense = (s: Scene, src: MomentSource) => {
    const bm = bookmarks.find((b) => b.id === s.id)!;
    (bm.points as string[]).splice(0, Infinity, ...src.moments.map((_, k) =>
      pointOf(s.id, k)));
    bm.marks = marksOf(s, src.moments);
    bm.moment = bm.marks[s.initial?.moment ?? 0];
  };
  // a run's moments, all of them (its bookmark's points, once it ran)
  const runOf = memoised(async (id): Promise<MomentSource> => {
    const s = scene(id.slice(RUN.length));
    if (!o.runs) throw new Error(`${id}: a run, in authoring only`);
    const info = o.builds[s.run.scenario];
    const need = [s.run.build, ...info[s.run.build].ethdebug ? []
      : Object.keys(info).filter((b) => info[b].language === "solidity")];
    const scenario = await o.runs.scenario(s.run.scenario, need);
    const run = await o.runs.run(scenario, s.run.build);
    const { fromRun } = await import("./source-run");
    const src = fromRun(run, scenario.builds[s.run.build], "all");
    const bm = bookmarks.find((b) => b.id === id)!;
    (bm.points as string[]).splice(0, Infinity, ...src.moments.map((_, k) =>
      `${id}:${k}`));
    // (the compilations: the scene's)
    await loaded(s.id);
    return src;
  });
  const runPoints = new Map<PointId, Promise<TimelinePoint>>();
  const runPoint = (id: PointId) => {
    if (!runPoints.has(id)) {
      const tl = id.slice(0, id.lastIndexOf(":"));
      runPoints.set(id, runOf(tl).then((src) =>
        pointAt(id, src, Number(id.slice(tl.length + 1)), true)));
    }
    return runPoints.get(id)!;
  };
  const sceneTimeline = memoised(async (id): Promise<Timeline> => {
    const sceneId = id.slice(timelineOf("").length);
    const { src } = await loaded(sceneId);
    const points = await pointsOf(sceneId, src);
    // (the call's input, as the calldata of a moment after it: the
    // stepper's calldata dump at the transaction's end)
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
    page,
    source: async (id) => id.startsWith(RUN) ? runOf(id)
      : (await loaded(id)).src,
    point: async (tl, id) => tl.startsWith(RUN) ? runPoint(id)
      : (await sceneTimeline(tl)).points.find((x) => x.id === id) ?? Promise.reject(
        new Error(`no point ${id} in ${tl}`)),
    timeline: async (id) => (id.startsWith(RUN) ? { id, contract: { address: "0x",
        compilation: decodings[id]?.compilation ?? "" },
      points: [...await Promise.all(runPoints.values())], bookmarks: [] }
        : sceneTimeline(id)),
    async compilation(id) {
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
