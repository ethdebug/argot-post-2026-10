import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { decode } from "./decode";
import { pointOf, timelineOf } from "./scene";
import { fromSnapshot, snapshotOf } from "./source";
import { scenes } from "../scenes";
import {
  readerProject, snapshotText, testProject,
} from "../../test/project";
import { expected, lastBlock, A, B, C } from "../../test/expect";

const authoring = testProject();
const reader = readerProject();

describe.each(scenes.map((s) => [s.id, s] as const))("%s", (_, scene) => {
  // (the first to ask for a replay's file waits for it made: every trace
  // step decoded, over 15s on a busy machine)
  it("its snapshot reads back as its run", async () => {
    const p = await authoring;
    const back = fromSnapshot(snapshotOf(JSON.parse(await snapshotText(
      scene.id))));
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
  }, 60_000);
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
  // (6 KB since play() copies alice's record, name too, into memory; a
  // replay, every trace step its moment: replay.test.ts's budget)
  it("is under 6 KB gzip", async () => {
    if (scene.replay) return;
    const size = zlib.gzipSync(await snapshotText(scene.id)).length;
    expect(size).toBeLessThan(6 * 1024);
  });
});

// each storage scene's moments (test/expect.ts's before and after)
const SIDES: Record<string, [number, number]> = {
  "pitfall-nesting": [0, 0], "pitfall-compiler": [0, 0] };
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
    expect(await Promise.all([A, B, C].map((x) =>
      at("pitfall-nesting", 0, x)))).toEqual(lastBlock);
  });
});

describe("a snapshot of another format (a page's and its data's builds \
apart)", () => {
  it("is refused by name, never misread", async () => {
    const j = JSON.parse(await snapshotText("pitfall-nesting"));
    for (const format of [undefined, 1, 3]) {
      expect(() => snapshotOf({ ...j, format }))
        .toThrow(/^snapshot pitfall-nesting: format \d, not 2, .*reload it\)$/);
    }
  });
});
