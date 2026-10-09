// The rows related to a selection (the "Related" view's filter): the
// rows that hold its bytes, the rows read to find it (a local's frame
// pointer), and every slot its walkthrough touches: where its keys come
// from (playerList[0]), the slots it is declared at (a mapping's root), the
// slots each step hands on (a record's), the regions each step reads.
// One rule for every location; storage's state variables have a
// walkthrough, other values have none.
import type {
  ByteKey, Colour, Decoded, Hex, Layout, Light, Location, Path,
  ResolvedRegion, Target, ValueNode,
} from "./types";
import { regionBytes } from "./location";
import { byteKey, slotHex, toBig } from "./hex";
import { ownerPath } from "./light";
import { parentIn, within } from "./tree-paths";
import { slotsOf, type Walkthrough } from "./walkthrough/fold";

// What a selection's derivation does with each slot it consults, from
// the dereference graph: the instances its own regions used, and
// theirs, back to the variable's declaration (`uses` edges). A region
// among them is READ: its bytes. A value among them used as a slot (a
// template's input, a hash's argument, a region's base) is an ANCHOR:
// only its number. A slot may be both (playerList's slot 0, for playerList[i]:
// its length bounds the list, and its number is the data's base).
export function roles(d: Decoded, path: Path, location: Location):
  { read: ResolvedRegion[]; anchors: Map<Hex, Path> } {
  const n = d.byPath.get(path);
  const g = n && d.graphs.get(n.root);
  const read: ResolvedRegion[] = [];
  const anchors = new Map<Hex, Path>();
  if (!n || !g) return { read, anchors };
  const byId = new Map([...g.nodes.values()].flatMap((x) => x.instances)
    .map((i) => [i.id, i] as const));
  const own = new Set<string>();
  const visit = (x: ValueNode) => {
    for (const r of [...x.regions, ...x.reads ?? []]) own.add(r.instance);
    x.children?.forEach(visit);
  };
  visit(n);
  const seen = new Set<string>();
  const todo = [...own];
  while (todo.length) {
    const id = todo.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    todo.push(...byId.get(id)?.uses ?? []);
  }
  const PLAIN = 1n << 32n;
  for (const id of seen) {
    const i = byId.get(id)!;
    if (i.region && !own.has(id) && i.region.location === location) {
      read.push(i.region);
    }
    if (i.value === undefined || location !== "storage") continue;
    const v = toBig(i.value);
    // (used as a slot: by a template as an input, by a hash, or as the
    // base of a region's slot)
    const asSlot = [...seen].map((u) => byId.get(u)!).some((c) =>
      c.uses.includes(id) && (
        (g.nodes.get(c.node)!.kind === "template" &&
          Object.values(c.bindings).some((b) => toBig(b) === v)) ||
        !!(g.nodes.get(c.node)!.ast as unknown as Record<string, unknown>)
          ?.["~keccak256"] ||
        (c.region?.slot !== undefined && c.region.slot >= v &&
          c.region.slot - v < PLAIN)));
    if (asSlot) anchors.set(slotHex(v), n.root);
  }
  return { read, anchors };
}

export function related(d: Decoded, path: Path, w: Walkthrough | null,
  location: Location): Hex[] {
  const n = d.byPath.get(path);
  if (!n) return [];
  const out = new Set<Hex>();
  // (the slots its derivation reads, or uses as anchors)
  const r = roles(d, path, location);
  for (const x of r.read) for (const [row] of regionBytes(x)) out.add(row);
  r.anchors.forEach((_, h) => out.add(h));
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
// the groups that hold it (where its keys come from: playerList[0])
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
// its roles (roles()): the bytes it read, tinted, neutral, and the
// rows whose number it used, the anchors (a mapping's root: the base of
// its keys' hashes), by the variable they anchor
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
  const { read, anchors } = roles(d, path, l.location);
  const relBytes = new Set<ByteKey>();
  for (const [id, keys] of l.owned) {
    if (!relColours.has(ownerPath(id))) continue;
    for (const k of keys) if (!light.bytes.has(k)) relBytes.add(k);
  }
  // (the bytes it read: tinted, neutral, and their owners' tree rows)
  const reads = new Set<Hex>();
  for (const r of read) {
    for (const [row, b] of regionBytes(r)) {
      const k = byteKey(r.location, row, b);
      if (light.bytes.has(k)) continue;
      relBytes.add(k);
      reads.add(row);
      for (const o of l.cover.get(k) ?? []) {
        const q = ownerPath(o);
        if (!light.rows.has(q) && !relColours.has(q)) relColours.set(q, 0);
      }
    }
  }
  const lit = new Set([...light.bytes].map((k) => k.split("|")[1]));
  // (an anchor the selection lights is its own: no note)
  for (const h of [...anchors.keys()]) if (lit.has(h)) anchors.delete(h);
  // (the variable whose slot it consulted, as an anchor or read: its
  // tree row consulted too, neutral; a read one's owners are, above)
  for (const p of anchors.values()) {
    if (!light.rows.has(p) && !relColours.has(p)) relColours.set(p, 0);
  }
  // (and every group that holds it, up to its variable: its path in the
  // tree, inside it too; their bytes keep what they have)
  for (let q = parentIn(d.byPath, path); q !== undefined && q !== "";
    q = parentIn(d.byPath, q)) {
    if (d.byPath.has(q) && !light.rows.has(q) && !relColours.has(q)) {
      relColours.set(q, 0);
    }
  }
  return { ...light, related: new Set(rows.filter((r) => !lit.has(r))),
    relBytes, relColours, relReads: reads, anchors };
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

// Pointing at something the selection consulted (its tree row, its bytes,
// its row): that one keeps its consulted tint and the rest of the
// consulted set goes plain; the selection's child colours step back to
// their muted forms (focus "none"), so the pointed one's relation to the
// selection stands out. Anything else pointed at: the light as it is.
export function pointConsulted(light: Light, d: Decoded, l: Layout,
  hover: Target | null): Light {
  const rc = light.relColours;
  if (!hover || !rc?.size) return light;
  const owner = (k: ByteKey) => (l.cover.get(k) ?? []).map(ownerPath)
    .find((q) => rc.has(q));
  const at = hover.path && rc.has(hover.path) ? hover.path
    : hover.bytes ? owner(byteKey(hover.bytes.location, hover.bytes.row,
      hover.bytes.from)) : undefined;
  const row = !at && hover.row && light.related?.has(hover.row)
    ? hover.row : undefined;
  if (!at && !row) return light;
  const keep = (q: Path) => !!at && within(d.byPath, q, at);
  const relColours = new Map([...rc].filter(([q]) => keep(q)));
  const relBytes = new Set([...light.relBytes ?? []].filter((k) => row
    ? k.split("|")[1] === row
    : (l.cover.get(k) ?? []).some((o) => keep(ownerPath(o)))));
  if (row) {
    for (const k of relBytes) {
      for (const o of l.cover.get(k) ?? []) {
        const q = ownerPath(o);
        if (rc.has(q)) relColours.set(q, rc.get(q)!);
      }
    }
  }
  return { ...light, relColours, relBytes, focus: "none" };
}
