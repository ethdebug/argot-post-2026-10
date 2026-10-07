// What a dump draws (vanilla panel.js buildPanel): the rows (one word
// each, in address order, gaps marked) and which value owns each byte.
// This task: the rows that values own (filter: rows "values" only;
// roots and maxRows come in T2.4).
import type {
  ByteKey, Decoded, Filter, Hex, Layout, Location, Path, ResolvedRegion,
  Row, ValueNode,
} from "./types";
import { byteKey, short, slotHex } from "./hex";

const PLAIN = 1n << 32n; // below this, a slot is a plain number

// The words and bytes a region covers. Offsets count from the most
// significant byte; a region longer than the rest of its word goes on
// into the next slots.
export function regionBytes(r: ResolvedRegion): [Hex, number][] {
  if (r.slot === undefined) return [];
  const out: [Hex, number][] = [];
  for (let k = 0; k < r.length; k++) {
    const at = r.offset + k;
    out.push([slotHex(r.slot + BigInt(Math.floor(at / 32))), at % 32]);
  }
  return out;
}

// "slot 2", or "slot 0x7230…a723" (graph names come in T2.4)
const how = (address: Hex) => {
  const n = BigInt(address);
  return n < PLAIN ? `slot ${n}` : `slot ${short(address)}`;
};

export function layout(d: Decoded, location: Location,
  _filter: Filter = {}): Layout {
  const cover = new Map<ByteKey, Path[]>();
  const owned = new Map<Path, Set<ByteKey>>();
  const first = new Map<Hex, Map<Path, number>>(); // row -> owner -> byte
  const visit = (n: ValueNode) => {
    for (const r of n.regions) {
      if (r.location !== location) continue;
      for (const [row, i] of regionBytes(r)) {
        const k = byteKey(location, row, i);
        cover.set(k, [...new Set([...(cover.get(k) ?? []), n.path])]);
        if (!owned.has(n.path)) owned.set(n.path, new Set());
        owned.get(n.path)!.add(k);
        if (!first.has(row)) first.set(row, new Map());
        const f = first.get(row)!;
        f.set(n.path, Math.min(f.get(n.path) ?? i, i));
      }
    }
    n.children?.forEach(visit);
  };
  d.tree.forEach(visit);
  const addresses = [...first.keys()].sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  const rows: Row[] = addresses.map((address, k) => ({
    address, how: how(address),
    what: [...first.get(address)!].sort((a, b) => a[1] - b[1])
      .map(([path]) => ({ path, name: d.byPath.get(path)?.label ?? path })),
    gapBefore: k === 0 ? BigInt(address) !== 0n
      : BigInt(address) !== BigInt(addresses[k - 1]) + 1n,
  }));
  return { location, point: d.point, rows, cover, owned };
}
