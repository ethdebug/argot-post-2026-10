// Timeline facts (vanilla main.js merge; panel.js read/written)
import type { Bookmark, Decoded, Hex, Path, PointId, TimelinePoint }
  from "./types";

export const pointsOf = (bm: Bookmark): PointId[] => [...bm.points];

// A value differs between two decodings: its text, its summary, or
// anything under it (a value only one has differs)
export function changed(a: Decoded, b: Decoded, path: Path): boolean {
  const x = a.byPath.get(path);
  const y = b.byPath.get(path);
  if (!x || !y) return x !== y;
  if (x.value?.text !== y.value?.text || x.summary !== y.summary) {
    return true;
  }
  const kids = new Set([...(x.children ?? []), ...(y.children ?? [])]
    .map((c) => c.path));
  return [...kids].some((k) => changed(a, b, k));
}

const zero = (w?: Hex) => !w || /^0x0*$/.test(w);

// What the transaction between two points did to a slot (null: neither
// read nor written)
export function readWritten(before: TimelinePoint, after: TimelinePoint,
  slot: Hex): "read only" | "written" | "read, written"
  | "written, same value" | "cleared (written to zero)" | null {
  const tx = after.transaction;
  const rd = !!tx?.reads.has(slot);
  const wr = !!tx?.writes.has(slot);
  const b = before.snapshot.storage.get(slot);
  const a = after.snapshot.storage.get(slot);
  if (!wr) return rd ? "read only" : null;
  if (zero(a) && !zero(b)) return "cleared (written to zero)";
  if (a === b) return "written, same value";
  return rd ? "read, written" : "written";
}
