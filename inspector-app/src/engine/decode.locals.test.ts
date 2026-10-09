// Inside one play (test/expect.ts PAUSE_STEPS): the locals bugc lists at
// each pause of alice's third hit, dereferenced by the library against
// memory, in the debugger's decoding of the bug runs
import { it, expect } from "vitest";
import { pauseOf, testProject } from "../../test/project";
import { decode } from "./decode";
import type { ValueNode } from "./types";
import { A } from "../../test/expect";

// (the pauses; their locals, the scope's "@locals" group; and storage,
// its "@storage")
const K: Record<string, number> = { roll: 0, "mult:0": 1, "mult:1": 2,
  writes: 3 };
const at = async (o: "O0" | "O2", point: string) => {
  const p = await testProject();
  const { decoding, point: id } = await pauseOf(p, o, K[point]);
  const d = await decode(p, decoding, id);
  const g = (path: string) => d.tree.find((n) => n.path === path)!;
  return { ...d, tree: g("@locals").children!,
    storage: g("@storage").children! };
};
// (a value's text, or "none": no location; a struct, its summary)
const values = (ns: ValueNode[]) => Object.fromEntries(ns.map((n) =>
  [n.path, n.none ? "none" : n.value?.text ?? n.summary]));

for (const o of ["O0", "O2"] as const) {
  // (bugc #378: locals keep their pointers after a call, _rolledHit's)
  it(`${o}: after the roll: hit, and player, play()'s copy of her record`,
    async () => {
      const d = await at(o, "roll");
      expect(values(d.tree)).toEqual({ hit: "true", player: "7 fields" });
      // (her copy, before this hit: her second hit's record, plays
      // already counted)
      expect(d.byPath.get("player.plays")?.value?.text).toBe("3");
      expect(d.byPath.get("player.name")?.value?.text).toBe('"alice"');
    });
  it(`${o}: inside _applyCombo: points 10, combo 3; mult 5, then 3`,
    async () => {
      const [a, b] = [await at(o, "mult:0"), await at(o, "mult:1")];
      expect(values(a.tree)).toEqual({ points: "10", combo: "3",
        mult: "5" });
      expect(values(b.tree)).toEqual({ points: "10", combo: "3",
        mult: "3" });
    });
  it(`${o}: before the writes: gained 30; player and hit located; `
    + "alice's record, in storage", async () => {
    const d = await at(o, "writes");
    expect(d.tree.map((n) => n.path).sort()).toEqual(["gained", "hit",
      "player"]);
    expect(values(d.tree)).toMatchObject({ hit: "true", gained: "30",
      player: "7 fields" });
    // (her record as the trace has it then: as her second hit left it;
    // play() writes its copy, player, back next)
    const r = d.byPath.get(A)!;
    expect(r.children!.map((c) => [c.label, c.value?.text]).slice(0, 5))
      .toEqual([["score", "30"], ["combo", "2"], ["bestCombo", "2"],
        ["plays", "2"], ["hits", "2"]]);
    // (score: the low 8 bytes of the slot)
    expect(d.byPath.get(`${A}.score`)!.regions).toEqual([
      expect.objectContaining({ location: "storage", offset: 24,
        length: 8 })]);
  });
}

it("O0: a real call: each local is found from the frame pointer, the "
  + "word at 0x80", async () => {
  const d = await at("O0", "mult:0");
  const pts = d.byPath.get("points")!;
  expect(pts.reads).toEqual([expect.objectContaining({ name: "-frame",
    offset: 0x80, length: 32 })]);
});

it("O2: inlined: no frame; the locals at fixed offsets", async () => {
  const d = await at("O2", "mult:0");
  expect(d.byPath.get("points")!.regions[0]).toMatchObject({ offset: 344,
    length: 8 });
  expect(d.byPath.get("points")!.reads).toEqual([]);
});

it("O0, after mult = combo: mult's bytes are in combo's word", async () => {
  const d = await at("O0", "mult:1");
  const word = (p: string) => {
    const r = d.byPath.get(p)!.regions[0];
    return Math.floor(r.offset / 32);
  };
  expect(word("mult")).toBe(word("combo"));
});
