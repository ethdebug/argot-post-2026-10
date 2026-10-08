// What a dump needs of a data location, and nothing else differs between
// them: how its bytes fall into rows (storage: 32-byte slots by number;
// memory: 32-byte words by offset; calldata: the 4-byte selector, then
// 32-byte words from byte 4), the row after a row (for the gaps), a
// row's address as the gutter shows it, its name, and a row's bytes at
// a point.
import type { Hex, Location, ResolvedRegion, Snapshot } from "./types";
import { slotHex } from "./hex";

export const hex4 = (n: number): Hex =>
  `0x${n.toString(16).padStart(4, "0")}`;
// (memory and calldata: rows by byte offset)
const byOffset = (l: Location) => l === "memory" || l === "calldata";
const rowOf = (l: Location, i: number): [number, number] =>
  l === "calldata" ? i < 4 ? [0, i] : [4 + Math.floor((i - 4) / 32) * 32,
    (i - 4) % 32] : [Math.floor(i / 32) * 32, i % 32];

// The rows and bytes a region covers. Offsets count from the most
// significant byte; a region longer than the rest of its row goes on
// into the next rows.
export function regionBytes(r: ResolvedRegion): [Hex, number][] {
  if (byOffset(r.location)) {
    return Array.from({ length: r.length }, (_, k) => {
      const [row, i] = rowOf(r.location, r.offset + k);
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
  !byOffset(l) ? BigInt(row) + 1n
    : l === "calldata" && BigInt(row) === 0n ? 4n : BigInt(row) + 32n;

// a row's address in the gutter: a slot's last digits; an offset whole
export const addressText = (l: Location, row: Hex) =>
  byOffset(l) ? row : `…${row.slice(-4)}`;

// a row's bytes at a point, as hex pairs: as many as the row has
// (calldata's first: 4); undefined: past the end of memory
export function rowBytes(s: Snapshot | undefined, l: Location,
  row: Hex): (string | undefined)[] {
  const pair = (b: number) => b.toString(16).padStart(2, "0");
  if (byOffset(l)) {
    const m = (l === "memory" ? s?.memory : s?.calldata) ??
      new Uint8Array();
    const at = Number(BigInt(row));
    const n = l === "calldata" ? Math.max(0, Math.min(at === 0 ? 4 : 32,
      m.length - at)) : 32;
    return Array.from({ length: n }, (_, i) => at + i < m.length
      ? pair(m[at + i]) : undefined);
  }
  const w = (s?.storage.get(row) ?? "0x").slice(2).padStart(64, "0");
  return w.match(/../g)!;
}
