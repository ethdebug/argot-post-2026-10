// How a local in memory was found (vanilla mem.js items, decode.js
// stepsAlong): its pointer's regions in the order the library took them
// (the regions read to find it, e.g. its frame pointer, then its own),
// each with its fields' expressions and values, and the bytes it holds;
// then the result. Each item has a key for its structure (what it does,
// not the values it finds) and its evaluation in short, to set two
// steps' derivations side by side.
import type { Decoded, Hex, Path, ResolvedRegion, Snapshot } from "./types";
import { toBig } from "./hex";

export interface Field { field: string; expr: unknown; value: Hex;
  args?: { expr: unknown; value: Hex }[] }
export type Item =
  | { kind: "start"; key: string; eval: string }
  | { kind: "region"; key: string; eval: string; name: string;
    fields: Field[]; region: ResolvedRegion; read: Hex }
  | { kind: "result"; key: string; eval: string; region: ResolvedRegion;
    text: string };

const hex4 = (n: number) => "0x" + n.toString(16).padStart(4, "0");
// "0x00b8–0x00bf"; a storage region: "bytes 24–31 of the slot"
export const span = (r: ResolvedRegion) => r.location === "storage"
  ? `bytes ${r.offset}–${r.offset + r.length - 1} of the slot`
  : `${hex4(r.offset)}–${hex4(r.offset + r.length - 1)}`;
// a value from the evaluator: small numbers in decimal, others in hex
export const shown = (h: Hex) => {
  const n = toBig(h);
  return n < 256n ? String(n) : hex4(Number(n));
};
const readOf = (snap: Snapshot, r: ResolvedRegion): Hex => {
  const m = snap.memory ?? new Uint8Array();
  const out = Array.from({ length: r.length }, (_, k) =>
    (m[r.offset + k] ?? 0).toString(16).padStart(2, "0"));
  return `0x${out.join("")}`;
};
// what a region's bytes are: a frame's address, or the value
export const readText = (name: string, read: Hex) => name === "-frame"
  ? { what: "the frame's address", value: hex4(Number(toBig(read))) }
  : { what: "the value", value: read };

export function derivation(d: Decoded, snap: Snapshot, path: Path):
  Item[] | null {
  const n = d.byPath.get(path);
  const g = d.graphs.get(path);
  if (!n?.value || n.none || !g || !n.regions.length) return null;
  const all = [...g.nodes.values()].flatMap((x) => x.instances)
    .filter((i) => i.region && i.fields)
    .sort((a, b) => Number(a.id.split("@")[1]) - Number(b.id.split("@")[1]));
  const out: Item[] = [{ kind: "start", key: "start", eval: "" }];
  for (const i of all) {
    const r = i.region!;
    const read = readOf(snap, r);
    const t = readText(r.name ?? "", read);
    out.push({ kind: "region", name: r.name ?? "", fields: i.fields!,
      region: r, read,
      key: `region ${r.name} ${JSON.stringify(i.fields!.map((f) =>
        [f.field, f.expr]))}`,
      eval: `${i.fields!.map((f) => `${f.field} ${shown(f.value)}`)
        .join("; ")}: ${t.what}, ${t.value}` });
  }
  const r = n.regions[0];
  out.push({ kind: "result", key: "result", region: r, text: n.value.text,
    eval: `${span(r)} = ${n.value.text}` });
  return out;
}
