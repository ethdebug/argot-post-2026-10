import { load, type Project } from "../src/engine/project";
import { builds, scenes } from "../src/scenes";
import { fsIo } from "./io";
import { runs } from "./run";
import { sceneSnapshot } from "../src/engine/snapshots";
import { snapshotJson } from "../src/engine/source";
import type { Decoding } from "../src/engine/types";
import { PAUSE_STEPS, PAUSE_TX, STEPPER } from "./expect";

// The project, its scenes from their runs (authoring)
export const testProject = (): Promise<Project> =>
  load(fsIo(), { scenes, builds, runs });

// A scene's snapshot file, as the build makes it from the runs: its
// JSON text, made once a test file (a replay's decodes every trace
// step: seconds)
const files = new Map<string, Promise<string>>();
export function snapshotText(id: string): Promise<string> {
  if (!files.has(id)) {
    files.set(id, testProject().then((p) => sceneSnapshot(p,
      scenes.find((s) => s.id === id)!)).then((f) =>
      JSON.stringify(snapshotJson(f))));
  }
  return files.get(id)!;
}

// The project as the reader has it: each scene from its snapshot file
// (snapshotText's, through JSON)
export async function readerProject(): Promise<Project> {
  const io = fsIo();
  return load({ ...io, json: async <T>(p: string) => {
    const m = p.match(/^snapshots\/(.+)\.json$/);
    return (m ? JSON.parse(await snapshotText(m[1])) : io.json(p)) as T;
  } }, { scenes, builds });
}

// A pause of alice's third hit (test/expect.ts PAUSE_STEPS) in a bug
// build's run: the debugger's decoding there, everything in scope (the
// stepper scene's run, "run:optimized-locals")
export async function pauseOf(p: Project, o: "O2", k: number):
  Promise<{ decoding: Decoding; point: string }> {
  const run = `run:${STEPPER[o]}`;
  const src = await p.source(run);
  const i = src.moments.findIndex((m) => m.tx === PAUSE_TX &&
    m.step === PAUSE_STEPS[o][k]);
  if (i < 0) throw new Error(`no pause ${k} in ${run}`);
  return { decoding: p.decodings[run], point: `${run}:${i}` };
}
