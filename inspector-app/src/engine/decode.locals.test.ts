// "Inside one play" (vanilla README, run.mjs memWant): the locals bugc
// lists at each pause, dereferenced by the library against memory
import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import type { ValueNode } from "./types";

const at = async (o: string, point: string) => {
  const p = await testProject();
  return decode(p, p.decodings[`mem:${o}`], `${o}/${point}`);
};
const values = (ns: ValueNode[]) => Object.fromEntries(ns.flatMap((n) =>
  n.kind ? [] : [[n.path, n.none ? "none" : n.value?.text]]));
const locals = (ns: ValueNode[]) => ns.flatMap((n) =>
  n.kind === "group" ? n.children ?? [] : n.kind ? [] : [n]);

for (const o of ["O0", "O2"]) {
  it(`${o}: hit after the roll, its only local`, async () => {
    expect(values((await at(o, "roll")).tree)).toEqual({ hit: "true" });
  });
  it(`${o}: inside multiplied: points 10, combo 3; m 5, then 3`,
    async () => {
      const [a, b] = [await at(o, "mult:0"), await at(o, "mult:1")];
      expect(a.tree.map((n) => [n.path, n.kind])).toEqual([
        ["multiplied", "group"]]);
      expect(values(locals(a.tree))).toEqual({ points: "10", combo: "3",
        m: "5" });
      expect(values(locals(b.tree))).toEqual({ points: "10", combo: "3",
        m: "3" });
    });
  it(`${o}: before the writes: gained 30; hit listed, no location; `
    + "alice's record", async () => {
    const d = await at(o, "writes");
    expect(values(d.tree)).toEqual({ hit: "none", gained: "30" });
    const r = d.byPath.get("players[msg.sender]")!;
    expect(r.kind).toBe("record");
    expect(r.children!.map((c) => [c.label, c.value?.text]))
      .toEqual([["score", "30"], ["combo", "3"], ["bestCombo", "3"],
        ["plays", "3"], ["hitCount", "3"],
        // (her play's block: each level is its own deployment)
        ["lastBlock", o === "O0" ? "16" : "27"]]);
    // (score: the low 8 bytes of the slot)
    expect(d.byPath.get("players[msg.sender].score")!.regions).toEqual([
      expect.objectContaining({ location: "storage", offset: 24,
        length: 8 })]);
  });
}

it("O0: a real call: the frame pointer, the word at 0x80, is the "
  + "function's; each local is found from it", async () => {
  const d = await at("O0", "mult:0");
  const g = d.byPath.get("multiplied")!;
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
  expect(d.byPath.get("multiplied")!.value?.text).toBe("inlined: no frame");
  expect(d.byPath.get("multiplied")!.regions).toEqual([]);
  expect(d.byPath.get("points")!.regions[0]).toMatchObject({ offset: 280,
    length: 8 });
  expect(d.byPath.get("points")!.reads).toEqual([]);
});

it("O0, after m = combo: m's bytes are in combo's word", async () => {
  const d = await at("O0", "mult:1");
  const word = (p: string) => {
    const r = d.byPath.get(p)!.regions[0];
    return Math.floor(r.offset / 32);
  };
  expect(word("m")).toBe(word("combo"));
});
