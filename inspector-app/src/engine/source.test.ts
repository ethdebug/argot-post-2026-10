import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { decode } from "./decode";
import { pointOf, timelineOf } from "./scene";
import { sceneSnapshot } from "./snapshots";
import { fromSnapshot, snapshotJson, snapshotOf } from "./source";
import { scenes } from "../scenes";
import { readerProject, testProject } from "../../test/project";
import { expected, lastBlock, A, B, C } from "../../test/expect";

const authoring = testProject();
const reader = readerProject();
const json = (f: unknown) => JSON.stringify(f);

describe.each(scenes.map((s) => [s.id, s] as const))("%s", (_, scene) => {
  it("its snapshot reads back as its run", async () => {
    const p = await authoring;
    const file = await sceneSnapshot(p, scene);
    const back = fromSnapshot(snapshotOf(JSON.parse(json(
      snapshotJson(file)))));
    const run = await p.source(scene.id);
    expect(back.moments).toEqual(run.moments);
    expect(await back.digest()).toBe(await run.digest());
    for (const [i] of run.moments.entries()) {
      expect(back.facts(i)).toEqual(run.facts(i));
      const [a, b] = [await back.state(i), await run.state(i)];
      for (const [slot, w] of b.storage) {
        expect(a.storage.get(slot), slot).toBe(w);
      }
      expect({ ...a, storage: 0 }).toEqual({ ...b, storage: 0 });
    }
  });
  it("decodes the same from its snapshot as from its run", async () => {
    const [p, q] = [await authoring, await reader];
    const ds = Object.values(p.decodings).filter((d) =>
      d.timeline === timelineOf(scene.id));
    expect(ds.length).toBeGreaterThan(0);
    for (const d of ds) {
      for (const [i] of scene.timeline.entries()) {
        const at = pointOf(scene.id, i);
        const [x, y] = [await decode(p, d, at), await decode(q, d, at)];
        expect(y.tree, `${d.id} ${at}`).toEqual(x.tree);
      }
    }
  });
  // (6 KB since play() copies alice's record, name too, into memory)
  it("is under 6 KB gzip", async () => {
    const file = await sceneSnapshot(await authoring, scene);
    const size = zlib.gzipSync(json(snapshotJson(file))).length;
    expect(size).toBeLessThan(6 * 1024);
  });
});

// each storage scene's moments (test/expect.ts's before and after)
const SIDES: Record<string, [number, number]> = { mid: [0, 0],
  alice: [0, 1], motd: [0, 1], vyper: [0, 0] };
describe.each([["runs", authoring], ["snapshots", reader]] as const)(
  "test/expect.ts's values, from the %s", (_, project) => {
  it.each(Object.keys(SIDES))("%s", async (id) => {
    const p = await project;
    for (const [k, i] of SIDES[id].entries()) {
      const d = await decode(p, p.decodings[id], pointOf(id, i));
      for (const row of expected[id]) {
        const n = d.byPath.get(row[0]);
        expect(n?.value?.text ?? n?.summary, `${id} ${i} ${row[0]}`)
          .toBe(row[1 + k]);
      }
    }
  });
  it("lastBlock: the scenario's blocks", async () => {
    const p = await project;
    const at = async (scene: string, i: number, who: string) =>
      (await decode(p, p.decodings[scene], pointOf(scene, i)))
        .byPath.get(`${who}.lastBlock`)?.value?.text;
    expect(await Promise.all([A, B, C].map((x) => at("mid", 0, x))))
      .toEqual(lastBlock.mid);
    expect(await at("alice", 1, A)).toBe(lastBlock.alice);
  });
});
