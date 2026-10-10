// A replay (scene `replay`): every trace step of its transaction from
// its first moment to its last, its own moments the marks; the same from
// its run (authoring) as from its snapshot (the reader); small enough
// to load with the figure
import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import { readerProject, testProject } from "../../test/project";
import { scenes } from "../scenes";
import { sceneSnapshot } from "./snapshots";
import { snapshotJson } from "./source";
import { STEPPER } from "../../test/expect";

describe.each(Object.values(STEPPER))("%s's replay", (id) => {
  const s = scenes.find((x) => x.id === id)!;
  it("every trace step from its first moment to its end; its moments " +
    "the marks; it opens at its first", async () => {
    for (const p of [await testProject(), await readerProject()]) {
      const src = await p.source(id);
      const bm = p.bookmarks.find((b) => b.id === id)!;
      const first = s.timeline[0].step as number;
      expect(src.moments[0]).toMatchObject({ tx: 3, step: first });
      expect(src.moments.at(-1)).toMatchObject({ tx: 3, step: "end" });
      expect(src.moments.slice(1, -1).every((m, k) =>
        m.step === first + k + 1)).toBe(true);
      expect(bm.points.length).toBe(src.moments.length);
      expect(bm.marks!.map((k) => src.moments[k].label))
        .toEqual(s.timeline.map((m) => m.label));
      expect(bm.moment).toBe(bm.marks![0]);
    }
  });
  it("its snapshot: under 80 KB gzipped", async () => {
    const file = await sceneSnapshot(await testProject(), s);
    const gz = zlib.gzipSync(JSON.stringify(snapshotJson(file))).length;
    expect(gz).toBeLessThan(80 * 1024);
  }, 120_000);
});

describe("a replay's rows and changes", () => {
  it("every row at any step; a step's changed bytes", async () => {
    const { unionRows, changed } = await import("./replay");
    const p = await testProject();
    const id = STEPPER.O2;
    const bm = p.bookmarks.find((b) => b.id === id)!;
    await p.source(id);
    const t = await p.timeline(bm.timeline);
    const snaps = t.points.map((x) => x.snapshot);
    const mem = unionRows(snaps, "memory");
    const deepest = Math.max(...snaps.map((s) => s.stack?.length ?? 0));
    expect(unionRows(snaps, "stack")).toHaveLength(deepest);
    expect(mem.length).toBe(Math.ceil(Math.max(...snaps.map((s) =>
      s.memory?.length ?? 0)) / 32));
    // (an MSTORE changes memory: the step after it, its word's bytes)
    const k = t.points.findIndex((x, j) => j > 0 &&
      changed(t.points[j - 1].snapshot, x.snapshot, "memory", mem).size);
    expect(k).toBeGreaterThan(0);
    const c = changed(snaps[k - 1], snaps[k], "memory", mem);
    expect([...c].every((x) => mem.includes(x.split("|")[0] as never)))
      .toBe(true);
    expect(changed(snaps[k], snaps[k], "memory", mem).size).toBe(0);
    // (memory growing: the zeros it adds are no change)
    const grow = t.points.findIndex((x, j) => j > 0 &&
      (x.snapshot.memory?.length ?? 0) >
      (t.points[j - 1].snapshot.memory?.length ?? 0));
    const g = changed(snaps[grow - 1], snaps[grow], "memory", mem);
    const added = (snaps[grow].memory?.length ?? 0) -
      (snaps[grow - 1].memory?.length ?? 0);
    expect(g.size).toBeLessThan(added);
  });
});
