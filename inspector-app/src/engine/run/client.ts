// A page's runs: in a worker (worker.ts), or in this thread with no
// worker (tests; a browser without workers), each (scenario, build) run
// once per runner
import type { BuildId, Run, Scenario } from "./types";
import type { Runs } from "../project";
import { scenarioOf } from "./scenario";
import { runOf, runScenario, type RunData } from "./run";

export function runner(worker: Worker | null):
  (s: Scenario, b: BuildId) => Promise<Run> {
  const runs = new Map<string, Promise<Run>>();
  let next = 0;
  const viaWorker = (w: Worker, scenario: Scenario, build: BuildId) =>
    new Promise<Run>((resolve, reject) => {
      const id = next++;
      const on = ({ data }: MessageEvent<{ id: number; run?: RunData;
        error?: string }>) => {
        if (data.id !== id) return;
        w.removeEventListener("message", on);
        if (data.run) resolve(runOf(data.run));
        else reject(new Error(data.error));
      };
      w.addEventListener("message", on);
      w.postMessage({ id, scenario, build });
    });
  return (s, b) => {
    const key = `${s.id}|${b}`;
    if (!runs.has(key)) {
      const p = worker ? viaWorker(worker, s, b)
        : import("./evm").then((evm) => runScenario(s, b, evm));
      // (a failed run is not kept: the next ask tries again)
      p.catch(() => runs.get(key) === p && runs.delete(key));
      runs.set(key, p);
    }
    return runs.get(key)!;
  };
}

// ------------------------------------------------- in the browser

// The scenarios and their builds, as the app's files (one chunk each,
// fetched when a run needs it: the builds are big)
type Files = Record<string, () => Promise<unknown>>;
const scenarioFiles: Files = import.meta.glob(
  "../../../scenarios/*/scenario.json", { import: "default" });
const buildFiles: Files = import.meta.glob(
  "../../../scenarios/*/builds/*/build.json", { import: "default" });

// The runs a page makes (authoring, the companion): its scenarios from
// the app's files, each build's run in a worker (none: in the page), once
export function browserRuns(worker: Worker | null): Runs {
  const runIn = runner(worker);
  const file = (files: Files, path: string) => {
    const f = Object.entries(files).find(([k]) => k.endsWith(path))?.[1];
    if (!f) throw new Error(`no file ${path}`);
    return f();
  };
  const scenarios = new Map<string, Promise<Scenario>>();
  return {
    scenario: (id, builds) => {
      const k = `${id}|${[...builds].sort().join()}`;
      if (!scenarios.has(k)) {
        scenarios.set(k, (async () => scenarioOf({
          ...await file(scenarioFiles, `/${id}/scenario.json`) as object,
          builds: Object.fromEntries(await Promise.all(builds.map(
            async (b) => [b, await file(buildFiles,
              `/${id}/builds/${b}/build.json`)]))) }))());
      }
      return scenarios.get(k)!;
    },
    run: (s, b) => runIn(s, b),
  };
}

// The run's worker (none where workers cannot run)
export const runWorker = (): Worker | null => typeof Worker === "undefined"
  ? null : new Worker(new URL("./worker.ts", import.meta.url),
    { type: "module" });
