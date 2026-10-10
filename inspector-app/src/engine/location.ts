// What a dump needs of a data location, and nothing else differs between
// them: how its bytes fall into rows, the row after a row (for the gaps),
// a row's address as the gutter shows it, its name, and a row's bytes at
// a point. Rows follow from the location's addressing: storage is
// slot-addressed (a row is a slot, by number); so is the stack (a row is
// an item, by its position from the top: 0 is the top); memory and
// calldata are offset-addressed segments, one stream of bytes from byte
// 0, where rows are only layout: 32 bytes a row (a word), from 0x0000 by
// 0x0020.
import type { Hex, Location, ResolvedRegion, Snapshot } from "./types";
import { slotHex } from "./hex";

export const hex4 = (n: number): Hex =>
  `0x${n.toString(16).padStart(4, "0")}`;
// how a location's bytes are found: by slot, or by offset in a segment
export const addressing = (l: Location): "slot" | "offset" =>
  l === "storage" || l === "stack" || l === "transient" ? "slot"
    : "offset";
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

// … and the rows a gap would hide for little room: a hidden run of at
// most `most` rows (a gap row is about two rows tall) between two kept
// rows, or before the first from the location's start, every row of it
// next to the one before; kept too
export function fillGaps(all: Hex[], keep: Set<Hex>, location: Location,
  most = 2): Set<Hex> {
  const out = new Set(keep);
  let run: Hex[] = [];
  let joined = true; // (the run so far follows on from a kept row, or 0)
  let prev: Hex | null = null;
  for (const a of all) {
    const next = prev === null ? BigInt(a) === 0n
      : nextRow(location, prev) === BigInt(a);
    if (keep.has(a)) {
      if (run.length && run.length <= most && joined && next) {
        run.forEach((h) => out.add(h));
      }
      run = [];
      joined = true;
    } else {
      if (!next) joined = false;
      run.push(a);
    }
    prev = a;
  }
  return out;
}

// a row's name, for a location whose rows are not found by a rule: the
// location and its offset ("memory 0x0080", "calldata 0x0020")
export const rowName = (l: Location, row: Hex) =>
  `${l} ${l === "stack" ? BigInt(row) : row}`;
// an offset-addressed range of bytes, first to last, the one way every
// place names it ("calldata 0x0004–0x0023"; one byte: "memory 0x00df")
export const rangeText = (l: Location, a: number, b: number) =>
  `${l} ${hex4(a)}${b > a ? `–${hex4(b)}` : ""}`;

// a row's address in the gutter: a slot's last digits; an offset whole;
// a stack item's position from the top
// (a storage slot whole where that is no wider than its short form,
// "…aa80": 0x02, 0x0102; else its last two bytes)
export const addressText = (l: Location, row: Hex) => {
  if (l === "stack") return String(BigInt(row));
  if (byOffset(l)) return row;
  const h = BigInt(row).toString(16);
  return h.length <= 4 ? `0x${h.padStart(h.length + h.length % 2, "0")}`
    : `…${row.slice(-4)}`;
};

// an offset-addressed location's bytes at a point (none: empty)
export const segmentOf = (s: Snapshot | undefined, l: Location) =>
  (l === "memory" ? s?.memory : l === "calldata" ? s?.calldata
    : undefined) ?? new Uint8Array();
// every row a point has of a location: storage's slots it knows, every
// word of a segment, every stack item (the top first)
export function allRows(s: Snapshot | undefined, l: Location): Hex[] {
  if (l === "storage") return [...s?.storage.keys() ?? []];
  if (l === "stack") {
    return (s?.stack ?? []).map((_, k) => slotHex(BigInt(k)));
  }
  return Array.from({ length: Math.ceil(segmentOf(s, l).length / ROW) },
    (_, k) => hex4(k * ROW));
}
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
  const st = s?.stack;
  const w = (l === "stack" ? st?.[st.length - 1 - Number(BigInt(row))]
    : (l === "transient" ? s?.transient : s?.storage)?.get(row) ?? "0x")
    ?.slice(2).padStart(64, "0") ?? "";
  if (!w) return Array.from({ length: ROW }, () => undefined);
  return w.match(/../g)!;
}

// a region's bytes at a point, as hex (undefined: some of them are not
// part of the point's state)
export function regionHex(s: Snapshot | undefined, r: ResolvedRegion):
  Hex | undefined {
  const rows = new Map<Hex, (string | undefined)[]>();
  const out: string[] = [];
  for (const [row, i] of regionBytes(r)) {
    if (!rows.has(row)) rows.set(row, rowBytes(s, r.location, row));
    const b = rows.get(row)![i];
    if (b === undefined) return undefined;
    out.push(b);
  }
  return `0x${out.join("")}`;
}

// "memory 0x00b8–0x00bf" (rangeText); a storage region: "bytes 24–31
// of the slot"
export const spanText = (r: ResolvedRegion) => r.location === "storage"
  ? `bytes ${r.offset}–${r.offset + r.length - 1} of the slot`
  : rangeText(r.location, r.offset, r.offset + r.length - 1);
