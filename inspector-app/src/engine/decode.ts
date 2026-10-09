// A decoding at one timeline point: the value tree, each value's bytes
// from the library's dereference() (vanilla decode.js decodeStorage,
// walk, walkMapping, instantiate's take and lengthParts)
import { dereference, Data, type Pointer } from "./lib";
import type {
  Compilation, Decoded, Decoding, DerefGraph, Format, Hex, InputNode,
  Local, PointId, ResolvedRegion, TimelinePoint, ValueNode, Variable,
} from "./types";
import type { Project } from "./project";
import { machineState } from "./snapshot";
import { decodeValue, isValueType, summary, typeName } from "./values";
import { keysFor } from "./keys";
import { abiTree } from "./calldata";
import { walk as walkGraph } from "./deref/walk";
import { regionsOf, sameAsLibrary } from "./deref/check";
import { short, slotHex, toBig, toHex } from "./hex";

type Types = Record<string, Format.Type>;
type State = ReturnType<typeof machineState>;
type Any = { kind: string; size?: number; count?: number;
  contains?: any };
const as = (t: Format.Type) => t as unknown as Any;
const typeIdOf = (v: Variable) => (v.type as { id?: string }).id ?? "";
const join = (prefix: string, n: string) => (prefix ? `${prefix}-${n}` : n);
// Struct member names that start with "$" are written "_$" in regions
const memberRegion = (m: string) => (m.startsWith("$") ? "_" + m : m);
const isDynBytes = (t: Any) =>
  t.kind === "string" || (t.kind === "bytes" && t.size === undefined);

type LibRegion = { location: string; name?: string;
  slot?: { asUint(): bigint }; offset?: { asUint(): bigint };
  length?: { asUint(): bigint } };
const resolved = (r: LibRegion, role: ResolvedRegion["role"],
  instance: string): ResolvedRegion => ({
  location: r.location as ResolvedRegion["location"],
  ...(r.name !== undefined ? { name: r.name } : {}),
  ...(r.slot ? { slot: r.slot.asUint() } : {}),
  offset: Number(r.offset?.asUint() ?? 0n),
  length: Number(r.length?.asUint() ?? 32n),
  role, instance,
});

export function decode(p: Project, d: Decoding, point: PointId):
  Promise<Decoded> {
  const k = `decode|${d.id}|${point}`;
  if (!p.memo.has(k)) {
    const run = decodeAt(p, d, point);
    run.catch(() => p.memo.get(k) === run && p.memo.delete(k));
    p.memo.set(k, run);
  }
  return p.memo.get(k) as Promise<Decoded>;
}

// The base slot of a state variable: its region's, or its template's
// (a pointer that brings its own templates, bugc's: its `in` region's)
const baseSlot = (v: Variable): Hex => {
  const p = v.pointer as { slot?: string; define?: { slot?: string };
    in?: { slot?: string } };
  return slotHex(toBig(String(p.slot ?? p.define?.slot ?? p.in?.slot)));
};
// A variable's own pointer to its value (bugc's: a collection, its
// templates in it), or none: solc's, a region or a reference, its type's
// template from its base slot
const ownPointer = (v: Variable) => {
  const p = v.pointer as unknown as Record<string, unknown>;
  return ["templates", "group", "list", "if"].some((k) => k in p)
    ? v.pointer : undefined;
};

async function decodeAt(p: Project, d: Decoding, point: PointId):
  Promise<Decoded> {
  const at = await p.point(d.timeline, point);
  const c = await p.compilation(d.compilation);
  const state = machineState(at.snapshot);
  if (d.variables === "locals" && d.locals) {
    const got = await decodeLocals(c, { ...at, locals: d.locals }, d.id);
    return decoded(d.id, point, nested(got.tree), new Map(got.graphs));
  }
  if (d.variables === "locals") return decodeLocals(c, at, d.id);
  if (d.variables === "scope") return decodeScope(p, d, c, at);
  if (d.variables === "abi") {
    const tree = abiTree(at.snapshot.calldata ?? new Uint8Array(),
      d.abi!.param);
    return decoded(d.id, point, tree, new Map());
  }
  const vars = c.stateVariables.filter((v) => {
    const q = v.pointer as { location?: string; define?: object };
    return q.location === "storage" || q.define !== undefined ||
      JSON.stringify(q).includes('"storage"');
  });
  // mappings last: their keys may come from a list decoded first
  const done = new Map<Variable, ValueNode>();
  const graphs = new Map<string, DerefGraph>();
  const kind = (v: Variable) => c.types[typeIdOf(v)] &&
    as(c.types[typeIdOf(v)]).kind;
  for (const v of vars.filter((x) => kind(x) !== "mapping")) {
    done.set(v, await variable(c, v, state, undefined, graphs));
  }
  for (const v of vars.filter((x) => kind(x) === "mapping")) {
    const keys = keysFor(d, [...done.values()], at.transaction,
      baseSlot(v));
    done.set(v, await variable(c, v, state, keys, graphs));
  }
  return decoded(d.id, point, vars.map((v) => done.get(v)!), graphs);
}

// Everything in scope at a moment (addendum §6): the storage variables
// (by the compiler's types and templates, as "state"; a compiler whose
// variables carry their types inline, bugc's: as its context lists them)
// and the locals the moment's context lists, under one group each
// ("@storage", "@locals")
async function decodeScope(p: Project, d: Decoding, c: Compilation,
  at: TimelinePoint): Promise<Decoded> {
  const named = new Set(c.stateVariables.map((v) => v.identifier));
  const typed = c.stateVariables.some((v) => c.types[typeIdOf(v)]);
  const st = typed ? await decodeAt(p, { ...d, variables: "state" }, at.id)
    : await decodeLocals(c, { ...at, scope: undefined, record: undefined,
      // (the program's own variables, whether the moment's context
      // lists them or not: a moment's locals leave them out)
      locals: c.stateVariables as unknown as Local[] });
  const lo = await decodeLocals(c, { ...at, locals: (at.locals ?? [])
    .filter((v) => !named.has(v.identifier)) });
  const group = (path: string, label: string, children: ValueNode[]):
    ValueNode => ({ path, label, root: path, type: "", typeText: "",
    kind: "group", regions: [], children,
    summary: `${children.length} ${children.length === 1 ? "variable"
      : "variables"}` });
  return decoded(d.id, at.id, [group("@storage", "storage", st.tree),
    group("@locals", "locals", lo.tree)],
  new Map([...st.graphs, ...lo.graphs]));
}

// Locals whose identifiers are dotted ("keccak scratch.key"), as the
// members of a group ("keccak scratch"), in their order; the others as
// they are
export function nested(tree: ValueNode[]): ValueNode[] {
  const out: ValueNode[] = [];
  for (const n of tree) {
    const at = n.path.indexOf(".");
    if (at < 0) {
      out.push(n);
      continue;
    }
    const root = n.path.slice(0, at);
    let g = out.find((x) => x.path === root);
    if (!g) {
      out.push(g = { path: root, label: root, root, type: "",
        typeText: "", kind: "record", regions: [], children: [] });
    }
    g.children!.push({ ...n, root, label: n.path.slice(at + 1) });
  }
  return out.map((g) => g.kind === "record"
    ? { ...g, summary: `${g.children!.length} fields` } : g);
}

// a tree, indexed by path
function decoded(decoding: string, point: PointId, tree: ValueNode[],
  graphs: Map<string, DerefGraph>): Decoded {
  const byPath = new Map<string, ValueNode>();
  const index = (n: ValueNode) => {
    byPath.set(n.path, n);
    n.children?.forEach(index);
  };
  tree.forEach(index);
  return { decoding, point, tree, byPath, graphs, layouts: {} };
}

// The locals of a point (a moment's: engine/moment.ts), decoded with a
// compilation's templates: a Variables tree (addendum §6)
export async function decodeLocals(c: Compilation, at: TimelinePoint,
  decoding = "locals"): Promise<Decoded> {
  const graphs = new Map<string, DerefGraph>();
  const tree = await localsAt(c, at, machineState(at.snapshot), graphs);
  return decoded(decoding, at.id, tree, graphs);
}

const hex4 = (n: number) => "0x" + n.toString(16).padStart(4, "0");

// The locals an instruction's context lists at a point (vanilla decode.js
// decodeLocals, mem.js sideTree, recordNode): each one dereferenced by
// the library against the point's state, in memory, on the stack, in
// calldata (a pointer that reads a part the state lacks is left out: a
// fixture's point has memory only); one listed with no pointer has no
// location there; one that cannot be read there says why. Inside a function (the point's
// scope), its locals are under one node for it, which owns the frame
// pointer they are found from, if any. Then a storage slot the page
// reads by its own rule (alice's record).
async function localsAt(c: Compilation, at: TimelinePoint, state: State,
  graphs: Map<string, DerefGraph>): Promise<ValueNode[]> {
  const out: ValueNode[] = [];
  for (const v of at.locals ?? []) {
    const type = v.type as Format.Type;
    const node: ValueNode = { path: v.identifier, label: v.identifier,
      root: v.identifier, type: "", typeText: typeName(type, {}),
      regions: [] };
    if (!v.pointer) {
      out.push({ ...node, none: true });
      continue;
    }
    const json = JSON.stringify(v.pointer);
    const has = { memory: at.snapshot.memory, stack: at.snapshot.stack,
      calldata: at.snapshot.calldata };
    if (Object.entries(has).some(([l, x]) => !x &&
      json.includes(`"${l}"`))) continue;
    if (!isValueType(type, {})) {
      out.push({ ...node, note: `a ${node.typeText}: not shown yet` });
      continue;
    }
    try {
      const pointer = v.pointer as Pointer;
      const ids = await graphOf(c, v.identifier, pointer, state, [],
        graphs, async () => [...(await viewOf(pointer, state, c)).regions]);
      const view = await viewOf(pointer, state, c);
      const all = [...view.regions] as unknown as LibRegion[];
      // (its own region by its name; else the last one)
      const named = all.map((r) => r.name).lastIndexOf(v.identifier);
      const k = named >= 0 ? named : all.length - 1;
      const bytes = await view.read(view.regions[k]);
      out.push({ ...node, value: decodeValue(type, bytes, {}),
        regions: [resolved(all[k], "value", ids[k])],
        reads: all.flatMap((r, i) => i === k ? [] : [resolved(r, "value",
          ids[i])]) });
    } catch (e) {
      out.push({ ...node, note: `not read here: ${
        (e as Error)?.message ?? e}` });
    }
  }
  // (those with no location after those with one: vanilla mem.js localsAt)
  out.sort((a, b) => Number(!!a.none) - Number(!!b.none));
  let tree = out;
  if (at.scope) {
    const frame = out.flatMap((n) => n.reads ?? [])
      .find((r) => r.name === "-frame");
    const word = frame && at.snapshot.memory!.slice(frame.offset,
      frame.offset + 32);
    const addr = word && Number(toBig(toHex(word)));
    tree = [{ path: at.scope, label: at.scope, root: at.scope, type: "",
      typeText: "function", kind: "group", regions: frame ? [frame] : [],
      value: { text: word ? `frame at ${hex4(addr!)}` : "inlined: no frame",
        hex: word ? toHex(word) : "0x" }, children: out }];
  }
  const r = at.record;
  if (r) {
    const w = BigInt(at.snapshot.storage.get(r.slot)!);
    let low = 0;
    const children = r.members.map(([name, n]): ValueNode => {
      const v = (w >> BigInt(8 * low)) & ((1n << BigInt(8 * n)) - 1n);
      const offset = 32 - low - n;
      low += n;
      return { path: `${r.path}.${name}`, label: name, root: r.path,
        type: "", typeText: `uint${8 * n}`,
        value: { text: String(v), hex: `0x${v.toString(16)}` },
        regions: [{ location: "storage", slot: BigInt(r.slot), offset,
          length: n, role: "value", instance: "" }] };
    });
    tree = [...tree, { path: r.path, label: r.path, root: r.path,
      type: "", typeText: "Player", kind: "record", regions: [],
      value: { text: `slot ${short(r.slot)}`, hex: r.slot }, children }];
  }
  return tree;
}

// The graph of a variable's pointer (deref/walk), checked against the
// library's regions (in dev and in tests); its region instances, in
// order, name the regions the values own
async function graphOf(c: Compilation, root: string, pointer: Pointer,
  state: State, inputs: InputNode[], graphs: Map<string, DerefGraph>,
  library: () => Promise<unknown[]>): Promise<string[]> {
  const g = await walkGraph(pointer, { state, templates: c.templates,
    inputs, root });
  graphs.set(root, g);
  if (import.meta.env?.DEV || import.meta.env?.MODE === "test") {
    sameAsLibrary(g, await library() as never);
  }
  return regionsOf(g).map((r) => r.instance);
}

async function variable(c: Compilation, v: Variable, state: State,
  keys: InputNode | undefined, graphs: Map<string, DerefGraph>):
  Promise<ValueNode> {
  const id = v.identifier;
  const typeId = typeIdOf(v);
  const type = c.types[typeId];
  const node: ValueNode = { path: id, label: id, root: id, type: typeId,
    typeText: type ? typeName(type, c.types) : "", regions: [] };
  if (!type) return { ...node, note: `no ethdebug type ${typeId}` };
  if (isValueType(type, c.types)) {
    return contextValue(node, v, type, c.types, state, graphs);
  }
  // (bugc's: its pointer as it is; a mapping's, its entries by its own
  // template, from its base slot)
  const own = ownPointer(v) as { templates?: Record<string, unknown> } |
    undefined;
  const entry = own?.templates && Object.keys(own.templates)[0];
  const base = own && !entry ? "0x" as Hex : baseSlot(v);
  const at = (d: Record<string, unknown>) => (own && !entry ? own
    : own ? { templates: own.templates, in: { define: d,
      in: { template: entry } } }
      : { define: d, in: { template: typeId } }) as unknown as Pointer;
  const root = at({ slot: base });
  if (as(type).kind === "mapping") {
    const ks = keys?.values.map((x) => x.value) ?? [];
    const ids = await graphOf(c, id, root, state, keys ? [keys] : [],
      graphs, async () => {
        const out: unknown[] = [];
        for (const key of ks) {
          const view = await viewOf(at({ slot: base, key }), state, c);
          out.push(...view.regions);
        }
        return out;
      });
    const t = as(type);
    const keyType = c.types[t.contains.key.type.id];
    const valueId: string = t.contains.value.type.id;
    const children: ValueNode[] = [];
    let from = 0;
    for (const key of ks) {
      const k = isDynBytes(as(keyType)) ? Data.fromHex(key)
        : Data.fromHex(key).resizeTo(32);
      const keyText = decodeValue(keyType, k, c.types).text;
      const path = `${id}[${keyText}]`;
      const scope = await instantiate(at({ slot: base, key }), state, c,
        ids.slice(from));
      from += scope.count;
      children.push(await walk(c, scope, valueId, "value",
        { ...node, path, label: `[${keyText}]`, type: valueId,
          typeText: typeName(c.types[valueId], c.types) }));
    }
    return withSummary({ ...node, children });
  }
  const ids = await graphOf(c, id, root, state, [], graphs, async () =>
    [...(await viewOf(root, state, c)).regions]);
  const scope = await instantiate(root, state, c, ids);
  return walk(c, scope, typeId, "", node);
}

const withSummary = (n: ValueNode): ValueNode => {
  const s = summary(n);
  return s === undefined ? n : { ...n, summary: s };
};

// A value type has no template: its pointer in the program-level context
// is the region. With no offset, the value starts at byte 0; with no
// length, it fills the word.
async function contextValue(node: ValueNode, v: Variable,
  type: Format.Type, types: Types, state: State,
  graphs: Map<string, DerefGraph>): Promise<ValueNode> {
  const p = v.pointer as { slot?: unknown; offset?: unknown;
    length?: unknown };
  const region = { location: "storage", slot: p.slot,
    offset: p.offset ?? 0, length: p.length ?? 32 } as Pointer;
  const cursor = await dereference(region, { state });
  const view = await cursor.view(state);
  const r = view.regions[0];
  const bytes = await view.read(r);
  const [instance] = await graphOf({ templates: {} } as never,
    v.identifier, region, state, [], graphs, async () => [r]);
  return { ...node, value: decodeValue(type, bytes, types),
    regions: [resolved(r as unknown as LibRegion, "value", instance)] };
}

// The regions of one dereference, taken by name in order
interface Scope {
  count: number;
  has(name: string): boolean;
  take(name: string): Promise<{ bytes: Uint8Array; index: number;
    region: ResolvedRegion }>;
  lengthParts(prefix: string, index: number): ResolvedRegion[];
}

async function viewOf(pointer: Pointer, state: State, c: Compilation) {
  const cursor = await dereference(pointer,
    { state, templates: c.templates });
  return cursor.view(state);
}

// `ids`: the graph's instance of each region, in order
async function instantiate(pointer: Pointer, state: State, c: Compilation,
  ids: string[]): Promise<Scope> {
  const view = await viewOf(pointer, state, c);
  const all = [...view.regions] as unknown as LibRegion[];
  const used = new Map<string, number>();
  const at = (i: number, role: ResolvedRegion["role"]) =>
    resolved(all[i], role, ids[i]);
  return {
    count: all.length,
    has: (name) => view.regions.named(name).length > 0,
    async take(name) {
      const list = view.regions.named(name);
      const i = used.get(name) ?? 0;
      used.set(name, i + 1);
      if (!list[i]) throw new Error(`no region named ${name} (#${i})`);
      const index = all.indexOf(list[i] as unknown as LibRegion);
      const bytes = await view.read(list[i]);
      return { bytes, index, region: at(index, "value") };
    },
    // the regions a string or bytes value reads to find its length: the
    // nearest "length-flag" before its data, and a "long-length" between
    // (or a length word of its own: Vyper's, "length")
    lengthParts(prefix, index) {
      const flag = join(prefix, "length-flag");
      const long = join(prefix, "long-length");
      const word = join(prefix, "length");
      let f = index - 1;
      while (f >= 0 && all[f].name !== flag && all[f].name !== word) f--;
      if (f < 0) return [];
      const parts = [at(f, "length")];
      for (let i = f + 1; i < index; i++) {
        if (all[i].name === long) parts.push(at(i, "length"));
      }
      return parts;
    },
  };
}

async function walk(c: Compilation, scope: Scope, typeId: string,
  prefix: string, node: ValueNode): Promise<ValueNode> {
  const { types } = c;
  const type = types[typeId];
  const t = as(type);
  if (t.kind === "alias" && !isValueType(type, types)) {
    return walk(c, scope, t.contains.type.id, prefix, node);
  }
  if (isValueType(type, types) || isDynBytes(t)) {
    const name = isDynBytes(t) ? join(prefix, "data") : prefix;
    const r = await scope.take(name);
    return { ...node, value: decodeValue(type, r.bytes, types),
      regions: [r.region, ...(isDynBytes(t)
        ? scope.lengthParts(prefix, r.index) : [])] };
  }
  if (t.kind === "struct") {
    const children: ValueNode[] = [];
    for (const m of t.contains as { name: string; type: { id: string } }[]) {
      children.push(await walk(c, scope, m.type.id,
        join(prefix, memberRegion(m.name)), { ...node,
          path: `${node.path}.${m.name}`, label: m.name, type: m.type.id,
          typeText: typeName(types[m.type.id], types), regions: [] }));
    }
    return withSummary({ ...node, children });
  }
  if (t.kind === "array") {
    const elem: string = t.contains.type.id;
    let count: number;
    const regions: ResolvedRegion[] = [];
    if (t.count !== undefined) count = Number(t.count);
    else {
      // (solc's "length"; bugc's "array-length")
      const r = await scope.take(scope.has(join(prefix, "length"))
        ? join(prefix, "length") : join(prefix, "array-length"));
      count = Number(toBig(toHex(r.bytes)));
      regions.push({ ...r.region, role: "length" });
    }
    const children: ValueNode[] = [];
    // (solc's "item"; bugc's "element")
    const item = scope.has(join(prefix, "item")) || !count
      ? join(prefix, "item") : join(prefix, "element");
    for (let i = 0; i < count; i++) {
      children.push(await walk(c, scope, elem, item,
        { ...node, path: `${node.path}[${i}]`, label: `[${i}]`,
          type: elem, typeText: typeName(types[elem], types),
          regions: [] }));
    }
    return withSummary({ ...node, regions, children });
  }
  if (t.kind === "mapping") {
    return { ...node, note: "a mapping inside another value: not shown " +
      "(needs chaining templates; see the notes below)" };
  }
  throw new Error(`unsupported type kind ${t.kind}`);
}

