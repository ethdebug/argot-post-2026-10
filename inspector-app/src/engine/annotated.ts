// The annotated layer of the raw lens (the post's first before/after):
// the same dumps, each top-level value (a mapping's entries each) in
// one at-rest tint, and the inspector's popovers saying what each is.
// Pure: the units (what one tint covers), the notes (what one popover
// says, and the runs of rows it may point at), and the short value
// formats, from a decoding; which row a popover points at is
// placement.ts's.
import type {
  Colour, Decoded, Hex, Layout, Location, Path, ValueNode,
} from "./types";
import { byteKey, short } from "./hex";
import { rangeText } from "./location";

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

// What one colour covers: a top-level value, or a mapping's entry (its
// owner ids are under `path`), lit as the inspector lights a
// composite's children: its own child colour (pk1…pk9; never the
// selection's yellow)
export interface Unit { path: Path; k: Colour }
const PICKS = 9;

const ownerPath = (id: string) => id.replace(/#[a-z]+$/, "");
const under = (p: Path, root: Path) => p === root ||
  p.startsWith(root + ".") || p.startsWith(root + "[");

// The rows (addresses) a value's own bytes are in, in a layout
const rowsOf = (l: Layout, path: Path) => {
  const out = new Set<Hex>();
  for (const [id, keys] of l.owned) {
    if (!under(ownerPath(id), path)) continue;
    for (const k of keys) out.add(k.split("|")[1] as Hex);
  }
  return out;
};

// The values a layout shows, top-level (a mapping's entries each its
// own), in tree order, each its child colour in turn
export function unitsOf(d: Decoded, l: Layout): Unit[] {
  return d.tree.flatMap((n) => n.children && /^mapping\(/.test(n.typeText)
    ? n.children : [n]).filter((n) => rowsOf(l, n.path).size)
    .map((n, i) => ({ path: n.path, k: (1 + i % PICKS) as Colour }));
}

// Each byte of a row: the unit whose value owns it (an index), or null
export function cellsOf(units: Unit[], l: Layout, row: Hex):
  (number | null)[] {
  return Array.from({ length: 32 }, (_, i) => {
    const ids = l.cover.get(byteKey(l.location as Location, row, i)) ?? [];
    const k = units.findIndex((u) => ids.some((id) =>
      under(ownerPath(id), u.path)));
    return k < 0 ? null : k;
  });
}

// ------------------------------------------------- notes

// What one popover says, "how : what": `how` (badged in the colour of
// unit `badge`, when it names one value), and its items (`seg`: a
// slot's, " / " between slots on one line; `line`: its line when the
// popover takes several; `unit`: an item that names a value of its
// own, badged in that value's colour); the units it is about, and the
// runs of rows (as the dump shows them) it may point at
export interface Item { text: string; seg: number; line: number;
  unit?: number }
export interface Note { units: number[]; how: string; badge?: number;
  items: Item[]; runs: Hex[][] }

// The notes of a layout's units: one a unit; values alone in one slot
// together, one note (totalScore and totalHits); `perRun`: one note a
// run of adjacent rows, whatever units are in it (the stack's items,
// as the inspector's popovers do)
export function notesOf(d: Decoded, l: Layout, units: Unit[],
  shown: { address: Hex; gapBefore?: boolean }[],
  o: { names: ReadonlyMap<string, string>; perRun?: boolean;
    // (false: names alone; the dump shows the values, as an
    // abbreviated stack does)
    values?: boolean }): Note[] {
  const runsOf = (rows: Set<Hex>) => {
    const out: Hex[][] = [];
    let run: Hex[] | null = null;
    for (const r of shown) {
      if (!rows.has(r.address) || r.gapBefore) run = null;
      if (!rows.has(r.address)) continue;
      if (!run) out.push(run = []);
      run.push(r.address);
    }
    return out;
  };
  const node = (u: Unit) => d.byPath.get(u.path)!;
  const rows = units.map((u) => rowsOf(l, u.path));
  if (o.perRun) {
    const all = new Set(rows.flatMap((r) => [...r]));
    return runsOf(all).map((run) => {
      const us = units.map((_, i) => i).filter((i) =>
        run.some((r) => rows[i].has(r)));
      return { units: us, runs: [run],
        how: run.length === 1 ? rowName(l, run[0])
          : `${rowName(l, run[0])}–${rowName(l, run.at(-1)!).replace(
            /^\S+ /, "")}`,
        items: us.map((i, k) => ({ seg: run.indexOf([...rows[i]][0]),
          line: k, unit: i, text: `${pathName(node(units[i]).path, o.names)}${
            o.values === false ? "" : ` ${shortValue(node(units[i]),
              o.names, { text: 16 })}`}` })) };
    });
  }
  const done = new Set<number>();
  const out: Note[] = [];
  units.forEach((u, i) => {
    if (done.has(i)) return;
    const n = node(u);
    const one = !n.children && rows[i].size === 1 ? [...rows[i]][0]
      : undefined;
    const mates = one ? units.map((_, k) => k).filter((k) =>
      !node(units[k]).children && rows[k].size === 1 &&
      rows[k].has(one)) : [i];
    mates.forEach((k) => done.add(k));
    const runs = runsOf(new Set(mates.flatMap((k) => [...rows[k]])));
    if (mates.length > 1) {
      out.push({ units: mates, runs, how: rowName(l, one!),
        items: mates.map((k) => ({ seg: 0, line: 0, unit: k,
          text: `${node(units[k]).label} ${
            shortValue(node(units[k]), o.names)}` })) });
      return;
    }
    out.push({ units: [i], runs, how: pathName(n.path, o.names),
      badge: i, items: itemsOf(n, o.names) });
  });
  return out;
}

// a row's name, where the layout does not name it by a rule: "slot 2",
// "stack 0", "memory 0x0040"
function rowName(l: Layout, row: Hex) {
  if (l.location === "storage") return `slot ${BigInt(row)}`;
  if (l.location === "stack") return `stack ${BigInt(row)}`;
  return rangeText(l.location, Number(BigInt(row)), Number(BigInt(row)));
}

// what a value is, in short items: a record's fields ("score 30"),
// three a line, a string field a line of its own; an array's items;
// else its value
function itemsOf(n: ValueNode, names: ReadonlyMap<string, string>):
  Item[] {
  const kids = n.children ?? [];
  if (kids.length && (n.kind === "record" || !/\[\d*\]$/.test(n.typeText))) {
    let line = 0;
    let on = 0;
    return kids.map((c) => {
      const text = `${c.label} ${shortValue(c, names, { text: 16 })}`;
      const alone = c.value?.text.startsWith('"');
      if (on === 3 || (alone && on)) {
        line++;
        on = 0;
      }
      on = alone ? 3 : on + 1;
      return { seg: 0, line, text };
    });
  }
  if (kids.length) {
    return kids.map((c) => ({ seg: 0, line: 0,
      text: shortValue(c, names) }));
  }
  return [{ seg: 0, line: 0, text: shortValue(n, names) }];
}
