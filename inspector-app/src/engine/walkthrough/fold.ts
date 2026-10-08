// The walkthrough of a selection (vanilla main.js replaySteps, at
// 1b0530a, built here from the dereference graph): the rules its
// pointer follows, one step each, in the order of the YAML (the band
// only moves down), each for all of the selection's instances at once (a
// mapping's entries, an array's items). First, the inputs the page
// supplies (a mapping's keys, no band). Every template entered is a
// step, and the define that leads into it; every region read and every
// branch taken is a step, one fork step where instances part. When the
// selection spans more than one slot or region, step 0 comes first:
// what we are about to find (its slots, whole, in yellow; no labels).
// Instances are named by their on-chain `name` values, quoted.
import type {
  Colour, Compilation, Decoded, Hex, Instance, KeySource, Path,
  ResolvedRegion, RuleNode, Snapshot, ValueNode,
} from "../types";
import { short, slotHex, toBig } from "../hex";
import { typeName } from "../values";
import { childColours } from "../light";
import { pointerText } from "../pointer-text";

export type Tok = string | { code: string } | { gloss: string } |
  { prose: string } | { question: string } | { field: Path; text: string };
export type Form =
  | { kind: "text"; toks: Tok[] }
  | { kind: "table"; rows: { a: Tok[]; b: Tok[]; k: Colour }[] }
  | { kind: "lines"; lines: Tok[][] }
  // a one-line strip of a word's 32 bytes, as a dump row draws it: the
  // fields over their bytes, in their colours
  | { kind: "strip"; row: Hex; word: Hex;
    fields: { path: Path; name: string; from: number; to: number;
      k: Colour }[] };
export interface Part { regions: ResolvedRegion[]; rows: Path[];
  colours?: ReadonlyMap<Path, Colour>; dim?: boolean; slots?: Hex[] }
export interface Step {
  id: string;            // the step's identity: its node and kind, not
                         // its instances (re-targeting aligns on it)
  phase: string; cap: string; form: Form; constructs: string[];
  source: string; sourceTint?: boolean; chip: string; chipLabel: string;
  parts: Part[]; rows: Path[]; gutters: Hex[]; band: string[];
  ruler?: Hex; tkind?: string; rname?: string;
  goal?: boolean;        // step 0: what we are about to find
}
export interface Walkthrough {
  target: Path; steps: Step[];
  // a mapping's entries, for the focus picker; "*": all at full strength
  recs: { path: Path; who: string }[] | null; focus: string;
  variable: string;
}
export interface WalkInput {
  d: Decoded; c: Compilation; snap?: Snapshot; keys: KeySource;
}

type Any = any;
const PICKS = 10;
const nWord = (n: number) => ["no", "one", "two", "three", "four", "five",
  "six", "seven", "eight"][n] ?? String(n);

// bytes a–b of a region, or the slots it spans
function bytesText(r: ResolvedRegion) {
  const o = r.offset;
  const n = r.length;
  if (o + n > 32) return `${Math.ceil((o + n) / 32)} slots`;
  return o === 0 && n === 32 ? "the whole slot" : n === 1 ? `byte ${o}`
    : `bytes ${o}–${o + n - 1}`;
}

// a raw step: one instance of one rule node, as vanilla's replay()
// recorded a step (its kind, block and path of keys)
interface Raw { kind: string; block: string; at: (string | number)[];
  i: Instance; n: RuleNode }
interface X { inst: string; s: Any; leaves: ValueNode[];
  regions: ResolvedRegion[] }
interface Nd { k: string; kind: string; block: string; at: (string |
  number)[]; s: Any; by: Map<string, X>; line: number; seen: number;
  node: RuleNode }

export function walkthrough(x: WalkInput, path: Path, focus?: string):
  Walkthrough | null {
  const { d, c, snap } = x;
  const node = d.byPath.get(path);
  if (!node) return null;
  const types = c.types as Record<string, Any>;
  const pointers = c.templates as Record<string, Any>;
  const variable = path.split(/[.[]/)[0];
  const varNode = d.byPath.get(variable);
  const g = d.graphs.get(variable);
  if (!g) return null;
  const all = [...g.nodes.values()].flatMap((n) => n.instances);
  const byId = new Map(all.map((i) => [i.id, i]));
  const seqOf = (id: string) => Number(id.slice(id.lastIndexOf("@") + 1));
  const kindOf = (n?: ValueNode) => n && types[n.type]?.kind;

  const leaves: ValueNode[] = [];
  const visit = (n: ValueNode) => {
    if (n.regions.length) leaves.push(n);
    (n.children ?? []).forEach(visit);
  };
  visit(node);
  // (an array's items are counted by its length: an item takes the
  // length's steps too)
  if (kindOf(varNode) === "array" && varNode !== node && varNode!.regions
    .length) leaves.unshift(varNode!);
  if (!leaves.length) return null;
  const w32 = (h: Hex | bigint) =>
    slotHex(typeof h === "bigint" ? h : toBig(h));
  const wordAt = (h: Hex | bigint) => snap?.storage.get(w32(h));
  const tail = (h: Hex | bigint) => `…${w32(h).slice(-4)}`;
  const small = (h: Hex | bigint) => {
    const n = typeof h === "bigint" ? h : toBig(h);
    return n < 1n << 32n ? String(n) : tail(h);
  };
  const entryPath = (p: string) => p.match(/^[^.[]+\[[^\]]*\]/)?.[0];
  const instOf = (leaf: { path: string }) => entryPath(leaf.path) ??
    leaf.path;
  const tn = (id: string) => types[id] ? typeName(types[id], types) : id;
  const getAt = (block: string, at: (string | number)[]) =>
    at.reduce<Any>((o, k) => o?.[k], block ? pointers[block] : null);
  const opOf = (e: Any) => e && typeof e === "object" ? Object.keys(e)[0]
    : null;
  // the keys: from the contract's own list of them (roster, decoded from
  // storage), or the trace
  const keyList = x.keys.from === "list" ? x.keys.path : null;
  const keyItem = (key: Hex) => {
    const list = keyList ? d.byPath.get(keyList) : undefined;
    const k = w32(key).slice(-40);
    return list?.children?.find((ch) => ch.value?.text?.toLowerCase()
      .endsWith(k)) ?? null;
  };
  const ec = childColours(d, variable, 9);
  const kOf = (inst: string): Colour => ec.get(inst) ?? 0;

  // the YAML's lines, for the document order of the nodes
  const { lines } = pointerText(c, variable);
  const lineOf = (block: string, at: (string | number)[]) => {
    const p = `${block}|${at.join(".")}`;
    const i = lines.findIndex((l) => l.pos === p || (at.length > 0 &&
      l.pos.startsWith(p + ".")));
    return i < 0 ? Infinity : i;
  };

  // a rule node's place, as vanilla names it: its block ("" for the
  // variable's own pointer) and path of keys (a list's and a
  // conditional's own key last)
  type Place = { block: string; at: (string | number)[] };
  const placeOf = (n: RuleNode): Place => {
    const [b, p] = n.id.split("#");
    const at: (string | number)[] = p.split("/").filter(Boolean)
      .map((k) => /^\d+$/.test(k) ? +k : k);
    const block = b === g.root ? "" : b;
    if (n.kind === "list") at.push("list");
    if (n.kind === "conditional") at.push("if");
    return { block, at };
  };
  // what vanilla's replay() step held, from the instance
  const sOf = (n: RuleNode, i: Instance, leaf: ValueNode): Any => {
    const ast = n.ast as Any;
    if (n.kind === "template") {
      const name = ast.template as string;
      const expect = (pointers[name]?.expect ?? []) as string[];
      return { name, expect, inputs: Object.fromEntries(expect.filter((k) =>
        i.bindings[k] !== undefined).map((k) => [k, { hex: i.bindings[k] }])) };
    }
    if (n.kind === "define") {
      const id = n.id.split("/").at(-1)!;
      const args = ast?.["~keccak256"]
        ? (ast["~keccak256"] as Any[]).map((a) => {
          const v = typeof a === "string" ? a : a?.["~wordsized"];
          return { value: { hex: i.bindings[v] ?? "0x" } };
        }) : undefined;
      return { id, expr: ast, value: { hex: i.value ?? "0x" }, args };
    }
    if (n.kind === "conditional") {
      return { branch: i.branch, cond: { expr: ast.if } };
    }
    if (n.kind === "list") {
      const each = ast.list.each;
      const r = leaf.regions.map((q) => byId.get(q.instance))
        .find((q) => q?.bindings[each] !== undefined);
      return { index: String(toBig(r?.bindings[each] ?? "0x0")) };
    }
    return { name: ast.name };
  };

  // What reads a region: the graph's edges (an instance's `uses`), never
  // the pointer's text. A region is read when some instance used one of
  // its instances; a define reads one when its instances used any.
  const isRegion = (id: string) => {
    const i = byId.get(id);
    return !!i && g.nodes.get(i.node)!.kind === "region";
  };
  const readRegions = new Set<string>();
  for (const i of all) {
    for (const u of i.uses) {
      if (!isRegion(u)) continue;
      const n = g.nodes.get(byId.get(u)!.node)!;
      readRegions.add(`${placeOf(n).block}|${(n.ast as Any).name}`);
    }
  }
  const reads = (block: string, name: string) =>
    readRegions.has(`${block}|${name}`);
  const hasRead = (nd: Nd) =>
    nd.node.instances.some((i) => i.uses.some(isRegion));

  // the nodes: one per place in the pointer; each with its instances
  let declared: Any = null;
  const nodes = new Map<string, Nd>();
  let seen = 0;
  for (const leaf of leaves) {
    const inst = instOf(leaf);
    const rs = leaf.regions.map((r) => byId.get(r.instance)!)
      .filter(Boolean).sort((a, b) => seqOf(a.id) - seqOf(b.id));
    const raws: { i: Instance; region?: ResolvedRegion }[] = [];
    const had = new Set<string>();
    for (const ri of rs) {
      for (const id of ri.within ?? []) {
        if (had.has(id)) continue;
        had.add(id);
        raws.push({ i: byId.get(id)! });
      }
      raws.push({ i: ri, region: leaf.regions.find((q) =>
        q.instance === ri.id) });
    }
    for (const { i, region } of raws) {
      const n = g.nodes.get(i.node)!;
      if (n.kind === "declared") {
        declared ??= i.region ? { context: i.region, region: i.region }
          : { slot: i.value };
        continue;
      }
      if (n.kind === "group") continue;
      const kind = n.kind === "conditional" ? "if" : n.kind;
      const { block, at } = placeOf(n);
      const k = `${kind}|${block}|${at.join(".")}`;
      if (!nodes.has(k)) {
        nodes.set(k, { k, kind, block, at, s: sOf(n, i, leaf), by: new Map(),
          line: lineOf(block, at), seen: seen++, node: n });
      }
      const nd = nodes.get(k)!;
      if (!nd.by.has(inst)) {
        nd.by.set(inst, { inst, s: sOf(n, i, leaf), leaves: [],
          regions: [] });
      }
      const xx = nd.by.get(inst)!;
      if (!xx.leaves.includes(leaf)) xx.leaves.push(leaf);
      if (region && !xx.regions.some((q) => q.instance === region.instance)) {
        xx.regions.push(region);
      }
    }
  }
  const order = [...nodes.values()].sort((a, b) => a.line - b.line ||
    a.seen - b.seen);
  const insts = [...new Set(leaves.map(instOf))].filter((i) =>
    i !== variable || kindOf(varNode) !== "array");
  // each instance's template inputs, by template kind
  const inputs = new Map<string, Record<string, { hex: Hex }>>();
  for (const nd of order.filter((n) => n.kind === "template")) {
    for (const [i, xx] of nd.by) {
      inputs.set(`${i}|${types[nd.s.name]?.kind}`, xx.s.inputs ?? {});
    }
  }
  const keyOf = (i: string) => inputs.get(`${i}|mapping`)?.key?.hex;
  // an instance by its on-chain name (quoted), else its key
  // (an empty name, "", is none)
  const named = (t?: string) => t && t !== '""' ? t : undefined;
  const nameOf = (i: string) => named(d.byPath.get(`${i}.name`)?.value
    ?.text);
  const who = (i: string) => nameOf(i) ?? (keyOf(i) ? short(keyOf(i)!)
    : i.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`));
  const addr = (h: Hex): Tok[] => {
    const nm = named(d.byPath.get(`${variable}[0x${w32(h).slice(-40)}]` +
      ".name")?.value?.text);
    return [short(h), ...(nm ? [" ", { gloss: nm }] : [])];
  };
  const isRec = insts.some((i) => keyOf(i));
  const recs = isRec && insts.length > 1
    ? insts.map((i) => ({ path: i, who: who(i) })) : null;
  // the focus: one instance at full strength, the others echoing it;
  // or "*", all of them (by default for a composite with several; one
  // entry or a value in it: that entry)
  const ownE = entryPath(node.path);
  const own = ownE && insts.includes(ownE) ? ownE
    : insts.includes(node.path) ? node.path : null;
  const every = focus === "*" || (focus === undefined && !own &&
    insts.length > 1);
  const f = focus && insts.includes(focus) ? focus : own ?? insts[0];

  const out: Step[] = [];
  const step = (s: Partial<Step> & Pick<Step, "id" | "phase">): Step => {
    const st = { cap: "", form: { kind: "text", toks: [] } as Form,
      constructs: [], source: "", chip: "", chipLabel: "", parts: [],
      rows: [], gutters: [], band: [], ...s } as Step;
    out.push(st);
    return st;
  };
  const text = (...toks: Tok[]): Form => ({ kind: "text", toks });
  const table = (rows: [Tok[], Tok[], Colour][]): Form =>
    ({ kind: "table", rows: rows.map(([a, b, k]) => ({ a, b, k })) });
  const pos = (block: string, at: (string | number)[]) =>
    `${block}|${at.join(".")}`;
  const exact = (block: string, at: (string | number)[]) =>
    `=${pos(block, at)}`;

  // (1) the inputs: the mapping's keys, and where they come from
  const keyed = insts.filter((i) => keyOf(i));
  if (keyed.length) {
    const items = keyed.map((i) => [i, keyItem(keyOf(i)!)] as const);
    const one = keyed.length === 1;
    const has = items.filter(([, it]) => it) as [string, ValueNode][];
    step({ phase: "input", id: "input",
      cap: one ? `key = ${who(keyed[0])}'s address, from \`${
        items[0][1]?.path ?? "the trace"}\``
        : `The keys: the addresses in \`${keyList ?? "the trace"}\``,
      form: one ? text(...addr(keyOf(keyed[0])!)) : table(items.map(([i, it]) =>
        [addr(keyOf(i)!), [it?.label ?? "trace"], kOf(i)])),
      source: keyList ? `the page reads ${keyList} from storage`
        : "the page reads the keys from the trace", sourceTint: !!keyList,
      chip: one ? "key" : "keys", chipLabel: keyList ?? "trace",
      parts: [{ regions: has.flatMap(([, it]) => it.regions),
        rows: has.map(([, it]) => it.path),
        colours: new Map(has.map(([i, it]) => [it.path, kOf(i)])) }],
      rows: has.map(([, it]) => it.path) });
  }

  // (2) declared
  if (declared) {
    const kind = kindOf(varNode) ?? "value";
    if (declared.context) {
      const r = declared.context as ResolvedRegion;
      step({ phase: "declared", id: `declared|${variable}`, band: ["~var"],
        cap: `\`${variable}\` is at slot ${small(r.slot!)}, ${r.length} ` +
          `bytes from offset ${r.offset}`,
        form: text(`slot ${small(r.slot!)}, bytes ${r.offset}–${r.offset +
          r.length - 1}`),
        constructs: ["pointer"], source: "ethdebug data from the compiler",
        chip: `slot ${small(r.slot!)}`, chipLabel: "value",
        parts: [{ regions: [r], rows: [variable] }], rows: [variable] });
    } else {
      const w = wordAt(declared.slot);
      step({ phase: "declared", id: `declared|${variable}`, band: ["~var"],
        cap: kind === "mapping" && w !== undefined && !toBig(w)
          ? `\`${variable}\` is declared at slot ${small(declared.slot)}; ` +
            "that slot holds nothing"
          : `\`${variable}\` is declared at slot ${small(declared.slot)}`,
        form: text(`slot ${small(declared.slot)}`),
        constructs: ["pointer"], source: "ethdebug data from the compiler",
        chip: `slot ${small(declared.slot)}`, chipLabel: ["mapping",
          "string", "array", "struct"].includes(kind) ? kind === "struct"
          ? "record" : kind : "value",
        gutters: [w32(declared.slot)], parts: [{ regions: [],
          rows: [variable] }], rows: [variable] });
    }
  }

  // (3) the pointer's nodes, in document order
  let openIf: Any = null; // an `if` step and its branches' places
  let pending: Nd[] = []; // defines and lists folded into the next region
  const inBranch = (nd: Nd) => openIf && openIf.branches.some((b: Any[]) =>
    nd.block === openIf.block && b.every((k, j) => nd.at[j] === k));
  const defineBand = (nd: Nd) => [exact(nd.block, nd.at.slice(0, -1)),
    pos(nd.block, nd.at)];
  const instRows = (nd: Nd) => [...nd.by.values()].flatMap((xx) =>
    xx.leaves.map((l) => l.path));
  const regionsOf = (nd: Nd) => [...nd.by.values()].flatMap((xx) =>
    xx.regions);
  const fieldColours = () => {
    const used = new Set(ec.values());
    const free = [...Array(PICKS).keys()].slice(1).filter((k) =>
      !used.has(k as Colour)) as Colour[];
    const fc = childColours(d, f, 9);
    return (leafPath: string): Colour => {
      const name = leafPath.slice(instOf({ path: leafPath }).length);
      const k = fc.get(`${f}${name}`);
      return typeof k === "number" && k ? free[(k - 1) % free.length] : 0;
    };
  };
  for (const nd of order) {
    if (openIf && !inBranch(nd)) openIf = null;
    const xs = [...nd.by.values()];
    if (nd.kind === "template") {
      const t = types[nd.s.name];
      const ks = (nd.s.expect ?? []) as string[];
      const vals = (k: string) => [...new Set(xs.map((y) =>
        y.s.inputs?.[k]?.hex))];
      const what = (k: string) => {
        const vs = vals(k);
        if (vs.length === 1 && vs[0] !== undefined) {
          return k === "key" ? `key = ${who(xs[0].inst)}'s address`
            : `${k} = ${small(vs[0])}`;
        }
        return k === "key" ? `key = each address in \`${keyList ??
          "the trace"}\`` : `${k} = each ${t?.kind === "struct"
          ? "record's slot" : t?.kind === "string" ? "name slot" : k}`;
      };
      // (one row an instance, where their inputs differ)
      const many = new Set(xs.map((y) => JSON.stringify(y.s.inputs))).size
        > 1;
      const rowsT = insts.filter((i) => i !== variable);
      const inp = (y: X, k: string) => k === "key"
        ? short(y.s.inputs[k].hex) : small(y.s.inputs[k].hex);
      step({ phase: "template", tkind: t?.kind, id: nd.k,
        cap: `The template \`${tn(nd.s.name)}\` takes ${ks.map(what)
          .join(", ")}`,
        form: many ? table(xs.map((y) => [[who(y.inst)], [ks.map((k) =>
          `${k} ${inp(y, k)}`).join(", ")], kOf(y.inst)]))
          : text(ks.map((k) => `${k} = ${inp(xs[0], k)}`).join(", ")),
        constructs: ["template"], source: "ethdebug data from the compiler",
        chip: tn(nd.s.name), chipLabel: "template",
        gutters: [...new Set(xs.map((y) => y.s.inputs?.slot?.hex)
          .filter(Boolean).map((h) => w32(h)))],
        parts: [{ regions: [], rows: rowsT.length ? rowsT : [variable],
          colours: ec }],
        rows: rowsT.length ? rowsT : [variable],
        band: [`=${nd.s.name}|`, exact(nd.s.name, ["expect"]),
          exact(nd.s.name, ["for"])] });
      continue;
    }
    if (nd.kind === "define") {
      const into = getAt(nd.block, [...nd.at.slice(0, -2), "in"]);
      if (into && typeof into === "object" && "template" in into) {
        // the hand-off into a nested template
        const t = types[into.template];
        const op = opOf(nd.s.expr);
        const formula = (y: X) => {
          const v = y.s.value.hex as Hex;
          if (op === "~keccak256" && y.s.args?.length === 2) {
            const [a, b] = y.s.args.map((z: Any) => z.value.hex);
            return `keccak(${short(a)}, ${small(b)}) = ${tail(v)}`;
          }
          if (op === "~sum") {
            const base = inputs.get(`${y.inst}|${types[nd.block]?.kind}`)
              ?.slot?.hex;
            const dd = base ? toBig(v) - toBig(base) : null;
            return base ? `${tail(base)} + ${dd} = ${tail(v)}` : tail(v);
          }
          return `${nd.s.id} = ${small(v)}`;
        };
        const leafOf = (y: X) => y.leaves.find((l) => l.path !== y.inst) ??
          y.leaves[0];
        const fname = (y: X) => leafOf(y).path.slice(y.inst.length)
          .replace(/^\./, "") || leafOf(y).label;
        const many = xs.length > 1;
        const isRecord = t?.kind === "struct";
        step({ phase: "handoff", tkind: t?.kind, id: nd.k,
          cap: isRecord ? many ? `Each record is at keccak(key, ${small(
            xs[0].s.args?.[1]?.value.hex ?? "0x0")})`
            : `The record is at ${formula(xs[0])}`
            : `The next slot holds \`${fname(xs[0])}\`, a ${tn(
              into.template)}${many ? "" : `: ${formula(xs[0])}`}`,
          form: many ? table(xs.map((y) => [[who(y.inst)], [formula(y)],
            kOf(y.inst)])) : text(formula(xs[0])),
          constructs: ["define", ...(op ? [op] : [])],
          source: "ethdebug data from the compiler",
          chip: isRecord ? `keccak(key, ${small(xs[0].s.args?.[1]?.value.hex
            ?? "0x0")})` : fname(xs[0]),
          chipLabel: isRecord ? "record" : tn(into.template),
          gutters: xs.map((y) => w32(y.s.value.hex)),
          parts: [{ regions: [], rows: isRecord ? xs.map((y) => y.inst)
            : xs.map((y) => leafOf(y).path), colours: ec }],
          rows: isRecord ? xs.map((y) => y.inst) : xs.map((y) =>
            leafOf(y).path),
          band: [...defineBand(nd), pos(nd.block, [...nd.at.slice(0, -2),
            "in"])] });
        continue;
      }
      if (openIf && hasRead(nd) && inBranch(nd)) {
        openIf.absorbed.push(nd);
        openIf.st.band.push(...defineBand(nd));
        continue;
      }
      pending.push(nd);
      continue;
    }
    if (nd.kind === "list") {
      pending.push(nd);
      continue;
    }
    if (nd.kind === "if") {
      const P = nd.at.slice(0, -1);
      const branches = [...new Set(xs.map((y) => y.s.branch as string))];
      openIf = { block: nd.block, branches: branches.map((b) => [...P, b]),
        absorbed: [], nd };
      openIf.st = step({ phase: "if", id: nd.k,
        constructs: ["if"], source: "read from storage",
        chip: branches.length > 1 ? "short | long" : branches[0] === "then"
          ? "short" : "long", chipLabel: "branch",
        band: [pos(nd.block, nd.at), ...branches.map((b) =>
          exact(nd.block, [...P, b]))] });
      (openIf.st as Any)._node = nd;
      (openIf.st as Any)._xs = xs;
      continue;
    }
    // a region
    const name = nd.s.name as string;
    const read = reads(nd.block, name);
    if (read && openIf && inBranch(nd)) {
      openIf.absorbed.push(nd);
      openIf.st.band.push(pos(nd.block, nd.at));
      // (and the branch's group line)
      const gg = nd.at.slice(0, -2);
      if (gg.at(-1) !== undefined) openIf.st.band.push(exact(nd.block, gg));
      continue;
    }
    if (read) {
      const vals = xs.map((y) => [y, y.regions[0]] as const);
      const byte = (r: ResolvedRegion) => {
        const wv = wordAt(r.slot!) ?? "0x0";
        if (name === "length-flag") return `0x${w32(wv as Hex).slice(-2)}`;
        return String(toBig(wv));
      };
      const many = xs.length > 1;
      const lbl = name === "length-flag" ? "The last byte is the length flag"
        : name === "length" ? `slot ${small(vals[0][1].slot!)} holds the ` +
          "length" : `\`${name}\` is read`;
      step({ phase: "read", rname: name, id: nd.k,
        cap: many ? `${name === "length-flag" ? "The last byte of each " +
          "name slot is its length flag" : lbl}`
          : `${lbl}${name === "length-flag" ? ", " : ": "}${byte(
            vals[0][1])}`,
        form: many ? table(vals.map(([y, r]) => [[who(y.inst)], [byte(r)],
          kOf(y.inst)])) : text(`${name} = ${byte(vals[0][1])}`),
        constructs: ["region"], source: "read from storage",
        chip: name === "length-flag" ? "flag" : name,
        chipLabel: name === "length" ? "array" : "string",
        parts: [{ regions: regionsOf(nd), rows: [...new Set(instRows(nd))],
          colours: ec }],
        rows: [...new Set(instRows(nd))], band: [pos(nd.block, nd.at)] });
      continue;
    }
    // a value's own region: a field, a string's data, a list's item
    const prev = out.at(-1) as Any;
    const parent = nd.at.slice(0, -1).join(".");
    const folded = pending;
    pending = [];
    const bandR = [pos(nd.block, nd.at), ...folded.flatMap((p) =>
      p.kind === "define" ? defineBand(p) : [pos(p.block, p.at)])];
    if (name === "item" || folded.some((p) => p.kind === "list")) {
      const data = folded.find((p) => p.kind === "define");
      const base = data ? [...data.by.values()][0].s.args?.[0]?.value.hex
        ?? declared?.slot : declared?.slot;
      const start = data ? [...data.by.values()][0].s.value.hex : null;
      const idx = order.find((n) => n.kind === "list");
      const is = idx ? [...idx.by.values()].map((y) => +y.s.index)
        .sort((a, b) => a - b) : [];
      const one = is.length === 1;
      step({ phase: "item", id: nd.k,
        cap: one ? `The items start at keccak(${small(base)})`
          : `The items start at keccak(${small(base)}), one slot each, ` +
            "for `length` items",
        form: text(`keccak256(${small(base)}) = ${start ? tail(start) : "?"}${
          one ? `; item ${is[0]} at + ${is[0]}` : `; items ${is[0]}…${is.at(
            -1)} at + i`}`),
        constructs: ["~keccak256", "list"], source: "ethdebug data from the compiler",
        chip: `keccak(${small(base)})`, chipLabel: "items",
        parts: [{ regions: regionsOf(nd), rows: instRows(nd), colours: ec }],
        rows: instRows(nd), band: bandR });
      continue;
    }
    if (name === "data" || name?.endsWith("-data")) {
      const ifn = order.find((n) => n.kind === "if");
      const long = !!ifn && xs.every((y) => ifn.by.get(y.inst)?.s.branch ===
        "else");
      const lenOf = (y: X) => y.regions[0]?.length ?? 0;
      const many = xs.length > 1;
      const slots = (y: X) => Math.ceil(lenOf(y) / 32);
      const one = xs[0];
      const startOf = folded.length ? [...folded[0].by.values()][0].s
        .args?.[0]?.value.hex ?? one.regions[0].slot : one.regions[0].slot;
      step({ phase: "data", id: nd.k,
        cap: many ? long ? "Each long text starts at keccak(its slot)"
          : "Each short text is in its slot, from the left"
          : long ? `The text starts at keccak(${tail(startOf)}) = ${tail(
            one.regions[0].slot!)}, ${lenOf(one)} bytes over ${slots(one)} ${
            slots(one) === 1 ? "slot" : "slots"}`
            : `The text is in the slot itself: ${lenOf(one)} bytes from ` +
              "the left",
        form: many ? table(xs.map((y) => [[who(y.inst)], [`${lenOf(y)
          } bytes at ${tail(y.regions[0].slot!)}`], kOf(y.inst)]))
          : text(xs[0].leaves.at(-1)!.value?.text ?? ""),
        constructs: long ? ["~keccak256", "region"] : ["region"],
        source: "ethdebug data from the compiler", chip: long ? "keccak(slot)"
          : "inline", chipLabel: "text",
        parts: [{ regions: regionsOf(nd), rows: [...new Set(instRows(nd))],
          colours: ec }],
        rows: [...new Set(instRows(nd))], band: bandR });
      continue;
    }
    // fields: the siblings in one group, one step
    if (prev?.phase === "fields" && prev._parent === `${nd.block}|${parent}`
      && !folded.length) {
      prev._nodes.push(nd);
      prev.band.push(...bandR);
      continue;
    }
    const st = step({ phase: "fields", id: `fields|${nd.block}|${parent}`,
      band: bandR, constructs: ["region"], source: "ethdebug data from the compiler",
      chipLabel: "fields" }) as Any;
    st._parent = `${nd.block}|${parent}`;
    st._nodes = [nd];
  }

  // the fields steps, now that their nodes are known
  for (const st of out.filter((y) => y.phase === "fields") as Any[]) {
    const kc = fieldColours();
    const fs = (st._nodes as Nd[]).flatMap((nd) => [...nd.by.values()]
      .map((y) => ({ y, nd, leaf: y.leaves[0], region: y.regions[0] })));
    const mine = fs.filter((z) => z.y.inst === f);
    const items = [...mine].sort((a, b) => a.region.offset - b.region.offset);
    const n = st._nodes.length;
    const nm = (z: typeof fs[0]) => z.leaf.path.slice(z.y.inst.length)
      .replace(/^\./, "") || z.leaf.label;
    const row = items[0] && w32(items[0].region.slot!);
    Object.assign(st, {
      cap: n > 1 ? `The first slot packs ${nWord(n)} fields, from ` +
        "the right"
        : `\`${nm(items[0])}\` is ${bytesText(items[0].region)} of the ` +
          "record's first slot",
      // (the byte strip: the word, its fields over their bytes)
      form: { kind: "strip", row, word: (wordAt(row) ?? "0x") as Hex,
        fields: items.map((z) => ({ path: z.leaf.path, name: nm(z),
          from: z.region.offset, to: z.region.offset + z.region.length - 1,
          k: kc(z.leaf.path) })) },
      chip: n > 1 ? `${n} fields` : nm(items[0]),
      chipLabel: n > 1 ? "fields" : "field",
      ruler: row,
      parts: fs.map((z) => ({ regions: [z.region], rows: [z.leaf.path],
        colours: new Map([[z.leaf.path, kc(z.leaf.path)]]),
        dim: !every && z.y.inst !== f })),
      rows: (every ? fs : mine).map((z) => z.leaf.path) });
    delete st._nodes;
    delete st._parent;
  }

  // the `if` steps, now that what they took in is known
  for (const st of out.filter((y) => y.phase === "if") as Any[]) {
    const nodeIf = st._node as Nd;
    const sx = st._xs as X[];
    const branchOf = new Map(sx.map((y) => [y.inst, y.s.branch]));
    const flagOf = (i: string) => {
      const r = order.find((n) => n.kind === "region" && n.s.name ===
        "length-flag")?.by.get(i)?.regions[0];
      return r ? w32((wordAt(r.slot!) ?? "0x0") as Hex) : null;
    };
    const lens = (i: string) => {
      const w = flagOf(i);
      if (!w) return null;
      return branchOf.get(i) === "then" ? toBig("0x" + w.slice(-2)) / 2n
        : (toBig(w) - 1n) / 2n;
    };
    const shorts = sx.filter((y) => y.s.branch === "then");
    const longs = sx.filter((y) => y.s.branch === "else");
    // what it lights: the regions it took in, else the flag it reads
    const regs = (i: string) => {
      const ownR = order.filter((n) => n.kind === "region" &&
        reads(n.block, n.s.name) && n.by.has(i) && n.line > nodeIf.line &&
        st.band.includes(pos(n.block, n.at)))
        .flatMap((n) => n.by.get(i)!.regions);
      if (ownR.length) return ownR;
      return order.find((n) => n.kind === "region" && n.s.name ===
        "length-flag")?.by.get(i)?.regions ?? [];
    };
    const rowsOf = (i: string) => sx.find((y) => y.inst === i)!.leaves
      .map((l) => l.path);
    const ex = (list: X[]) => list.find((y) => y.inst === f) ?? list[0];
    const many = sx.length > 1;
    const line = (y: X) => y.s.branch === "then"
      ? `even: 0x${flagOf(y.inst)?.slice(-2)} → ${lens(y.inst)} bytes inline`
      : `odd: 0x${flagOf(y.inst)?.slice(-2)} → ${lens(y.inst)} bytes at ` +
        `keccak(${tail(regs(y.inst)[0]?.slot ?? 0n)})`;
    const names = (list: X[]) => list.map((y) => who(y.inst)).join(", ");
    const fork = shorts.length && longs.length;
    Object.assign(st, {
      cap: fork ? `The last byte decides the form: even → short (${names(
        shorts)}), odd → long (${names(longs)})`
        : !flagOf(sx[0].inst) ? `The condition takes \`${sx[0].s.branch}\``
          : longs.length ? many ? "Odd → long: each slot holds 2 × " +
            "length + 1" : "Odd → long: the slot holds 2 × length + 1, " +
            `so length = ${lens(longs[0].inst)}`
            : many ? "Even → short: the last byte holds 2 × length"
              : "Even → short: the last byte holds 2 × length, so " +
                `length = ${lens(shorts[0].inst)}`,
      form: fork ? { kind: "lines", lines: [ex(shorts), ex(longs)].map((y) =>
        [line(y), " ", { prose: `(${who(y.inst)})` }]) } as Form
        : many ? table(sx.map((y) => [[who(y.inst)], [line(y)],
          kOf(y.inst)])) : text(line(sx[0])),
      parts: [{ regions: sx.flatMap((y) => regs(y.inst)),
        rows: sx.flatMap((y) => rowsOf(y.inst)), colours: ec }],
      rows: sx.flatMap((y) => rowsOf(y.inst)) });
    delete st._node;
    delete st._xs;
  }

  // step 0, the goal (vanilla c62550a): when the selection takes more
  // than one slot or region, every slot the walkthrough touches (but its
  // inputs'), whole, in the selection's yellow, with no label: which
  // bytes are what is what the steps find
  const touched = new Set<Hex>();
  for (const st of out.filter((y) => y.phase !== "input")) {
    for (const p of st.parts) {
      for (const r of p.regions) spanned(r).forEach((h) => touched.add(h));
      for (const h of p.slots ?? []) touched.add(h);
    }
    for (const h of st.gutters) touched.add(h);
  }
  const ownR = leaves.filter((l) => l.path === path ||
    l.path.startsWith(path + ".") || l.path.startsWith(path + "["))
    .flatMap((l) => l.regions);
  const ownS = new Set(ownR.flatMap(spanned));
  if (ownS.size > 1 || ownR.length > 1) {
    const allS = [...touched].sort((a, b) =>
      toBig(a) < toBig(b) ? -1 : 1);
    const apart = allS.some((h, k) => k > 0 &&
      toBig(h) - toBig(allS[k - 1]) > 1n);
    out.unshift({ id: "goal", phase: "goal", goal: true,
      cap: `${allS.length === 1 ? "This slot holds" : `These ${allS.length
        } slots hold`} \`${path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g,
        (_, h) => `[${short(h)}]`)}\`${apart
        ? ", scattered across storage" : ""}.`,
      form: text({ question: "How do we find them, and what do they mean?" }),
      constructs: [], source: "", chip: "", chipLabel: "",
      parts: [{ regions: [], rows: [path], slots: allS }],
      rows: [path], gutters: [], band: [] });
  }
  return { target: path, steps: out, recs, focus: every ? "*" : f,
    variable };
}

// the slots a region spans
function spanned(r: ResolvedRegion): Hex[] {
  if (r.slot === undefined) return [];
  const n = Math.max(1, Math.ceil((r.offset + r.length) / 32));
  return Array.from({ length: n }, (_, k) => slotHex(r.slot! + BigInt(k)));
}

// The step a walkthrough re-targeted to another selection keeps: the
// steps aligned by their identities (longest common subsequence); the
// one shown stays on its match, or the nearest earlier step that has
// one, or the first. `moved`: the place moved.
export function retarget(from: Step[], at: number, to: Step[]):
  { at: number; moved: boolean } {
  const a = from.map((s) => s.id);
  const b = to.map((s) => s.id);
  const L = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1
        : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const match = new Map<number, number>();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) match.set(i++, j++);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  let k = 0;
  for (let i = at; i >= 0; i--) {
    if (match.has(i)) {
      k = match.get(i)!;
      break;
    }
  }
  return { at: k, moved: !(match.has(at) && match.get(at) === at) };
}
