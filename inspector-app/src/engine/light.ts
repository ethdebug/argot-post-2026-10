// What to light (vanilla panel.js forRow, forBytes): a value's bytes
// and rows, or the values that own some bytes. Derived per view from
// its own Decoded and Layout; never stored.
import type {
  ByteKey, Colour, Decoded, Hex, Layout, Light, Path, Target, ValueNode,
} from "./types";
import { byteKey, slotHex, toBig } from "./hex";
import { regionBytes } from "./layout";
import { parentIn, within } from "./tree-paths";
import type { Part, Step } from "./walkthrough/fold";

export const noLight: Light = { bytes: new Set(), rows: new Set(),
  colours: new Map(), cap: new Set(), gutters: new Set(), muted: false };

type Tree = Decoded["byPath"];
// an owner id's value: `${path}#length` is a part of `path`
export const ownerPath = (id: string): Path => id.replace(/#length$/, "");

// A row hidden in a collapsed group shows as its outermost collapsed
// ancestor
function shownAs(t: Tree, p: Path, collapsed: ReadonlySet<Path>): Path {
  let v = p;
  for (let a = parentIn(t, p); a !== undefined; a = parentIn(t, a)) {
    if (collapsed.has(a)) v = a;
  }
  return v;
}

function lit(l: Layout, owners: Path[]): Set<ByteKey> {
  return new Set(owners.flatMap((q) => [...l.owned.get(q) ?? []]));
}

const owns = (n: ValueNode): boolean =>
  n.regions.length > 0 || !!n.children?.some(owns);

// The colours of a composite's immediate children (vanilla panel.js
// childColors): each child that holds bytes takes 1, 2, … in tree
// order, cycling over `picks` (storage 9, memory 8: a vanilla quirk);
// everything under a child takes its colour; the composite's own (its
// row, its length word) is 0, the selection's yellow. A leaf: none.
export function childColours(d: Decoded, path: Path, picks: 9 | 8):
  ReadonlyMap<Path, Colour> {
  const kids = (d.byPath.get(path)?.children ?? []).filter(owns);
  if (!kids.length) return new Map();
  const out = new Map<Path, Colour>([[path, 0]]);
  kids.forEach((k, i) => {
    const c = (1 + i % picks) as Colour;
    for (const q of d.byPath.keys()) {
      if (within(d.byPath, q, k.path)) out.set(q, c);
    }
  });
  return out;
}

// A variable's own (base) slot: its pointer's declared slot
function baseSlotOf(d: Decoded, root: string): Hex | undefined {
  const g = d.graphs.get(root);
  const v = g && [...g.nodes.values()].find((n) => n.kind === "declared")
    ?.instances[0]?.value;
  return v ? slotHex(toBig(v)) : undefined;
}

// A value (a tree row) and everything under it, in its children's
// colours. `selection`: also the own slot of the variable it is inside
// (a mapping's, an array's length word), tinted in the gutter. A
// variable whose own slot holds none of its data: that slot's gutter.
// `collapsed`: a lit row hidden in a collapsed group lights the row
// that shows it, in that row's colour (or 0).
export function forPath(d: Decoded, l: Layout, path: Path,
  o: { collapsed?: ReadonlySet<Path>; selection?: boolean } = {}): Light {
  const owners = [...l.owned.keys()].filter((q) =>
    within(d.byPath, ownerPath(q), path));
  const below = [...d.byPath.keys()].filter((q) =>
    within(d.byPath, q, path));
  let rows = [path, ...owners.map(ownerPath), ...below];
  let colours = childColours(d, path, l.location === "memory" ? 8 : 9) as
    Map<Path, Colour>;
  if (o.collapsed?.size) {
    const c = o.collapsed;
    rows = rows.flatMap((p) => [p, shownAs(d.byPath, p, c)]);
    colours = new Map([...colours].map(([p, k]) => {
      const v = shownAs(d.byPath, p, c);
      return [p, v === p || colours.get(v) === k ? k : 0];
    }));
  }
  const gutters = new Set<Hex>();
  const root = d.byPath.get(path)?.root ?? path.split(/[.[]/)[0];
  if (path !== root && o.selection) {
    const s = baseSlotOf(d, root);
    if (s) gutters.add(s);
  }
  for (const r of l.rows) {
    if (r.role === "own-slot" && r.what.some((w) => w.path === path)) {
      gutters.add(r.address);
    }
  }
  // (and the regions read to find them: a local's frame pointer)
  const bytes = lit(l, owners);
  for (const q of below) {
    for (const r of d.byPath.get(q)?.reads ?? []) {
      for (const [row, i] of regionBytes(r)) {
        bytes.add(byteKey(r.location, row, i));
      }
    }
  }
  return { ...noLight, bytes, rows: new Set(rows), colours, gutters,
    muted: true };
}

// A whole row, from its address in the gutter: pointed at, nothing lit
export const forRow = (d: Decoded, l: Layout, row: Hex): Light =>
  ({ ...noLight, at: { row, from: 0, to: 31, location: l.location },
    muted: true });

// Bytes from..to of one row: the owners of them (a value, or only its
// length part), and their rows
export function forBytes(d: Decoded, l: Layout,
  at: NonNullable<Target["bytes"]>,
  o: { collapsed?: ReadonlySet<Path> } = {}): Light {
  const owners = new Set<Path>();
  for (let i = at.from; i <= at.to; i++) {
    for (const p of l.cover.get(byteKey(at.location, at.row, i)) ?? []) {
      owners.add(p);
    }
  }
  const rows = [...owners].map(ownerPath);
  return { ...noLight, bytes: lit(l, [...owners]), rows: new Set(
    o.collapsed?.size
      ? rows.flatMap((p) => [p, shownAs(d.byPath, p, o.collapsed!)])
      : rows), at, muted: true };
}

// A walkthrough step (vanilla main.js stepLight, partsLight; panel.js
// forStep): its parts' regions and whole slots lit, in their colours,
// the echoes muted; its gutters; the rows the steps so far found
export function forStep(d: Decoded, l: Layout, steps: Step[],
  i: number): Light {
  const st = steps[i];
  if (!st) return noLight;
  const loc = l.location;
  const partBytes = (p: Part) => {
    const out: ByteKey[] = [];
    for (const r of p.regions) {
      if (r.location !== loc) continue;
      for (const [row, b] of regionBytes(r)) out.push(byteKey(loc, row, b));
    }
    // (a whole slot: all of its bytes)
    for (const s of p.slots ?? []) {
      for (let b = 0; b < 32; b++) out.push(byteKey(loc, s, b));
    }
    return out;
  };
  const bytes = new Set<ByteKey>();
  const dim = new Set<ByteKey>();
  const rows = new Set<Path>();
  const dimRows = new Set<Path>();
  const colours = new Map<Path, Colour>();
  for (const p of st.parts) {
    for (const k of partBytes(p)) {
      bytes.add(k);
      if (p.dim) dim.add(k);
    }
    for (const r of p.rows) {
      rows.add(r);
      if (p.dim) dimRows.add(r);
    }
    for (const [q, k] of p.colours ?? []) colours.set(q, k);
  }
  for (const r of st.rows) rows.add(r);
  // the rows the steps so far have found keep their labels
  const known = new Set<Hex>();
  // (step 0, the goal, finds nothing: it shows what the others will)
  for (const x of steps.slice(0, i + 1).filter((y) => !y.goal)) {
    for (const g of x.gutters) known.add(g);
    for (const p of x.parts) {
      for (const k of partBytes(p)) known.add(k.split("|")[1] as Hex);
    }
  }
  return { ...noLight, bytes, rows, colours, dim, dimRows, known,
    gutters: new Set(st.gutters), muted: true, cap: new Set(),
    ...(st.ruler ? { ruler: st.ruler } : {}),
    ...(st.goal ? { quiet: true } : {}) };
}
