// The annotated layer of the raw lens (the post's first before/after):
// the same dumps, each top-level value a coloured composite with a short
// label beside its bytes. Pure: the units (what one label names, and
// the colour of each of its parts), their labels' text, and the short
// value formats, from a decoding; where the labels go is placement.ts.
import type {
  Colour, Decoded, Hex, Layout, Location, Path, ValueNode,
} from "./types";
import { childColours } from "./light";
import { byteKey, short } from "./hex";
import { rowBytes } from "./location";
import type { Snapshot } from "./types";

// ------------------------------------------------- short values

// The on-chain names of the keys of a mapping whose entries have a
// string `name`: each address by its name's first words (up to a comma;
// "carol, the unstoppable combo queen" → carol), lower case keys
export function onChainNames(d: Decoded | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of d?.byPath.values() ?? []) {
    const m = n.path.match(/^[^.[\]]+\[(0x[0-9a-fA-F]{40})\]$/);
    const name = m && d!.byPath.get(`${n.path}.name`)?.value?.text;
    if (!m || !name || name === '""') continue;
    out.set(m[1].toLowerCase(), clip(JSON.parse(name).split(",")[0], 12));
  }
  return out;
}

// a text cut to `n` characters, an ellipsis last
export const clip = (t: string, n: number) => t.length > n
  ? `${t.slice(0, n - 1)}…` : t;

// A path with its keys by name: players[0x90f7…b906] → players[carol]
export const pathName = (p: Path, names: ReadonlyMap<string, string>) =>
  p.replace(/\[(0x[0-9a-fA-F]{40})\]/g, (_, h: string) =>
    `[${names.get(h.toLowerCase()) ?? short(h)}]`);

// A value, short: an address by its on-chain name (else 0x90f7…b906); a
// string quoted, cut to `text` characters; fixed bytes with their leading
// zero bytes dropped, as the stack's words are (0x1420; long ones
// 0xe94e…3a62); a number as it is; an array as its items, the first
// three; a record as its first fields
export function shortValue(n: ValueNode, names: ReadonlyMap<string, string>,
  o: { text?: number; fields?: number } = {}): string {
  const v = n.value?.text;
  if (n.children) {
    const kids = n.children;
    if (n.kind === "record" || !/\[\d*\]$/.test(n.typeText)) {
      return fields(n, names, o.fields ?? 3);
    }
    const items = kids.slice(0, 3).map((k) => shortValue(k, names, o));
    return `[${items.join(", ")}${kids.length > 3 ? ", …" : ""}]`;
  }
  if (v === undefined) return "";
  if (/^0x[0-9a-f]{40}$/i.test(v) && /address|contract/.test(n.typeText)) {
    return names.get(v.toLowerCase()) ?? short(v);
  }
  if (v.startsWith('"')) {
    const s = JSON.parse(v) as string;
    const k = o.text ?? 24;
    return s.length > k ? `"${s.slice(0, k - 1)}…"` : v;
  }
  if (/^bytes\d+$/.test(n.typeText) || /^0x[0-9a-f]+$/i.test(v)) {
    const h = v.replace(/^0x(00)*/, "") || "00";
    return h.length > 10 ? `0x${h.slice(0, 4)}…${h.slice(-4)}` : `0x${h}`;
  }
  return v;
}

// a record's first `k` fields, "score 100 · combo 0 · bestCombo 4 …"
function fields(n: ValueNode, names: ReadonlyMap<string, string>,
  k: number): string {
  const kids = n.children ?? [];
  const shown = kids.slice(0, k).map((c) =>
    `${c.label} ${shortValue(c, names, { text: 16 })}`);
  return shown.join(" · ") + (kids.length > k ? " …" : "");
}

// ------------------------------------------------- units

// A label's text, in parts: plain, or a part in a colour (a field's name
// and value, as its bytes are coloured)
export type Part = { text: string; k?: Colour };
// One thing a label names: a top-level variable, a mapping's entry, a
// group of hand-written locals, or variables that share one slot alone
// (totalScore and totalHits); its owners (the layout's owner ids under
// it), each one's colour, and its label's text, longest first (the
// placement takes the first that fits)
export interface Unit {
  id: string; paths: Path[]; hand: boolean;
  colours: ReadonlyMap<Path, Colour>;
  label: Part[][];
}

const ownerPath = (id: string) => id.replace(/#[a-z]+$/, "");
const under = (p: Path, root: Path) => p === root ||
  p.startsWith(root + ".") || p.startsWith(root + "[");
// a composite's own colour (its length word) is neutral, never the
// selection's yellow: nothing is selected here
const noYellow = (m: ReadonlyMap<Path, Colour>) => new Map([...m].map(
  ([p, k]) => [p, k === 0 ? "nt" as const : k]));

// The rows (addresses) a value's own bytes are in, in a layout
const rowsOf = (l: Layout, path: Path) => {
  const out = new Set<Hex>();
  for (const [id, keys] of l.owned) {
    if (!under(ownerPath(id), path)) continue;
    for (const k of keys) out.add(k.split("|")[1] as Hex);
  }
  return out;
};

// The units of a decoding, as a layout of one location shows them:
// the top-level values that own bytes there, a mapping's entries each
// its own; values alone in one row, side by side, one unit
export function unitsOf(d: Decoded, l: Layout,
  o: { names: ReadonlyMap<string, string>; hand?: boolean }): Unit[] {
  const top = d.tree.flatMap((n) => n.children && /^mapping\(/.test(
    n.typeText) ? n.children : [n]).filter((n) => rowsOf(l, n.path).size);
  const units: Unit[] = [];
  // (one-row leaves that share their row with nothing else: merged)
  const leafRow = (n: ValueNode) => {
    const rs = [...rowsOf(l, n.path)];
    return !n.children && rs.length === 1 ? rs[0] : undefined;
  };
  const done = new Set<ValueNode>();
  for (const n of top) {
    if (done.has(n)) continue;
    const row = leafRow(n);
    const mates = row ? top.filter((m) => leafRow(m) === row) : [n];
    mates.forEach((m) => done.add(m));
    if (mates.length > 1) {
      // (as the source declares them)
      const ms = mates;
      const colours = new Map<Path, Colour>(ms.map((m, i) =>
        [m.path, (1 + i) as Colour]));
      const part = (m: ValueNode): Part => ({ k: colours.get(m.path),
        text: `${m.label} ${shortValue(m, o.names)}` });
      units.push({ id: ms.map((m) => m.path).join("+"),
        paths: ms.map((m) => m.path), hand: !!o.hand, colours,
        label: [ms.flatMap((m, i) => [...i ? [{ text: " · " }] : [],
          part(m)])] });
      continue;
    }
    units.push(unitOf(d, n, o));
  }
  return units;
}

function unitOf(d: Decoded, n: ValueNode,
  o: { names: ReadonlyMap<string, string>; hand?: boolean }): Unit {
  const name = pathName(n.path, o.names);
  const kids = noYellow(childColours(d, n.path, 9));
  // (a leaf: one colour)
  const colours = kids.size ? kids : new Map<Path, Colour>([[n.path, 1]]);
  const head = { text: `${name}: ` };
  let label: Part[][];
  if (n.children && (n.kind === "record" || !/\[\d*\]$/.test(n.typeText))) {
    // a record: its first fields, each in its colour; then fewer
    const by = (k: number): Part[] => [head, ...(n.children ?? [])
      .slice(0, k).flatMap((c, i) => [...i ? [{ text: " · " }] : [],
        { text: `${c.label} ${shortValue(c, o.names, { text: 16 })}`,
          k: colours.get(c.path) }]),
    ...(n.children!.length > k ? [{ text: " …" }] : [])];
    label = [3, 2, 1].map(by);
  } else {
    const v = (text?: number) => shortValue(n, o.names, { text });
    label = [[head, { text: v(), k: colours.get(n.path) }],
      [head, { text: v(14), k: colours.get(n.path) }]];
  }
  label.push([{ text: name }]);
  return { id: n.path, paths: [n.path], hand: !!o.hand, colours, label };
}

// Which unit owns an owner id (a value path, or a part of one), and its
// colour there
export function colourOf(units: Unit[], id: string):
  { unit: number; k: Colour } | undefined {
  const p = ownerPath(id);
  for (const [i, u] of units.entries()) {
    if (!u.paths.some((q) => under(p, q))) continue;
    // (the colour of the nearest value at or above it that has one)
    for (let q: string = p; q; q = q.replace(/(\.[^.[\]]+|\[[^\]]*\])$/,
      "")) {
      const k = u.colours.get(q);
      if (k !== undefined) return { unit: i, k };
      if (!/[.[]/.test(q)) break;
    }
    return { unit: i, k: 1 };
  }
  return undefined;
}

// ------------------------------------------------- groups

// A unit's rows as the dump shows them (`shown`: its rows, in order,
// with a gap where they jump): runs of adjacent rows that hold its
// bytes; the first run holds its label, the others a short one each
// (what they hold: "players[carol].name: "carol, the unst…"")
export interface Group { unit: number; rows: Hex[]; main: boolean;
  label: Part[][] }
export function groupsOf(units: Unit[], l: Layout,
  shown: { address: Hex; gapBefore?: boolean }[], o: {
    d: Decoded; names: ReadonlyMap<string, string> }): Group[] {
  const out: Group[] = [];
  units.forEach((u, i) => {
    const mine = new Set(u.paths.flatMap((p) => [...rowsOf(l, p)]));
    let run: Hex[] | null = null;
    const runs: Hex[][] = [];
    for (const r of shown) {
      if (!mine.has(r.address) || r.gapBefore) run = null;
      if (!mine.has(r.address)) continue;
      if (!run) runs.push(run = []);
      run.push(r.address);
    }
    runs.forEach((rows, k) => out.push({ unit: i, rows, main: k === 0,
      label: k === 0 ? u.label : more(u, rows, l, o) }));
  });
  return out;
}

// the label of a unit's later run: the value its rows hold (their
// owners' nearest common value), by path; its value too when the unit's
// own label does not show it (a record's field past its first three)
function more(u: Unit, rows: Hex[], l: Layout,
  o: { d: Decoded; names: ReadonlyMap<string, string> }): Part[][] {
  const ids = new Set<string>();
  for (const r of rows) {
    for (let i = 0; i < 32; i++) {
      for (const id of l.cover.get(byteKey(l.location, r, i)) ?? []) {
        ids.add(ownerPath(id));
      }
    }
  }
  const ps = [...ids].filter((p) => u.paths.some((q) => under(p, q)));
  let common = ps[0] ?? u.paths[0];
  while (!ps.every((p) => under(p, common))) {
    common = common.replace(/(\.[^.[\]]+|\[[^\]]*\])$/, "");
  }
  const name = pathName(common, o.names);
  const n = o.d.byPath.get(common);
  const k = colourOf([u], common)?.k;
  const shownIn = u.paths.includes(common) || !n || n.children ||
    (o.d.byPath.get(u.paths[0])?.children ?? []).slice(0, 3).includes(n);
  if (shownIn) return [[{ text: name, k }]];
  return [[{ text: `${name}: ` }, { text: shortValue(n, o.names), k }],
    [{ text: `${name}: ` }, { text: shortValue(n, o.names,
      { text: 12 }), k }], [{ text: name, k }]];
}

// ------------------------------------------------- the cells

// What each byte of a row is in the annotated layer: its unit, colour,
// and whether it is zero (a label may cover its own unit's zeros)
export function cellsOf(units: Unit[], l: Layout, row: Hex,
  snap: Snapshot | undefined): ({ unit: number; k: Colour } | null)[] {
  return Array.from({ length: 32 }, (_, i) => {
    const ids = l.cover.get(byteKey(l.location as Location, row, i)) ?? [];
    for (const id of ids) {
      const c = colourOf(units, id);
      if (c) return c;
    }
    return null;
  }).map((c, i) => c && rowBytes(snap, l.location, row)[i] !== undefined
    ? c : null);
}
