// What a dump draws (vanilla panel.js buildPanel, slotName, whatIn):
// the rows (one word each, in address order, gaps marked), which value
// owns each byte, and each row's label, "how : what". How a slot is
// found comes from the dereference graph (the define that computed it,
// with its inputs), not from a guess by nearby hashes.
import type {
  ByteKey, Decoded, DerefGraph, Filter, Hex, Instance, Layout, Location,
  Path, ResolvedRegion, Row, ValueNode,
} from "./types";
import { byteKey, short, slotHex, toBig } from "./hex";

const PLAIN = 1n << 32n; // below this, a slot is a plain number

// The words and bytes a region covers. Offsets count from the most
// significant byte; a region longer than the rest of its word goes on
// into the next slots.
export function regionBytes(r: ResolvedRegion): [Hex, number][] {
  if (r.slot === undefined) return [];
  const out: [Hex, number][] = [];
  for (let k = 0; k < r.length; k++) {
    const at = r.offset + k;
    out.push([slotHex(r.slot + BigInt(Math.floor(at / 32))), at % 32]);
  }
  return out;
}

// "name + 1" + 2 = "name + 3"
const plus = (name: string, k: bigint) => {
  if (!k) return name;
  const m = name.match(/^(.*) \+ (\d+)$/);
  return m ? `${m[1]} + ${BigInt(m[2]) + k}` : `${name} + ${k}`;
};

// How each slot a graph reaches is found: "keccak(0x7099…79c8, slot
// 3)", "keccak(slot 0) + 1", from its defines and regions, in walk order
export function slotNames(graphs: Iterable<DerefGraph>,
  into = new Map<bigint, string>()): Map<bigint, string> {
  const nameOf = (v: bigint) => v < PLAIN ? `slot ${v}`
    : into.get(v) ?? `slot ${short(slotHex(v))}`;
  for (const g of graphs) {
    const all = [...g.nodes.values()].flatMap((n) => n.instances);
    const byId = new Map(all.map((i) => [i.id, i]));
    const ast = (i: Instance) => g.nodes.get(i.node)!.ast as any;
    const inputs = new Set(g.inputs.map((x) => x.name));
    const seq = (i: Instance) => Number(i.id.slice(i.id.lastIndexOf("@") + 1));
    // the nearest define this one used at or below a value
    const base = (i: Instance, v: bigint) => i.uses.map((u) => byId.get(u)!)
      .filter((u) => u.value !== undefined && toBig(u.value) <= v &&
        v - toBig(u.value) < PLAIN)
      .sort((a, b) => Number(toBig(b.value!) - toBig(a.value!)))[0];
    for (const i of all.sort((a, b) => seq(a) - seq(b))) {
      const v = i.value !== undefined ? toBig(i.value)
        : i.region?.slot;
      if (v === undefined || v < PLAIN || into.has(v)) continue;
      const a = ast(i);
      if (i.value !== undefined && a && a.$keccak256) {
        const args = (a.$keccak256 as unknown[]).map((x) => {
          const id = typeof x === "string" ? x
            : (x as { $wordsized?: string }).$wordsized;
          const h = id ? i.bindings[id] : undefined;
          if (!h) return JSON.stringify(x);
          const n = toBig(h);
          return id && inputs.has(id) ? (n < PLAIN ? String(n) : short(h))
            : nameOf(n);
        });
        into.set(v, `keccak(${args.join(", ")})`);
        continue;
      }
      const b = base(i, v);
      if (b) into.set(v, plus(nameOf(toBig(b.value!)), v - toBig(b.value!)));
    }
  }
  return into;
}

// The names of a decoding's rows: its graphs' slots, and the words
// after a region's first ("… + 1")
function rowNames(d: Decoded): Map<bigint, string> {
  const names = slotNames(d.graphs.values());
  for (const n of d.byPath.values()) {
    for (const r of n.regions) {
      const at = r.slot !== undefined && names.get(r.slot);
      if (!at) continue;
      for (const [row] of regionBytes(r)) {
        const v = BigInt(row);
        if (!names.has(v) && v >= PLAIN) {
          names.set(v, plus(at, v - r.slot!));
        }
      }
    }
  }
  return names;
}

const under = (p: Path, root: Path) => p === root ||
  p.startsWith(root + ".") || p.startsWith(root + "[");
const parentOf = (p: Path) =>
  p.match(/^(.*)(\.[^.[\]]+|\[[^\]]*\])$/)?.[1] ?? "";
// accounts[0xf39fd6…92266].nonce -> accounts[0xf39f…2266].nonce
const shortKeys = (path: string) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);

// `others`: decodings of the same point whose words are shown but own
// no bytes here, named from their graphs ("Vyper's keccak(…)")
export function layout(d: Decoded, location: Location, filter: Filter = {},
  others: { d: Decoded; who?: string }[] = []): Layout {
  const cover = new Map<ByteKey, Path[]>();
  const owned = new Map<Path, Set<ByteKey>>();
  // row -> owner groups (a path, or its length part) -> first byte
  const first = new Map<Hex, Map<string, { path: Path; at: number;
    node: ValueNode; length: boolean }>>();
  const roots = filter.roots;
  const kept = (p: Path) => !roots || roots.some((r) => under(p, r));
  const visit = (n: ValueNode) => {
    if (kept(n.path)) {
      for (const r of n.regions) {
        if (r.location !== location) continue;
        // (a string's length parts are an owner of their own, as vanilla)
        const part = r.role === "length" && !n.children;
        const key = part ? `${n.path}#length` : n.path;
        for (const [row, i] of regionBytes(r)) {
          const k = byteKey(location, row, i);
          cover.set(k, [...new Set([...(cover.get(k) ?? []), key])]);
          if (!owned.has(key)) owned.set(key, new Set());
          owned.get(key)!.add(k);
          if (!first.has(row)) first.set(row, new Map());
          const f = first.get(row)!;
          const was = f.get(key);
          if (!was || i < was.at) {
            f.set(key, { path: n.path, at: i, node: n, length: part });
          }
        }
      }
    }
    n.children?.forEach(visit);
  };
  d.tree.forEach(visit);

  // how slots are found: this decoding's graphs, then the others'
  const names = rowNames(d);
  const extra = new Map<Hex, string>();
  for (const o of others) {
    for (const [v, n] of rowNames(o.d)) {
      const h = slotHex(v);
      if (!first.has(h)) extra.set(h, `${o.who ? `${o.who} ` : ""}${n}`);
    }
  }
  // each variable's own slot (a mapping's holds none of its data)
  const own = new Map<Hex, Path>();
  for (const n of d.tree) {
    if (roots && !roots.includes(n.path)) continue;
    const g = d.graphs.get(n.root);
    const declared = g && [...g.nodes.values()].find((x) =>
      x.kind === "declared");
    const v = declared?.instances[0]?.value;
    if (v && !first.has(slotHex(toBig(v)))) own.set(slotHex(toBig(v)), n.path);
  }
  const listed = Array.isArray(filter.rows) ? filter.rows : [];

  const addresses = [...new Set<Hex>([...first.keys(), ...own.keys(),
    ...extra.keys(), ...listed])].sort((a, b) =>
    BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0);
  const how = (a: Hex) => {
    const n = BigInt(a);
    return n < PLAIN ? `slot ${n}` : names.get(n) ?? extra.get(a) ??
      `slot ${short(a)}`;
  };
  let rows: Row[] = addresses.map((address) => {
    const groups = [...(first.get(address)?.values() ?? [])]
      .sort((a, b) => a.at - b.at);
    const one = groups.length === 1;
    const what = own.has(address)
      ? [{ path: own.get(address)!, name: own.get(address)! }]
      : groups.map((g) => {
        const named = one || parentOf(g.path) === "" ? shortKeys(g.path)
          : g.path.slice(parentOf(g.path).length).replace(/^\./, "");
        // (a value's other region by its role, under its name; an
        // array's own word alone in its slot: its length)
        const own = !g.length && !!g.node.children;
        return { path: g.path, name: one && own ? "length"
          : g.length || own ? `${named}.length` : named };
      });
    return { address, how: how(address), what,
      ...(own.has(address) ? { role: "own-slot" as const } : {}) };
  });
  if (filter.maxRows !== undefined) rows = rows.slice(0, filter.maxRows);
  rows = rows.map((r, k) => ({ ...r, gapBefore: k === 0
    ? BigInt(r.address) !== 0n
    : BigInt(r.address) !== BigInt(rows[k - 1].address) + 1n }));
  return { location, point: d.point, rows, cover, owned };
}

// A row's label, "how : what" (all the names, in byte order; the
// popover fits them to its box); a row no value owns: how only
export function rowLabel(row: Row): string {
  if (row.role === "own-slot" || !row.what.length) return row.how;
  return `${row.how} : ${row.what.map((w) => w.name).join(" · ")}`;
}
