import { load, type Project } from "../src/engine/project";
import { builds, scenes } from "../src/scenes";
import { fsIo } from "./io";
import { runs } from "./run";
import { sceneSnapshot } from "../src/engine/snapshots";
import { snapshotJson } from "../src/engine/source";

// The project, its scenes from their runs (authoring), the raw and
// memory sections from the static fixtures
export const testProject = (): Promise<Project> =>
  load(fsIo(), { scenes, builds, runs });

// The project as the reader has it: each scene from its snapshot file
// (made here from the runs, as the build makes it, through JSON)
export async function readerProject(): Promise<Project> {
  const authoring = await testProject();
  const files = new Map<string, Promise<unknown>>();
  const file = (id: string) => {
    if (!files.has(id)) {
      files.set(id, sceneSnapshot(authoring, scenes.find((s) =>
        s.id === id)!).then((f) => JSON.parse(JSON.stringify(
        snapshotJson(f)))));
    }
    return files.get(id)!;
  };
  const io = fsIo();
  return load({ ...io, json: <T>(p: string) => {
    const m = p.match(/^snapshots\/(.+)\.json$/);
    return (m ? file(m[1]) : io.json(p)) as Promise<T>;
  } }, { scenes, builds });
}
