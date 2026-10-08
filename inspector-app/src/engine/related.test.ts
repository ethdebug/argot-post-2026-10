import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { A, C } from "../../test/expect";
import { forPath } from "./light";
import { decode } from "./decode";
import { layout } from "./layout";
import {
  related, relatedValues, relClass, withRelated,
} from "./related";
import { walkthrough } from "./walkthrough/fold";

const mid = async () => {
  const p = await testProject();
  const dc = p.decodings["sol:arcade-mid"];
  const d = await decode(p, dc, "arcade-mid:after");
  const t = await p.timeline("arcade-mid");
  const c = await p.compilation(dc.compilation);
  const snap = t.points.find((x) => x.id === d.point)!.snapshot;
  const w = (path: string) => walkthrough({ d, c, snap, keys: dc.keys },
    path);
  // the related rows' names, in the dump, with `context` rows around
  const rows = (path: string, context = 0) => layout(d, "storage",
    { only: { rows: related(d, path, w(path), "storage"), context } })
    .rows.map((r) => r.how);
  return { d, w, rows };
};
const ROSTER0 = "keccak(slot 0)";
const RECORD = "keccak(0x7099…79c8, slot 3)";

it("a packed field: the mapping's root, its key's slot, its record's",
  async () => {
    const { rows } = await mid();
    expect(rows(`${A}.score`)).toEqual(["slot 3", ROSTER0, RECORD]);
  });

it("one row of context: each related row's neighbours that are rows",
  async () => {
    const { rows } = await mid();
    expect(rows(`${A}.score`, 1)).toEqual(["slot 2", "slot 3", ROSTER0,
      `${ROSTER0} + 1`, RECORD, `${RECORD} + 1`]);
  });

it("a value with a walkthrough of one step: its own slot", async () => {
  const { rows } = await mid();
  expect(rows("total")).toEqual(["slot 2"]);
});

it("a string: its record's slots, its length and its data", async () => {
  const { rows } = await mid();
  expect(rows(`${A}.name`)).toEqual(["slot 3", ROSTER0, RECORD,
    `${RECORD} + 1`]);
});

it("no walkthrough: the value's own rows", async () => {
  const { d } = await mid();
  expect(related(d, "total", null, "storage")).toEqual([
    `0x${"2".padStart(64, "0")}`]);
  expect(related(d, "total", null, "memory")).toEqual([]);
});

it("the tree's: the selection, and where its key comes from",
  async () => {
    const { d, w } = await mid();
    expect(relatedValues(d, `${A}.score`, w(`${A}.score`)))
      .toEqual([`${A}.score`, "roster[0]"]);
    // (its own variable's rows, roster's length: the groups that hold it)
    expect(relatedValues(d, "roster[1]", w("roster[1]")))
      .toEqual(["roster[1]"]);
    expect(relatedValues(d, "players", w("players"))).toEqual(["players",
      "roster[0]", "roster[1]", "roster[2]"]);
  });

it("what it consulted: each key in its record's colour; the anchor",
  async () => {
    const { d, w } = await mid();
    const l = layout(d, "storage");
    const of = (path: string) => withRelated(forPath(d, l, path,
      { selection: true }), d, l, path, w(path));
    const all = of("players");
    expect(["roster[0]", "roster[1]", "roster[2]"].map((q) =>
      all.relColours!.get(q))).toEqual([1, 2, 3]);
    expect([...all.anchors!.values()]).toEqual(["players"]);
    expect(all.related!.has(`0x${"3".padStart(64, "0")}`)).toBe(true);
    // (the selection's own colours: as they were)
    expect(all.colours).toEqual(forPath(d, l, "players",
      { selection: true }).colours);
    // (a key that leads to the selection as a whole: neutral)
    const one = of(C);
    expect([...one.relColours!]).toEqual([["roster[2]", 0]]);
    expect(relClass(one, ["roster[2]"])).toBe("rel pkn");
    expect(relClass(all, ["roster[1]"])).toBe("rel pk2");
    expect(relClass(all, [`${A}.score`])).toBe(null);
  });
