// "Inside one play" (vanilla README, run.mjs memWant): the locals bugc
// lists at each pause, dereferenced by the library against memory
import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import type { ValueNode } from "./types";
import { A } from "../../test/expect";

// (the bug scenes' moments: the pauses; their locals, the scope's
// "@locals" group; and storage, its "@storage")
const K: Record<string, number> = { roll: 0, "mult:0": 1, "mult:1": 2,
  writes: 3 };
const at = async (o: string, point: string) => {
  const p = await testProject();
  const d = await decode(p, p.decodings[`bug-${o}/scope`],
    `bug-${o}:${K[point]}`);
  const g = (path: string) => d.tree.find((n) => n.path === path)!;
  return { ...d, tree: g("@locals").children!,
    storage: g("@storage").children! };
};
const values = (ns: ValueNode[]) => Object.fromEntries(ns.flatMap((n) =>
  n.kind ? [] : [[n.path, n.none ? "none" : n.value?.text]]));
const locals = (ns: ValueNode[]) => ns.flatMap((n) =>
  n.kind === "group" ? n.children ?? [] : n.kind ? [] : [n]);

for (const o of ["O0", "O2"]) {
  it(`${o}: hit after the roll, its only local`, async () => {
    expect(values((await at(o, "roll")).tree)).toEqual({ hit: "true" });
  });
  it(`${o}: inside _applyCombo: points 10, combo 3; mult 5, then 3`,
    async () => {
      const [a, b] = [await at(o, "mult:0"), await at(o, "mult:1")];
      expect(a.tree.map((n) => [n.path, n.kind])).toEqual([
        ["_applyCombo", "group"]]);
      expect(values(locals(a.tree))).toEqual({ points: "10", combo: "3",
        mult: "5" });
      expect(values(locals(b.tree))).toEqual({ points: "10", combo: "3",
        mult: "3" });
    });
  it(`${o}: before the writes: gained 30; hit listed, no location; `
    + "alice's record, in storage", async () => {
    const d = await at(o, "writes");
    expect(d.tree.map((n) => n.path)).toEqual(["gained", "hit"]);
    expect(values(d.tree)).toEqual({ hit: "none", gained: "30" });
    // (her record as the trace has it then: every counter but score
    // already written)
    const r = d.byPath.get(A)!;
    expect(r.children!.map((c) => [c.label, c.value?.text]).slice(0, 5))
      .toEqual([["score", "30"], ["combo", "3"], ["bestCombo", "3"],
        ["plays", "3"], ["hits", "3"]]);
    // (score: the low 8 bytes of the slot)
    expect(d.byPath.get(`${A}.score`)!.regions).toEqual([
      expect.objectContaining({ location: "storage", offset: 24,
        length: 8 })]);
  });
}

it("O0: a real call: the frame pointer, the word at 0x80, is the "
  + "function's; each local is found from it", async () => {
  const d = await at("O0", "mult:0");
  const g = d.byPath.get("_applyCombo")!;
  expect(g.regions).toEqual([expect.objectContaining({
    location: "memory", name: "-frame", offset: 0x80, length: 32 })]);
  expect(g.value?.text).toMatch(/^frame at 0x[0-9a-f]{4}$/);
  const frame = parseInt(g.value!.text.slice(9), 16);
  const pts = d.byPath.get("points")!;
  expect(pts.regions).toEqual([expect.objectContaining({
    location: "memory", name: "points", offset: frame + 120, length: 8 })]);
  expect(pts.reads).toEqual([expect.objectContaining({ name: "-frame",
    offset: 0x80 })]);
});

it("O2: inlined: no frame; the locals at fixed offsets", async () => {
  const d = await at("O2", "mult:0");
  expect(d.byPath.get("_applyCombo")!.value?.text).toBe("inlined: no frame");
  expect(d.byPath.get("_applyCombo")!.regions).toEqual([]);
  expect(d.byPath.get("points")!.regions[0]).toMatchObject({ offset: 280,
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
