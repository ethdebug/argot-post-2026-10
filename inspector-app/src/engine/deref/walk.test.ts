import { it, expect } from "vitest";
import { testProject } from "../../../test/project";
import { A, B, C } from "../../../test/expect";
import { decode } from "../decode";
import type { DerefGraph, Decoded, RuleNode } from "../types";

const scenes = { mid: ["after"], alice: ["before", "after"],
  motd: ["before", "after"], vyper: ["after"] } as const;

async function at(bm: string, side: string): Promise<Decoded> {
  const p = await testProject();
  const b = p.bookmarks.find((x) => x.id === bm)!;
  return decode(p, p.decodings[b.decoding], `${b.timeline}:${side}`);
}
const mid = () => at("mid", "after");
const nodes = (g: DerefGraph) => [...g.nodes.values()];
const byKind = (g: DerefGraph, k: RuleNode["kind"]) =>
  nodes(g).filter((n) => n.kind === k);
const regionOf = (g: DerefGraph, id: string) => nodes(g)
  .flatMap((n) => n.instances).find((i) => i.id === id)?.region;

const all = Object.entries(scenes).flatMap(([bm, ss]) =>
  ss.map((s) => [bm, s] as const));

it.each(all)("%s at %s: every variable's graph equals the library",
  async (bm, side) => {
    // decode() runs sameAsLibrary (it throws on any difference), and
    // each value's regions are its graph's region instances
    const d = await at(bm, side);
    for (const n of d.byPath.values()) {
      const g = d.graphs.get(n.root)!;
      expect(g, n.root).toBeTruthy();
      for (const r of n.regions) {
        expect(regionOf(g, r.instance), `${n.path} ${r.instance}`)
          .toMatchObject({ slot: r.slot, offset: r.offset,
            length: r.length });
      }
    }
  });

it("players at mid: one rule per template node, 3 instances", async () => {
  const g = (await mid()).graphs.get("players")!;
  const keccak = byKind(g, "define").filter((n) =>
    JSON.stringify(n.ast).includes("~keccak256") &&
    n.template?.startsWith("t_mapping"));
  expect(keccak).toHaveLength(1);
  expect(keccak[0].instances).toHaveLength(3);
  expect(keccak[0].instances.map((i) => i.entry)).toEqual([A, B, C]
    .map((p) => "0x" + p.slice(10, 50).padStart(64, "0")));
  expect(keccak[0].instances.every((i) => i.inputs.includes("key")))
    .toBe(true);
  // the score region: one rule, three instances
  const score = byKind(g, "region").filter((n) =>
    (n.ast as { name?: string }).name === "score");
  expect(score.map((n) => n.instances.length)).toEqual([3]);
  expect(byKind(g, "declared").map((n) => n.instances.length))
    .toEqual([3]);
  expect(g.inputs.map((i) => [i.name, i.provenance]))
    .toEqual([["key", { list: "playerList" }]]);
});

it("playerList: ~read length edge and list count edge", async () => {
  const g = (await mid()).graphs.get("playerList")!;
  const [list] = byKind(g, "list");
  const [length] = byKind(g, "region").filter((n) =>
    (n.ast as { name?: string }).name === "length");
  expect(list.instances).toHaveLength(1);
  expect(list.instances[0].uses).toEqual([length.instances[0].id]);
  const [item] = byKind(g, "region").filter((n) =>
    (n.ast as { name?: string }).name === "item");
  expect(item.instances).toHaveLength(3);
  expect(item.instances[1].bindings.index).toBe("0x01");
  // the item's slot reads `data` (a define) and `index` (the list's)
  const [data] = byKind(g, "define").filter((n) => n.id.endsWith("/data"));
  expect(item.instances[1].uses).toEqual(expect.arrayContaining([
    data.instances[0].id, list.instances[0].id]));
});

it("carol takes else; alice and bob take then", async () => {
  const g = (await mid()).graphs.get("players")!;
  const [cond] = byKind(g, "conditional").filter((n) =>
    n.template === "t_string_storage");
  expect(cond.instances.map((i) => i.branch))
    .toEqual(["then", "then", "else"]);
  // the conditional reads the length flag
  const flag = byKind(g, "region").find((n) =>
    (n.ast as { name?: string }).name === "length-flag")!;
  expect(cond.instances[2].uses).toEqual([flag.instances[2].id]);
});

it("NodeIds are template + JSON path; order is pre-order", async () => {
  const g = (await mid()).graphs.get("motd")!;
  expect(g.order).toEqual([
    "motd#",
    "motd#/define/slot",
    "motd#/in",
    "t_string_storage#",
    "t_string_storage#/for",
    "t_string_storage#/for/group/0",
    "t_string_storage#/for/group/1",
    "t_string_storage#/for/group/1/then",
    "t_string_storage#/for/group/1/then/define/length",
    "t_string_storage#/for/group/1/then/in",
    "t_string_storage#/for/group/1/else",
    "t_string_storage#/for/group/1/else/group/0",
    "t_string_storage#/for/group/1/else/group/1",
    "t_string_storage#/for/group/1/else/group/1/define/length",
    "t_string_storage#/for/group/1/else/group/1/in",
    "t_string_storage#/for/group/1/else/group/1/in/define/start",
    "t_string_storage#/for/group/1/else/group/1/in/in",
  ].filter((id) => g.nodes.has(id)));
  expect(g.nodes.get("motd#/define/slot")!.kind).toBe("declared");
  expect(g.nodes.get("t_string_storage#/for/group/1")!.kind)
    .toBe("conditional");
  expect(g.nodes.get("t_string_storage#")!.kind).toBe("template");
  // mid's motd is long: the else branch's nodes, no then
  expect(g.nodes.has("t_string_storage#/for/group/1/else/group/0"))
    .toBe(true);
  expect(g.nodes.has("t_string_storage#/for/group/1/then/define/length"))
    .toBe(false);
});

it("totalScore: one declared region", async () => {
  const g = (await mid()).graphs.get("totalScore")!;
  expect(nodes(g).map((n) => [n.id, n.kind]))
    .toEqual([["totalScore#", "declared"]]);
});
