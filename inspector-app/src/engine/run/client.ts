// A page's runs: in a worker (worker.ts), or in this thread with no
// worker (tests; a browser without workers), each (scenario, build) run
// once per runner
import type { BuildId, Run, Scenario } from "./types";
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
