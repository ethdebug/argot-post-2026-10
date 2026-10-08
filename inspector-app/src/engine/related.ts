// The rows related to a selection (the "Related" view's filter): the
// rows that hold its bytes, the rows read to find it (a local's frame
// pointer), and every slot its walkthrough touches: where its keys come
// from (roster[0]), the slots it is declared at (a mapping's root), the
// slots each step hands on (a record's), the regions each step reads.
// One rule for every location; storage's state variables have a
// walkthrough, other values have none.
import type {
  ByteKey, Colour, Decoded, Hex, Layout, Light, Location, Path, ValueNode,
} from "./types";
import { regionBytes } from "./location";
import { ownerPath } from "./light";
import { within } from "./tree-paths";
import { slotsOf, type Walkthrough } from "./walkthrough/fold";

export function related(d: Decoded, path: Path, w: Walkthrough | null,
  location: Location): Hex[] {
  const n = d.byPath.get(path);
  if (!n) return [];
  const out = new Set<Hex>();
  const visit = (x: ValueNode) => {
    for (const r of [...x.regions, ...x.reads ?? []]) {
      if (r.location !== location) continue;
      for (const [row] of regionBytes(r)) out.add(row);
    }
    x.children?.forEach(visit);
  };
  visit(n);
  if (w && location === "storage") {
    slotsOf(w.steps).forEach((h) => out.add(h));
  }
  return [...out].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
}

// The values related to a selection, for the tree (Filter.roots): the
// selection, and the values its walkthrough's steps light outside it and
// the groups that hold it (where its keys come from: roster[0])
export function relatedValues(d: Decoded, path: Path,
  w: Walkthrough | null): Path[] {
  const out = new Set<Path>([path]);
  for (const st of w?.steps ?? []) {
    for (const q of st.rows) {
      if (d.byPath.has(q) && !within(d.byPath, q, path) &&
        !within(d.byPath, path, q)) out.add(q);
    }
  }
  return [...out];
}

// A selection's light with what it consulted (the related treatment,
// in the related view or not): the related rows it does not light, the
// bytes and tree rows of the related values outside it, each in the
// colour of the part of the selection it leads to (a key: its record's;
// 0, neutral: the selection as a whole, or none in particular), and
// the anchors, the related rows that are a variable's own slot with
// none of its data (a mapping's root: the base of its keys' hashes)
export function withRelated(light: Light, d: Decoded, l: Layout,
  path: Path, w: Walkthrough | null): Light {
  const rows = related(d, path, w, l.location);
  const values = relatedValues(d, path, w).filter((q) => q !== path);
  // (a key's colour, as its input step has it: the colour of its entry
  // among the variable's, the selection's own when it is the variable)
  const leads = new Map<Path, Colour>();
  for (const st of w?.steps ?? []) {
    if (st.phase !== "input" || w!.variable !== path) continue;
    for (const p of st.parts) {
      for (const [q, k] of p.colours ?? []) {
        if (typeof k === "number" && k) leads.set(q, k);
      }
    }
  }
  const relColours = new Map<Path, Colour>();
  for (const q of d.byPath.keys()) {
    if (light.rows.has(q)) continue;
    const v = values.find((x) => within(d.byPath, q, x));
    if (v !== undefined) relColours.set(q, leads.get(v) ?? 0);
  }
  const relBytes = new Set<ByteKey>();
  for (const [id, keys] of l.owned) {
    if (!relColours.has(ownerPath(id))) continue;
    for (const k of keys) if (!light.bytes.has(k)) relBytes.add(k);
  }
  const lit = new Set([...light.bytes].map((k) => k.split("|")[1]));
  const own = new Map(l.rows.filter((r) => r.role === "own-slot")
    .map((r) => [r.address, r.what[0]?.path] as const));
  const anchors = new Map<Hex, Path>();
  for (const r of rows) {
    const p = own.get(r);
    if (p) anchors.set(r, p);
  }
  return { ...light, related: new Set(rows.filter((r) => !lit.has(r))),
    relBytes, relColours, anchors };
}

// The related treatment's classes for a consulted value's bytes, row or
// name (one token for the dump, the tree and the popovers): "rel" and
// its colour's (pk1 …), or the neutral one (pkn); none for another
export function relClass(light: Light, ids: string[]): string | null {
  const ks = ids.map((id) => light.relColours?.get(ownerPath(id)))
    .filter((k) => k !== undefined);
  if (!ks.length) return null;
  return `rel ${typeof ks[0] === "number" && ks[0] ? `pk${ks[0]}` : "pkn"}`;
}
