// A replay (scene `replay`): every trace step of each of its
// transactions from its first moment there to its last, its own moments
// the marks; the same from
// its run (authoring) as from its snapshot (the reader); small enough
// to load with the figure
import { describe, expect, it } from "vitest";
import zlib from "node:zlib";
import {
  readerProject, snapshotText, testProject,
} from "../../test/project";
import { scenes } from "../scenes";
import { STEPPER } from "../../test/expect";

describe.each(Object.values(STEPPER))("%s's replay", (id) => {
  const s = scenes.find((x) => x.id === id)!;
  it("every trace step of each of its transactions from its first " +
    "moment there to its last; its moments the marks; it opens at its " +
    "first", async () => {
    for (const p of [await testProject(), await readerProject()]) {
      const src = await p.source(id);
      const bm = p.bookmarks.find((b) => b.id === id)!;
      const txs = [...new Set(s.timeline.map((m) => m.tx))];
      expect([...new Set(src.moments.map((m) => m.tx))]).toEqual(txs);
      for (const tx of txs) {
        const mine = s.timeline.filter((m) => m.tx === tx);
        const got = src.moments.filter((m) => m.tx === tx);
        expect(got[0]).toMatchObject({ tx, step: mine[0].step });
        expect(got.at(-1)).toMatchObject({ step: mine.at(-1)!.step });
        const steps = got.map((m) => m.step).filter((x) => x !== "end");
        expect(steps.every((x, k) => x === steps[0] + k)).toBe(true);
      }
      expect(bm.points.length).toBe(src.moments.length);
      expect(bm.marks!.map((k) => src.moments[k].label))
        .toEqual(s.timeline.map((m) => m.label));
      expect(bm.moment).toBe(bm.marks![0]);
    }
    // (the first to ask for a replay's file waits for it made: every
    // trace step decoded, optimized-locals's 2053: over 15s on CI)
  }, 60_000);
  // (optimized-locals's three transactions' steps, carol's join, alice's
  // hit and bob's miss: 56 KB, each state and facts its changes and each
  // context once (source.ts); 315 KB as whole moments)
  it("its snapshot: under 120 KB gzipped", async () => {
    const gz = zlib.gzipSync(await snapshotText(id)).length;
    expect(gz).toBeLessThan(120 * 1024);
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
