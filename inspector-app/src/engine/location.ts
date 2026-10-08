// What a dump needs of a data location, and nothing else differs between
// them: how its bytes fall into rows, the row after a row (for the gaps),
// a row's address as the gutter shows it, its name, and a row's bytes at
// a point. Rows follow from the location's addressing: storage is
// slot-addressed (a row is a slot, by number); memory and calldata are
// offset-addressed segments, one stream of bytes from byte 0, where rows
// are only layout: 32 bytes a row (a word), from 0x0000 by 0x0020.
import type { Hex, Location, ResolvedRegion, Snapshot } from "./types";
import { slotHex } from "./hex";

export const hex4 = (n: number): Hex =>
  `0x${n.toString(16).padStart(4, "0")}`;
// how a location's bytes are found: by slot, or by offset in a segment
export const addressing = (l: Location): "slot" | "offset" =>
  l === "storage" ? "slot" : "offset";
const byOffset = (l: Location) => addressing(l) === "offset";
// (an offset-addressed segment: its rows, of a word each)
const ROW = 32;
const rowOf = (i: number): [number, number] =>
  [Math.floor(i / ROW) * ROW, i % ROW];

// The rows and bytes a region covers. Offsets count from the most
// significant byte; a region longer than the rest of its row goes on
// into the next rows.
export function regionBytes(r: ResolvedRegion): [Hex, number][] {
  if (byOffset(r.location)) {
    return Array.from({ length: r.length }, (_, k) => {
      const [row, i] = rowOf(r.offset + k);
      return [hex4(row), i];
    });
  }
  if (r.slot === undefined) return [];
  return Array.from({ length: r.length }, (_, k) => {
    const at = r.offset + k;
    return [slotHex(r.slot! + BigInt(Math.floor(at / 32))), at % 32];
  });
}

// the row after `row`
export const nextRow = (l: Location, row: Hex): bigint =>
  !byOffset(l) ? BigInt(row) + 1n : BigInt(row) + BigInt(ROW);

// The addresses kept of `all` (in address order): `rows`, and up to
// `context` rows on each side of each, where the rows are adjacent (the
// next word or slot: nothing is drawn that the dump would not draw)
export function near(all: Hex[], rows: Iterable<Hex>, context: number,
  location: Location): Set<Hex> {
  const want = new Set([...rows].map((h) => BigInt(h)));
  const keep = new Set<Hex>();
  all.forEach((a, i) => {
    if (!want.has(BigInt(a))) return;
    keep.add(a);
    for (let k = i; k < i + context && k + 1 < all.length &&
      nextRow(location, all[k]) === BigInt(all[k + 1]); k++) {
      keep.add(all[k + 1]);
    }
    for (let k = i; k > i - context && k > 0 &&
      nextRow(location, all[k - 1]) === BigInt(all[k]); k--) {
      keep.add(all[k - 1]);
    }
  });
  return keep;
}

// a row's name, for a location whose rows are not found by a rule: the
// location and its offset ("memory 0x0080", "calldata 0x0020")
export const rowName = (l: Location, row: Hex) => `${l} ${row}`;
// an offset-addressed range of bytes, first to last, the one way every
// place names it ("calldata 0x0004–0x0023"; one byte: "memory 0x00df")
export const rangeText = (l: Location, a: number, b: number) =>
  `${l} ${hex4(a)}${b > a ? `–${hex4(b)}` : ""}`;

// whether rows may follow the last one shown (a gap line after it):
// calldata ends where the call's input does
export const goesOn = (l: Location) => l !== "calldata";

// a row's address in the gutter: a slot's last digits; an offset whole
export const addressText = (l: Location, row: Hex) =>
  byOffset(l) ? row : `…${row.slice(-4)}`;

// an offset-addressed location's bytes at a point (none: empty)
export const segmentOf = (s: Snapshot | undefined, l: Location) =>
  (l === "memory" ? s?.memory : l === "calldata" ? s?.calldata
    : undefined) ?? new Uint8Array();
// the rows of a whole segment (one that does not go on): every row of
// its bytes, its padding too
export const segmentRows = (s: Snapshot | undefined, l: Location): Hex[] =>
  addressing(l) !== "offset" || goesOn(l) ? []
    : Array.from({ length: Math.ceil(segmentOf(s, l).length / ROW) },
      (_, k) => hex4(k * ROW));
// a row's bytes at a point, as hex pairs; undefined: past the end of the
// segment
export function rowBytes(s: Snapshot | undefined, l: Location,
  row: Hex): (string | undefined)[] {
  const pair = (b: number) => b.toString(16).padStart(2, "0");
  if (byOffset(l)) {
    const m = segmentOf(s, l);
    const at = Number(BigInt(row));
    return Array.from({ length: ROW }, (_, i) => at + i < m.length
      ? pair(m[at + i]) : undefined);
  }
  const w = (s?.storage.get(row) ?? "0x").slice(2).padStart(64, "0");
  return w.match(/../g)!;
}
