// A graph's regions, in walk order, against the library's (vanilla
// decode.js instantiate's check): throws on any difference
import type { Cursor } from "../lib";
import type { DerefGraph, ResolvedRegion } from "../types";

type LibRegion = { name?: string; location: string;
  slot?: { asUint(): bigint }; offset?: { asUint(): bigint };
  length?: { asUint(): bigint } };

// a graph's region instances, in the order the walk made them
export function regionsOf(g: DerefGraph): ResolvedRegion[] {
  const seq = (id: string) => Number(id.slice(id.lastIndexOf("@") + 1));
  return [...g.nodes.values()].flatMap((n) => n.instances)
    .filter((i) => i.region).sort((a, b) => seq(a.id) - seq(b.id))
    .map((i) => i.region!);
}

export function sameAsLibrary(g: DerefGraph,
  regions: Cursor.Region[]): void {
  const mine = regionsOf(g);
  const lib = regions as unknown as LibRegion[];
  if (mine.length !== lib.length) {
    throw new Error(`${g.root}: library gave ${lib.length} regions, ` +
      `the walk gave ${mine.length}`);
  }
  mine.forEach((r, i) => {
    const l = lib[i];
    const want = { name: l.name, location: l.location,
      slot: l.slot?.asUint(), offset: Number(l.offset?.asUint() ?? 0n),
      length: Number(l.length?.asUint() ?? 32n) };
    const got = { name: r.name, location: r.location, slot: r.slot,
      offset: r.offset, length: r.length };
    if (JSON.stringify(want, big) !== JSON.stringify(got, big)) {
      throw new Error(`${g.root}: region ${i} differs: library ${
        JSON.stringify(want, big)}, walk ${JSON.stringify(got, big)}`);
    }
  });
}
const big = (_: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v;
