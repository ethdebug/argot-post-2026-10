// What to light (vanilla panel.js forRow, forBytes): a value's bytes
// and rows, or the values that own some bytes. Derived per view from
// its own Decoded and Layout; never stored.
import type { ByteKey, Decoded, Layout, Light, Path, Target } from "./types";
import { byteKey } from "./hex";

export const noLight: Light = { bytes: new Set(), rows: new Set(),
  colours: new Map(), cap: new Set(), gutters: new Set(), muted: false };

const under = (p: Path, root: Path) => p === root ||
  p.startsWith(root + ".") || p.startsWith(root + "[");
const parentOf = (p: Path) => p.replace(/(\.[^.[\]]+|\[[^\]]*\])$/, "");

// A row hidden in a collapsed group shows as its outermost collapsed
// ancestor
function shownAs(p: Path, collapsed: ReadonlySet<Path>): Path {
  let v = p;
  for (let a = parentOf(p); a !== p && a; p = a, a = parentOf(a)) {
    if (collapsed.has(a)) v = a;
  }
  return v;
}

function lit(l: Layout, owners: Path[]): Set<ByteKey> {
  return new Set(owners.flatMap((q) => [...l.owned.get(q) ?? []]));
}

// A value (a tree row) and everything under it
export function forPath(d: Decoded, l: Layout, path: Path,
  o: { collapsed?: ReadonlySet<Path> } = {}): Light {
  const owners = [...l.owned.keys()].filter((q) => under(q, path));
  const below = [...d.byPath.keys()].filter((q) => under(q, path));
  let rows = [path, ...owners, ...below];
  if (o.collapsed?.size) {
    rows = rows.flatMap((p) => [p, shownAs(p, o.collapsed!)]);
  }
  return { ...noLight, bytes: lit(l, owners), rows: new Set(rows),
    muted: true };
}

// Bytes from..to of one row: the values that own them
export function forBytes(d: Decoded, l: Layout,
  at: NonNullable<Target["bytes"]>): Light {
  const owners = new Set<Path>();
  for (let i = at.from; i <= at.to; i++) {
    for (const p of l.cover.get(byteKey(at.location, at.row, i)) ?? []) {
      owners.add(p);
    }
  }
  return { ...noLight, bytes: lit(l, [...owners]), rows: owners, at,
    muted: true };
}
