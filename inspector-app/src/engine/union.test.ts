// A scene's rows and tree rows are the union over its moments (addendum
// §4): no row appears or goes as the moments change
import { describe, expect, it } from "vitest";
import { pauseOf, testProject } from "../../test/project";
import { unionRows, unionTree } from "./union";
import { decode } from "./decode";
import { layout } from "./layout";
import { A } from "../../test/expect";

const at = async (scene: string) => {
  const p = await testProject();
  const bm = p.bookmarks.find((b) => b.id === scene)!;
  const t = await p.timeline(bm.timeline);
  const pts = bm.points.map((id) => t.points.find((x) => x.id === id)!);
  const ds = await Promise.all(bm.points.map((id) =>
    decode(p, p.decodings[bm.decoding], id)));
  return { p, bm, pts, ds };
};

describe("unionRows", () => {
  it("motd: the old long text's rows at both moments", async () => {
    const { pts, ds } = await at("motd");
    const ls = ds.map((d, k) => layout(d, "storage", {}, { point: pts[k] }));
    const [a, b] = ls.map((l) => l.rows.map((r) => r.address));
    // (the long text's data rows: at moment 0 only)
    const gone = a.filter((x) => !b.includes(x));
    expect(gone.length).toBeGreaterThan(0);
    const u = unionRows(ls);
    expect(u).toEqual([...new Set([...a, ...b])].sort((x, y) =>
      BigInt(x) < BigInt(y) ? -1 : 1));
    // (each moment's layout, with the union: the same rows)
    const again = ds.map((d, k) => layout(d, "storage", { rows: u },
      { point: pts[k] }).rows.map((r) => r.address));
    expect(again[0]).toEqual(again[1]);
  });
});

describe("unionTree", () => {
  it("alice: the same tree rows at both moments", async () => {
    const { ds } = await at("alice");
    const paths = ds.map((d) => [...unionTree(d, ds).byPath.keys()]);
    expect(paths[0]).toEqual(paths[1]);
    expect(paths[0]).toContain(`${A}.score`);
  });
  it("a path absent at one moment: kept in its place, muted", async () => {
    const p = await testProject();
    // (the roll: hit, player; the writes' moment, gained too)
    const [roll, writes] = await Promise.all([0, 3].map(async (k) => {
      const at = await pauseOf(p, "O0", k);
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
