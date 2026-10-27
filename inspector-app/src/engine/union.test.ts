// A scene's rows and tree rows are the union over its moments (addendum
// §4): no row appears or goes as the moments change
import { describe, expect, it } from "vitest";
import { pauseOf, testProject } from "../../test/project";
import { unionRows, unionTree } from "./union";
import { decode } from "./decode";
import { layout } from "./layout";
import { A } from "../../test/expect";

// (two of the optimized stepper's moments, alice's third hit: after the
// roll, and before the writes, test/expect.ts PAUSE_STEPS)
const at = async () => {
  const p = await testProject();
  const xs = await Promise.all([0, 3].map((k) => pauseOf(p, "O2", k)));
  const pts = await Promise.all(xs.map((x) => p.point(x.decoding.timeline,
    x.point)));
  const ds = await Promise.all(xs.map((x) => decode(p, x.decoding,
    x.point)));
  return { pts, ds };
};

describe("unionRows", () => {
  it("memory: each moment's rows, in address order", async () => {
    const { pts, ds } = await at();
    const ls = ds.map((d, k) => layout(d, "memory", {}, { point: pts[k] }));
    const [a, b] = ls.map((l) => l.rows.map((r) => r.address));
    // (rows at one moment only)
    expect(a).not.toEqual(b);
    const u = unionRows(ls);
    expect(u).toEqual([...new Set([...a, ...b])].sort((x, y) =>
      BigInt(x) < BigInt(y) ? -1 : 1));
    // (each moment's layout, with the union: the same rows)
    const again = ds.map((d, k) => layout(d, "memory", { rows: u },
      { point: pts[k] }).rows.map((r) => r.address));
    expect(again[0]).toEqual(again[1]);
  });
});

describe("unionTree", () => {
  it("the same tree rows at both moments", async () => {
    const { ds } = await at();
    const paths = ds.map((d) => [...unionTree(d, ds).byPath.keys()]);
    expect(paths[0]).toEqual(paths[1]);
    expect(paths[0]).toContain(`${A}.score`);
  });
  it("a path absent at one moment: kept in its place, muted", async () => {
    const p = await testProject();
    // (the roll: hit, player; the writes' moment, gained too)
    const [roll, writes] = await Promise.all([0, 3].map(async (k) => {
      const at = await pauseOf(p, "O2", k);
      return decode(p, at.decoding, at.point);
    }));
    const u = unionTree(roll, [roll, writes]);
    const n = u.byPath.get("gained");
    expect(n?.absent).toBe(true);
    expect(n?.regions).toEqual([]);
    expect(u.byPath.get("hit")?.absent).toBeUndefined();
    // (in the other moment's order: gained after hit, as there)
    const loc = u.tree.find((x) => x.path === "@locals")!.children!
      .map((x) => x.path);
    const there = writes.tree.find((x) => x.path === "@locals")!.children!
      .map((x) => x.path);
    expect(loc.slice().sort()).toEqual(there.slice().sort());
  });
});
