// The project: the scenes (src/scenes) and their decodings, each scene's
// moments from a source (the reader: its snapshot file; authoring: its
// run), as timelines the engine decodes; and, until it becomes scenes,
// the memory section's fixture
import type { Io } from "./io";
import type {
  Compilation, CompilationId, Decoding, DecodingId, PointId, Timeline,
  TimelineId, TimelinePoint,
} from "./types";
import type { ProjectBookmark } from "./fixtures/legacy";
import {
  compilationsOf, decodingsOf, pointOf, timelineOf, type BuildInfo,
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
  // (authoring: a scene's run, every trace step and transaction end a
  // moment: "run:<scene>", its bookmark's points filled once it ran)
  point(timeline: TimelineId, id: PointId): Promise<TimelinePoint>;
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
  ...(s.initial?.collapse ? { collapse: s.initial.collapse } : {}),
  ...(s.timeline.length === 2 ? { side: s.initial?.moment === 0 ? "before"
    : "after" } : {}),
  // (more moments: the one it opens at, its first unless it says)
  ...(s.timeline.length > 2 ? { moment: s.initial?.moment ?? 0 } : {}),
  ...(page?.calldata ? { calldata: page.calldata } : {}),
  timeline: timelineOf(s.id), decoding: s.id,
  ...(s.caption ? { summary: s.caption } : {}),
});

export async function load(io: Io, o: { scenes: Scene[];
  builds: Record<ScenarioId, Record<BuildId, BuildInfo>>; runs?: Runs;
  manifest?: string }): Promise<Project> {
  const page = await io.json<PageScene[]>(o.manifest ??
    "fixtures/index.json");
  const scenes = o.scenes;
  // (the storage inspector's scenes the page shows: fixtures/index.json's;
  // raw-named, an embed's, is not one)
  const shown = scenes.filter((s) => s.lens === "inspector" &&
    page.some((x) => x.id === s.id));
  // (every scene, but one of groups: its groups are, below)
  const bookmarks = [...scenes.filter((s) => !s.groups)
    .map((s) => bookmarkOf(s, page.find((x) => x.id === s.id)))];
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
  // a scene's groups of moments, each a bookmark: everything in scope
  // (its decoding "<scene>/scope"; the memory section's pauses)
  for (const s of scenes) {
    if (!s.groups || !decodings[s.id]) continue;
    const id = `${s.id}/scope`;
    decodings[id] = { ...decodings[s.id], id, variables: "scope" };
    for (const g of s.groups) {
      bookmarks.push({ id: g.id, title: g.title,
        points: g.moments.map((k) => pointOf(s.id, k)) as [string],
        ...(g.select ? { select: g.select } : {}),
        ...(g.moments.length === 2 ? { side: "after" as const } : {}),
        timeline: timelineOf(s.id), decoding: id });
    }
  }
  // a call's calldata, by the ABI (a bookmark that names its function)
  for (const b of bookmarks) {
    if (!b.calldata) continue;
    decodings[`abi:${b.id}`] = { id: `abi:${b.id}`,
      compilation: decodings[b.decoding].compilation, timeline: b.timeline,
      variables: "abi", keys: { from: "trace" }, abi: b.calldata };
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
      return { src: fromSnapshot(file),
        compilations: file.build.compilations };
    }
    // (its build, and for one with no ethdebug, solc's: its rule)
    const info = o.builds[s.run.scenario];
    const need = [s.run.build, ...info[s.run.build].ethdebug ? []
      : Object.keys(info).filter((b) => info[b].language === "solidity")];
    const scenario = await o.runs.scenario(s.run.scenario, need);
    const run = await o.runs.run(scenario, s.run.build);
    // (the run's code: never on the reader's path)
    const { fromRun } = await import("./source-run");
    return { src: fromRun(run, scenario.builds[s.run.build], s.timeline),
      compilations: compilationsOf(s, scenario) };
  });
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
    // (a group's function: its moments' locals in it)
    for (const g of scene(sceneId).groups ?? []) {
      for (const k of g.scope ? g.moments : []) {
        points[k] = { ...points[k], scope: g.scope };
      }
    }
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
