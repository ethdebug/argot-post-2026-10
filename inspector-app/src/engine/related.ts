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
import type { RelWhy } from "./types";

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

// The parents of what a selection consulted, outside it: consulted too,
// up to their variable (playerList, for playerList[0]); and their own
// regions, a list's length (not the selection's own groups: its anchors
// are theirs)
export function consultedParents(d: Decoded, path: Path,
  w: Walkthrough | null): { paths: Path[]; regions: ResolvedRegion[] } {
  const paths = new Set<Path>();
  for (const q of relatedValues(d, path, w)) {
    if (q === path) continue;
    for (let p = parentIn(d.byPath, q); p !== undefined && p !== "";
      p = parentIn(d.byPath, p)) {
      if (within(d.byPath, path, p)) break;
      paths.add(p);
    }
  }
  const regions = [...paths].flatMap((p) => (d.byPath.get(p)?.regions ??
    []).filter((r) => r.role === "length"));
  return { paths: [...paths], regions };
}

// The value whose rows the related view shows for a selection: a
// record's field, its record (its siblings stay, muted: the reader keeps
// the context they came from); anything else, itself
export function scopeOf(d: Decoded, path: Path): Path {
  const p = parentIn(d.byPath, path);
  const n = p !== undefined ? d.byPath.get(p) : undefined;
  // (a record, or a struct: its summary counts fields)
  return n && (n.kind === "record" || /fields?$/.test(n.summary ?? ""))
    ? p! : path;
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
  // (and the own regions of what holds what it consulted)
  for (const x of consultedParents(d, path, w).regions) {
    if (x.location !== location) continue;
    for (const [row] of regionBytes(x)) out.add(row);
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
  // (the bytes it read: tinted, neutral, and their owners' tree rows;
  // and the parents of what it consulted, their own regions read too)
  const reads = new Set<Hex>();
  const parents = consultedParents(d, path, w);
  for (const p of parents.paths) {
    if (!light.rows.has(p) && !relColours.has(p)) relColours.set(p, 0);
  }
  // (why each read row was read: a key of the selection's path, or the
  // length of what holds one; by the value that holds its bytes)
  const why = new Map<Hex, RelWhy[]>();
  // (keys by their on-chain names: a record's own name)
  const names = new Map<string, string>();
  for (const [p, n] of d.byPath) {
    const m = p.match(/^[^.[\]]+\[(0x[0-9a-fA-F]{40})\]$/);
    const t = m && d.byPath.get(`${p}.name`)?.value?.text;
    if (m && t && t !== '""') {
      names.set(m[1].toLowerCase(), JSON.parse(t).split(",")[0]);
    }
    void n;
  }
  // (the selection's entries by their key: a mapping selected whole)
  const entries = new Map<string, Path>();
  for (const x of d.byPath.keys()) {
    const k = x.match(/\[(0x[0-9a-fA-F]+)\]$/);
    if (k && x !== path && within(d.byPath, x, path)) {
      entries.set(k[1].toLowerCase(), x);
    }
  }
  const because = (row: Hex, w0: RelWhy) => {
    const ws = why.get(row) ?? [];
    if (!ws.some((x) => x.name === w0.name)) why.set(row, [...ws, w0]);
  };
  // (the regions it read, those of the values it consulted, and their
  // parents' own)
  const seen = [...read, ...values.flatMap((q) => d.byPath.get(q)?.regions
    ?? []), ...parents.regions];
  for (const r of seen) {
    if (r.location !== l.location) continue;
    for (const [row, b] of regionBytes(r)) {
      for (const o of l.cover.get(byteKey(r.location, row, b)) ?? []) {
        const q = ownerPath(o);
        const n = d.byPath.get(q);
        const v = n?.value?.text?.toLowerCase();
        const at = v && /^0x[0-9a-f]+$/.test(v)
          ? path.toLowerCase().indexOf(`[${v}]`) : -1;
        // (a key of the selection's path, or of one of its entries: a
        // mapping selected whole)
        const entry = v ? entries.get(v) : undefined;
        const who = v ? names.get(v) : undefined;
        if (at >= 0) {
          because(row, { name: q, why: "key",
            of: path.slice(0, at + v!.length + 2), ...who ? { who } : {} });
        } else if (entry) {
          because(row, { name: q, why: "key", of: entry,
            ...who ? { who } : {} });
        } else if (/#length$/.test(o) || r.role === "length") {
          because(row, { name: q, why: "length", of: q });
        }
      }
    }
  }
  for (const r of [...read, ...parents.regions]) {
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
    relBytes, relColours, relReads: reads, anchors, relWhy: why };
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
  const row = !at && hover.row && (hover.location ?? l.location) ===
    l.location && light.related?.has(hover.row) ? hover.row : undefined;
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
  // (nothing it consulted there, as for a row of another decoding's
  // storage beside it: as it was)
  if (!relColours.size && !relBytes.size) return light;
  return { ...light, relColours, relBytes, focus: "none" };
}
