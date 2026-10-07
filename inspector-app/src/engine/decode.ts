// A decoding at one timeline point: the value tree, each value's bytes
// from the library's dereference() (vanilla decode.js decodeStorage,
// walk, walkMapping, instantiate's take and lengthParts)
import { dereference, Data, type Pointer } from "./lib";
import type {
  Compilation, Decoded, Decoding, Format, Hex, PointId, ResolvedRegion,
  TxFacts, ValueNode, Variable,
} from "./types";
import type { Project } from "./project";
import { machineState } from "./snapshot";
import { decodeValue, isValueType, summary, typeName } from "./values";
import { keysFor } from "./keys";
import { slotHex, toBig, toHex } from "./hex";

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
const baseSlot = (v: Variable): Hex => {
  const p = v.pointer as { slot?: string; define?: { slot?: string } };
  return slotHex(toBig(String(p.slot ?? p.define?.slot)));
};

async function decodeAt(p: Project, d: Decoding, point: PointId):
  Promise<Decoded> {
  const timeline = await p.timeline(d.timeline);
  const c = await p.compilation(d.compilation);
  const at = timeline.points.find((x) => x.id === point);
  if (!at) throw new Error(`no point ${point} in ${d.timeline}`);
  const state = machineState(at.snapshot);
  const vars = c.stateVariables.filter((v) => {
    const q = v.pointer as { location?: string; define?: object };
    return q.location === "storage" || q.define !== undefined;
  });
  // mappings last: their keys may come from a list decoded first
  const done = new Map<Variable, ValueNode>();
  const kind = (v: Variable) => c.types[typeIdOf(v)] &&
    as(c.types[typeIdOf(v)]).kind;
  for (const v of vars.filter((x) => kind(x) !== "mapping")) {
    done.set(v, await variable(c, v, state, []));
  }
  for (const v of vars.filter((x) => kind(x) === "mapping")) {
    const keys = keysFor(d, [...done.values()], at.transaction,
      baseSlot(v)).values.map((x) => x.value);
    done.set(v, await variable(c, v, state, keys));
  }
  const tree = vars.map((v) => done.get(v)!);
  const byPath = new Map<string, ValueNode>();
  const index = (n: ValueNode) => {
    byPath.set(n.path, n);
    n.children?.forEach(index);
  };
  tree.forEach(index);
  return { decoding: d.id, point, tree, byPath, graphs: new Map(),
    layouts: {} };
}

async function variable(c: Compilation, v: Variable, state: State,
  keys: Hex[]): Promise<ValueNode> {
  const id = v.identifier;
  const typeId = typeIdOf(v);
  const type = c.types[typeId];
  const node: ValueNode = { path: id, label: id, root: id, type: typeId,
    typeText: type ? typeName(type, c.types) : "", regions: [] };
  if (!type) return { ...node, note: `no ethdebug type ${typeId}` };
  if (isValueType(type, c.types)) {
    return contextValue(node, v, type, c.types, state);
  }
  const base = baseSlot(v);
  if (as(type).kind === "mapping") {
    const t = as(type);
    const keyType = c.types[t.contains.key.type.id];
    const valueId: string = t.contains.value.type.id;
    const children: ValueNode[] = [];
    for (const key of keys) {
      const k = isDynBytes(as(keyType)) ? Data.fromHex(key)
        : Data.fromHex(key).resizeTo(32);
      const keyText = decodeValue(keyType, k, c.types).text;
      const path = `${id}[${keyText}]`;
      const scope = await instantiate({ define: { slot: base, key },
        in: { template: typeId } } as unknown as Pointer, state, c, path);
      children.push(await walk(c, scope, valueId, "value",
        { ...node, path, label: `[${keyText}]`, type: valueId,
          typeText: typeName(c.types[valueId], c.types) }));
    }
    return withSummary({ ...node, children });
  }
  const scope = await instantiate({ define: { slot: base },
    in: { template: typeId } } as unknown as Pointer, state, c, id);
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
  type: Format.Type, types: Types, state: State): Promise<ValueNode> {
  const p = v.pointer as { slot?: unknown; offset?: unknown;
    length?: unknown };
  const region = { location: "storage", slot: p.slot,
    offset: p.offset ?? 0, length: p.length ?? 32 } as Pointer;
  const cursor = await dereference(region, { state });
  const view = await cursor.view(state);
  const r = view.regions[0];
  const bytes = await view.read(r);
  return { ...node, value: decodeValue(type, bytes, types),
    regions: [resolved(r as unknown as LibRegion, "value",
      `${v.identifier}#0`)] };
}

// The regions of one dereference, taken by name in order
interface Scope {
  take(name: string): Promise<{ bytes: Uint8Array; index: number;
    region: ResolvedRegion }>;
  lengthParts(prefix: string, index: number): ResolvedRegion[];
}

async function instantiate(pointer: Pointer, state: State, c: Compilation,
  root: string): Promise<Scope> {
  const cursor = await dereference(pointer,
    { state, templates: c.templates });
  const view = await cursor.view(state);
  const all = [...view.regions] as unknown as LibRegion[];
  const used = new Map<string, number>();
  const at = (i: number, role: ResolvedRegion["role"]) =>
    resolved(all[i], role, `${root}#${i}`);
  return {
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
    lengthParts(prefix, index) {
      const flag = join(prefix, "length-flag");
      const long = join(prefix, "long-length");
      let f = index - 1;
      while (f >= 0 && all[f].name !== flag) f--;
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
      const r = await scope.take(join(prefix, "length"));
      count = Number(toBig(toHex(r.bytes)));
      regions.push({ ...r.region, role: "length" });
    }
    const children: ValueNode[] = [];
    for (let i = 0; i < count; i++) {
      children.push(await walk(c, scope, elem, join(prefix, "item"),
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

