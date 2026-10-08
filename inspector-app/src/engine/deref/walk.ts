// The dereference graph of one variable (spec §1.5, §3.1-3.2): walk its
// pointer as the library does (vanilla decode.js replay), and record an
// Instance for each AST node each time it is evaluated, with the data
// it used (the edges), deduped into one RuleNode per AST node. Values
// come from the library's own evaluate(); this only follows structure.
import { Data, evaluate, type Machine } from "../lib";
import type {
  DerefGraph, Format, Hex, InputNode, Instance, InstanceId, NodeId,
  NodeKind, ResolvedRegion, RuleNode,
} from "../types";

type P = any; // a pointer node, as JSON
type Value = { sort: "integer"; value: bigint } | { sort: "bytes";
  data: Data };
type Source = { instance?: InstanceId; input?: string };

const isRegion = (p: P) => typeof p === "object" && "location" in p;
const toData = (v: Value) => v.sort === "bytes" ? v.data
  : Data.fromUint(v.value);
const hexOf = (v: Value) => toData(v).toHex() as Hex;
const asInt = (v: Value) => v.sort === "bytes" ? v.data.asUint() : v.value;
const hasOwn = (o: object, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);
const lengthy = /(^|-)(length|length-flag|long-length)$/;

// The variables and regions an expression reads
function reads(expr: unknown, vars: Set<string>, regions: Set<string>) {
  if (typeof expr === "string") {
    if (!expr.startsWith("$") && !/^0x/i.test(expr) && !/^\d+$/.test(expr)) {
      vars.add(expr);
    }
  } else if (Array.isArray(expr)) {
    expr.forEach((e) => reads(e, vars, regions));
  } else if (expr && typeof expr === "object") {
    for (const [op, arg] of Object.entries(expr)) {
      if (op === "$read" || /^\.(slot|offset|length)$/.test(op)) {
        if (typeof arg === "string") regions.add(arg);
      } else reads(arg, vars, regions);
    }
  }
}

export async function walk(pointer: Format.Pointer, o: {
  state: Machine.State; templates: Format.Pointer.Templates;
  inputs: InputNode[]; root: string }): Promise<DerefGraph> {
  const nodes = new Map<NodeId, RuleNode & { instances: Instance[] }>();
  const templates = o.templates as Record<string, { expect?: string[];
    for: P }>;
  let seq = 0;

  const node = (id: NodeId, kind: NodeKind, ast: P, template?: string,
    parent?: NodeId) => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, kind, ast, instances: [],
        ...(template ? { template } : {}), ...(parent ? { parent } : {}) });
    }
    return nodes.get(id)!;
  };

  // one walk of the pointer: once, or once per input value (an entry)
  const entries = o.inputs.length
    ? o.inputs[0].values.map((v) => v.value) : [undefined];
  for (const entry of entries) {
    const regions: Record<string, unknown> = Object.create(null);
    const saved: Record<string, InstanceId> = Object.create(null);
    const renames: Record<string, string>[] = [];
    // the instances the walk is inside (templates, defines, lists,
    // conditionals: not groups), outermost first
    const chain: InstanceId[] = [];
    const inside = async <T>(i: Instance, f: () => Promise<T>) => {
      chain.push(i.id);
      try {
        return await f();
      } finally {
        chain.pop();
      }
    };
    const ev = (expr: unknown, variables: Record<string, Value>) =>
      evaluate(expr as never, { state: o.state, regions: { ...regions } as
        never, variables: variables as never }) as Promise<Value>;

    // a new instance of a node, with the edges of the expressions it
    // evaluates (`exprs`), in a scope (`scope`: name -> its source)
    const instance = (n: RuleNode, scope: Record<string, Source>,
      vals: Record<string, Value>, exprs: unknown[]): Instance => {
      const vars = new Set<string>();
      const rs = new Set<string>();
      exprs.forEach((e) => reads(e, vars, rs));
      const uses: InstanceId[] = [];
      const inputs: string[] = [];
      const bindings: Record<string, Hex> = {};
      for (const v of vars) {
        const s = scope[v];
        if (s?.instance && !uses.includes(s.instance)) uses.push(s.instance);
        if (s?.input && !inputs.includes(s.input)) inputs.push(s.input);
        if (vals[v]) bindings[v] = hexOf(vals[v]);
      }
      for (const r of rs) {
        if (saved[r] && !uses.includes(saved[r])) uses.push(saved[r]);
      }
      const i: Instance = { id: `${n.id}@${seq++}`, node: n.id,
        ...(entry ? { entry } : {}), bindings, uses, inputs,
        within: [...chain] };
      n.instances.push(i);
      return i;
    };

    const go = async (p: P, vals: Record<string, Value>,
      scope: Record<string, Source>, block: string, at: string,
      parent?: NodeId): Promise<void> => {
      const id = `${block}#${at}`;
      const tpl = block === o.root ? undefined : block;
      if (isRegion(p)) {
        const kind = block === o.root && parent === undefined
          ? "declared" : "region";
        const n = node(id, kind, p, tpl, parent);
        const region: Record<string, unknown> = { ...p };
        const exprs: unknown[] = [];
        for (const k of ["slot", "offset", "length"]) {
          if (!(k in p)) continue;
          region[k] = toData(await ev(p[k], vals));
          exprs.push(p[k]);
        }
        const name = renames.reduceRight(
          (x, m) => (x !== undefined && hasOwn(m, x) ? m[x] : x),
          p.name as string | undefined);
        const i = instance(n, scope, vals, exprs);
        const r = region as { slot?: Data; offset?: Data; length?: Data };
        i.region = {
          location: p.location, ...(name !== undefined ? { name } : {}),
          ...(r.slot ? { slot: r.slot.asUint() } : {}),
          offset: Number(r.offset?.asUint() ?? 0n),
          length: Number(r.length?.asUint() ?? 32n),
          role: name && lengthy.test(name) ? "length" : "value",
          instance: i.id,
        } as ResolvedRegion;
        if (p.name !== undefined) {
          regions[p.name] = region;
          saved[p.name] = i.id;
        }
        return;
      }
      if ("group" in p) {
        const n = node(id, "group", p, tpl, parent);
        instance(n, scope, vals, []);
        for (const [k, child] of (p.group as P[]).entries()) {
          await go(child, vals, scope, block, `${at}/group/${k}`, id);
        }
        return;
      }
      if ("list" in p) {
        const { count, each, is } = p.list;
        const n = node(id, "list", p, tpl, parent);
        const c = await ev(count, vals);
        const i = instance(n, scope, vals, [count]);
        await inside(i, async () => {
          for (let k = 0n; k < asInt(c); k++) {
            const v: Value = { sort: "integer", value: k };
            // (the item's `each` is bound by the list's instance)
            await go(is, { ...vals, [each]: v },
              { ...scope, [each]: { instance: i.id } }, block,
              `${at}/list/is`, id);
          }
        });
        return;
      }
      if ("if" in p) {
        const n = node(id, "conditional", p, tpl, parent);
        const c = await ev(p.if, vals);
        const branch = asInt(c) ? "then" : "else";
        const i = instance(n, scope, vals, [p.if]);
        i.branch = branch;
        if (p[branch] === undefined) return;
        await inside(i, () => go(p[branch], vals, scope, block,
          `${at}/${branch}`, id));
        return;
      }
      if ("define" in p) {
        const v2 = { ...vals };
        const s2 = { ...scope };
        const defs: Instance[] = [];
        for (const [name, expr] of Object.entries(p.define as object)) {
          const did = `${id}/define/${name}`;
          const kind = block === o.root && parent === undefined
            ? "declared" : "define";
          const n = node(did, kind, expr, tpl, parent);
          const value = await ev(expr, v2);
          const i = instance(n, s2, v2, [expr]);
          i.value = hexOf(value);
          v2[name] = value;
          s2[name] = { instance: i.id };
          defs.push(i);
          chain.push(i.id);
        }
        try {
          await go(p.in, v2, s2, block, `${at}/in`, id);
        } finally {
          chain.splice(chain.length - defs.length, defs.length);
        }
        return;
      }
      if ("template" in p) {
        const t = templates[p.template];
        if (!t) throw new Error(`no template ${p.template}`);
        const n = node(`${p.template}#`, "template", p, p.template, id);
        const ti = instance(n, scope, vals, t.expect ?? []);
        const yields: Record<string, string> = p.yields ?? {};
        renames.push(yields);
        await inside(ti, () => go(t.for, vals, scope, p.template, "/for",
          n.id));
        renames.pop();
        for (const [from, to] of Object.entries(yields)) {
          if (from in regions && to !== from) {
            regions[to] = { ...(regions[from] as object), name: to };
            saved[to] = saved[from];
          }
        }
        return;
      }
      throw new Error(`walk: unsupported pointer ${JSON.stringify(p)}`);
    };

    const vals: Record<string, Value> = {};
    const scope: Record<string, Source> = {};
    for (const input of o.inputs) {
      const v = input.values.find((x) => x.value === entry)?.value ??
        input.values[0]?.value;
      if (v === undefined) continue;
      vals[input.name] = { sort: "bytes", data: Data.fromHex(v) };
      scope[input.name] = { input: input.id };
    }
    await go(pointer, vals, scope, o.root, "");
  }

  return { root: o.root, nodes, inputs: o.inputs,
    order: preOrder(pointer, o.root, templates).filter((id) =>
      nodes.has(id)) };
}

// The node ids of the expanded pointer, in document order (a
// conditional's if, then, else; a scope's defines, then its `in`); each
// template expanded once
function preOrder(pointer: P, root: string,
  templates: Record<string, { for: P }>): NodeId[] {
  const out: NodeId[] = [];
  const seen = new Set<string>();
  const go = (p: P, block: string, at: string) => {
    const id = `${block}#${at}`;
    if (!p || typeof p !== "object") return;
    if (isRegion(p)) return void out.push(id);
    if ("group" in p) {
      out.push(id);
      (p.group as P[]).forEach((c, k) => go(c, block, `${at}/group/${k}`));
    } else if ("list" in p) {
      out.push(id);
      go(p.list.is, block, `${at}/list/is`);
    } else if ("if" in p) {
      out.push(id);
      for (const b of ["then", "else"]) {
        if (p[b] !== undefined) go(p[b], block, `${at}/${b}`);
      }
    } else if ("define" in p) {
      for (const name of Object.keys(p.define)) {
        out.push(`${id}/define/${name}`);
      }
      go(p.in, block, `${at}/in`);
    } else if ("template" in p) {
      out.push(`${p.template}#`);
      if (seen.has(p.template)) return;
      seen.add(p.template);
      go(templates[p.template]?.for, p.template, "/for");
    }
  };
  go(pointer, root, "");
  return out;
}
