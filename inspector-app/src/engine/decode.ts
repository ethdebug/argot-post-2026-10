// A decoding at one timeline point: the value tree, each value's bytes
// from the library's dereference() (vanilla decode.js decodeStorage).
// This task: value-type variables.
import { dereference, type Pointer } from "./lib";
import type {
  Decoded, Decoding, Format, PointId, ResolvedRegion, ValueNode, Variable,
} from "./types";
import type { Project } from "./project";
import { machineState } from "./snapshot";
import { decodeValue, isValueType, typeName } from "./values";

type Region = { location: string; slot?: unknown; offset?: unknown;
  length?: unknown };
const typeOf = (v: Variable, types: Record<string, Format.Type>) =>
  "id" in v.type ? types[(v.type as { id: string }).id]
    : v.type as Format.Type;
const typeIdOf = (v: Variable) =>
  "id" in v.type ? (v.type as { id: string }).id : "";

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

async function decodeAt(p: Project, d: Decoding, point: PointId):
  Promise<Decoded> {
  const timeline = await p.timeline(d.timeline);
  const c = await p.compilation(d.compilation);
  const at = timeline.points.find((x) => x.id === point);
  if (!at) throw new Error(`no point ${point} in ${d.timeline}`);
  const state = machineState(at.snapshot);
  const tree: ValueNode[] = [];
  for (const v of c.stateVariables) {
    const type = typeOf(v, c.types);
    if (!type || !isValueType(type, c.types)) continue;
    tree.push(await contextValue(v, type, c.types, state));
  }
  const byPath = new Map<string, ValueNode>();
  const index = (n: ValueNode) => {
    byPath.set(n.path, n);
    n.children?.forEach(index);
  };
  tree.forEach(index);
  return { decoding: d.id, point, tree, byPath, graphs: new Map(),
    layouts: {} };
}

// A value type has no template: its pointer in the program-level context
// is the region. With no offset, the value starts at byte 0; with no
// length, it fills the word.
async function contextValue(v: Variable, type: Format.Type,
  types: Record<string, Format.Type>,
  state: ReturnType<typeof machineState>): Promise<ValueNode> {
  const p = v.pointer as Region;
  const region = { location: "storage", slot: p.slot,
    offset: p.offset ?? 0, length: p.length ?? 32 } as Pointer;
  const cursor = await dereference(region, { state });
  const view = await cursor.view(state);
  const r = view.regions[0];
  const bytes = await view.read(r);
  return {
    path: v.identifier, label: v.identifier, root: v.identifier,
    type: typeIdOf(v), typeText: typeName(type, types),
    value: decodeValue(type, bytes, types),
    regions: [resolved(r as unknown as LibRegion, `${v.identifier}#`)],
  };
}

type LibRegion = { location: string; name?: string;
  slot?: { asUint(): bigint }; offset?: { asUint(): bigint };
  length?: { asUint(): bigint } };
const resolved = (r: LibRegion, instance: string): ResolvedRegion => ({
  location: r.location as ResolvedRegion["location"],
  ...(r.name !== undefined ? { name: r.name } : {}),
  ...(r.slot ? { slot: r.slot.asUint() } : {}),
  offset: Number(r.offset?.asUint() ?? 0n),
  length: Number(r.length?.asUint() ?? 32n),
  role: "value", instance,
});
