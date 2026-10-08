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
  | { kind: "table"; rows: { a: Tok[]; b: Tok[]; k: Colour;
    dim?: boolean }[] }
  | { kind: "lines"; lines: Tok[][] }
  // byte ranges within one slot, drawn as a dump row is: 32 cells in
  // four groups of eight, each value a span over its cells, in its
  // colour, named; the byte positions under it (vanilla 5c1edfa)
  | { kind: "strip"; fields: { path?: Path; name: string; from: number;
    to: number; k: Colour }[] };
// (`k`: its regions' bytes in that colour, whatever owns them;
// `wholes`: slots computed here, outlined in `k`, their bytes not lit)
export interface Part { regions: ResolvedRegion[]; rows: Path[];
  colours?: ReadonlyMap<Path, Colour>; dim?: boolean; slots?: Hex[];
  k?: Colour; wholes?: Hex[] }
export interface Step {
  id: string;            // the step's identity: its node and kind, not
                         // its instances (re-targeting aligns on it)
  phase: string; cap: string; form: Form; constructs: string[];
  source: string; sourceTint?: boolean; chip: string; chipLabel: string;
  parts: Part[]; rows: Path[]; gutters: Hex[]; band: string[];
  ruler?: Hex; tkind?: string; rname?: string;
  goal?: boolean;        // step 0: what we are about to find
}
// (a rule's instances in a form's table: `k` its entry's colour; `dim`:
// not the focus, an echo)
export interface Walkthrough {
  target: Path; steps: Step[];
  // a mapping's entries, for the focus picker; "*": all at full strength
  recs: { path: Path; who: string; full?: string }[] | null; focus: string;
  variable: string;
  // (the slots the walkthrough touches: its labels' runs; and who each
  // key is, for the labels: "0x7099…79c8" → "alice")
  span: Hex[]; names: Map<string, string>;
}
export interface WalkInput {
  d: Decoded; c: Compilation; snap?: Snapshot; keys: KeySource;
  // (the point, as the scene names it, when it is one side of a pair)
  when?: string;
  // (another compiler's storage read by this rule: that compiler's own
  // reading of it, for the contrast at the end)
  contrast?: { d: Decoded; language: string };
}

type Any = any;
const PICKS = 10;
// (the walkthrough's last step, "found": one switch, to try it; vanilla
// 6b1df3a FOUND)
export const FOUND = true;
// (where a step's facts come from: one form for every step)
const COMPILER = "from: the compiler (ethdebug)";
const STORAGE = "from: storage (a value read)";
const LANG = (l: string) => l[0].toUpperCase() + l.slice(1);
// (solc's rule over another compiler's storage: the Vyper scene)
const RULE = (_l: string) => "Solidity's rule";
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
  // The walkthrough's colours, each with one meaning from step 0 to
  // found: within the selection, the colours its resting view gives
  // (found is that view; its own bytes, the selection's yellow, 0); an
  // entry outside it, its entry's colour; anything else lit, neutral
  // ("nt"), never the selection's yellow
  const ec = childColours(d, variable, 9);
  const rc = childColours(d, path, 9);
  const inTarget = (q: string) => q === path || q.startsWith(path + ".") ||
    q.startsWith(path + "[");
  const M = new Map<Path, Colour>([...d.byPath.keys()].map((q) => {
    const k = inTarget(q) ? rc.get(q) ?? 0 : ec.get(q);
    return [q, k === undefined || (k === 0 && !inTarget(q)) ? "nt" : k];
  }));
  const kOf = (inst: string): Colour => M.get(inst) ?? "nt";
  // (an input's source row: its entry's colour; the source tint for the
  // selection's own entry, whose colour is the selection's)
  const srcOf = (inst: string): Colour => kOf(inst) === 0 ? "src"
    : kOf(inst);

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
  // an instance by its name in the scene's story (the fixture's), else
  // its on-chain `name` (quoted; an empty one, "", is none), else its
  // key: one name for each, everywhere; its address once, at the keys
  const named = (t?: string) => t && t !== '""' ? t : undefined;
  const nameOfKey = (h: Hex) => x.keys.names?.[w32(h).slice(-40)];
  const nameOf = (i: string) => (keyOf(i) && nameOfKey(keyOf(i)!)) ??
    named(d.byPath.get(`${i}.name`)?.value?.text);
  const who = (i: string) => nameOf(i) ?? (keyOf(i) ? short(keyOf(i)!)
    : i.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`));
  const whoAt = (i: string) => keyOf(i) && nameOf(i)
    ? `${who(i)} (${short(keyOf(i)!)})` : who(i);
  // (a path with its keys by name: players[carol].name)
  const pathName = (p: string) => p.replace(/\[(0x[0-9a-fA-F]{16,})\]/g,
    (_, h) => `[${nameOfKey(h as Hex) ?? short(h)}]`);
  const isRec = insts.some((i) => keyOf(i));
  // (shortened, within its quotes, for a narrow place: vanilla 0225d35)
  const clip = (t: string, n = 16) => t.length > n
    ? `${t.slice(0, n - 2)}…${t.endsWith('"') ? '"' : ""}` : t;
  const whoShort = (i: string) => clip(who(i));
  const recs = isRec && insts.length > 1
    ? insts.map((i) => ({ path: i, who: whoShort(i), full: who(i) }))
    : null;
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
  // (within one slot: a range past its end stops at byte 31)
  const strip = (fields: Extract<Form, { kind: "strip" }>["fields"]): Form =>
    ({ kind: "strip", fields: fields.map((f) => ({ ...f,
      to: Math.min(31, f.to) })) });
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
    // (a mapping does not store its keys: the page supplies them)
    const from = (it: ValueNode | null) => it ? `\`${it.path}\``
      : "the trace of the calls";
    step({ phase: "input", id: "input",
      cap: one ? `The key: ${who(keyed[0])}'s address. A mapping does not ` +
        `store its keys; the page takes it from ${from(items[0][1])}`
        : "The keys: a mapping does not store its keys; the page takes " +
          `them from ${keyList ? `\`${keyList}\`` : "the trace of the calls"}`,
      form: one ? text(whoAt(keyed[0])) : table(items.map(([i, it]) =>
        [[whoAt(i)], [it?.label ?? "trace"], srcOf(i)])),
      source: keyList ? `from: the page (${keyList}, read from storage)`
        : "from: the page (the trace)",
      chip: one ? "key" : "keys", chipLabel: keyList ?? "trace",
      parts: [{ regions: has.flatMap(([, it]) => it.regions),
        rows: has.map(([, it]) => it.path),
        colours: new Map(has.map(([i, it]) => [it.path, srcOf(i)])) }],
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
        form: strip([{ name: variable, from: r.offset, to: r.offset +
          r.length - 1, k: 0 }]),
        constructs: ["pointer"], source: COMPILER,
        chip: `slot ${small(r.slot!)}`, chipLabel: "value",
        parts: [{ regions: [r], rows: [variable], colours: M }],
        rows: [variable] });
    } else {
      const w = wordAt(declared.slot);
      const at = `slot ${small(declared.slot)}`;
      const empty = w !== undefined && !toBig(w);
      step({ phase: "declared", id: `declared|${variable}`, band: ["~var"],
        cap: x.contrast ? `${RULE(x.contrast.language)} says \`${variable
          }\` is declared at ${at}${empty ? "; that slot holds nothing"
          : `; in ${LANG(x.contrast.language)}'s storage, that slot holds ` +
            "something else"}`
          : kind === "mapping" && empty
            ? `\`${variable}\` is declared at ${at}; that slot holds nothing`
            : `\`${variable}\` is declared at ${at}`,
        form: text(),
        constructs: ["pointer"], source: COMPILER,
        chip: `slot ${small(declared.slot)}`, chipLabel: ["mapping",
          "string", "array", "struct"].includes(kind) ? kind === "struct"
          ? "record" : kind : "value",
        gutters: [w32(declared.slot)], parts: [{ regions: [],
          rows: [variable], colours: M }], rows: [variable] });
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
  // (an instance's own value's colour: the selection's yellow when it is
  // the selection, else its entry's)
  const kLeaf = (y: X): Colour => {
    const l = y.leaves.find((v) => v.path !== y.inst) ?? y.leaves[0];
    return (l && M.get(l.path)) ?? kOf(y.inst);
  };
  const regionsOf = (nd: Nd) => [...nd.by.values()].flatMap((xx) =>
    xx.regions);
  // a field's colour at the packed fields: its own in the walkthrough's
  // colours where it has one (the selection is its record, or the field
  // itself); else, with several entries shown, a colour no entry uses
  const fieldColours = () => {
    const used = new Set(insts.map(kOf));
    const free = [...Array(PICKS).keys()].slice(1).filter((k) =>
      !used.has(k as Colour)) as Colour[];
    const fc = childColours(d, f, 9);
    return (leafPath: string): Colour => {
      const own = M.get(leafPath);
      if (own !== undefined && own !== kOf(instOf({ path: leafPath }))) {
        return own;
      }
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
      const tband = [`=${nd.s.name}|`, exact(nd.s.name, ["expect"]),
        exact(nd.s.name, ["for"])];
      // (a template entered from a hand-off: one step with it, the
      // define and the template it leads into, read as one)
      const prev = out.at(-1);
      if (prev?.phase === "handoff") {
        prev.band.push(...tband);
        prev.constructs.push("template");
        continue;
      }
      const ks = (nd.s.expect ?? []) as string[];
      const vals = (k: string) => [...new Set(xs.map((y) =>
        y.s.inputs?.[k]?.hex))];
      const valOf = (y: X, k: string) => k === "key" ? who(y.inst)
        : small(y.s.inputs[k].hex);
      const what = (k: string) => {
        const vs = vals(k);
        if (vs.length === 1 && vs[0] !== undefined) {
          return `${k} = ${valOf(xs[0], k)}`;
        }
        return `${k} = ${xs.map((y) => valOf(y, k)).join(" · ")}`;
      };
      step({ phase: "template", tkind: t?.kind, id: nd.k,
        cap: `The template \`${tn(nd.s.name)}\` takes ${ks.map((k) =>
          `\`${k}\``).join(" and ")}`,
        form: text(ks.map(what).join("; ")),
        constructs: ["template"], source: COMPILER,
        chip: tn(nd.s.name), chipLabel: "template",
        gutters: [...new Set(xs.map((y) => y.s.inputs?.slot?.hex)
          .filter(Boolean).map((h) => w32(h)))],
        parts: [{ regions: [], rows: [variable], colours: M }],
        rows: [variable], band: tband });
      continue;
    }
    if (nd.kind === "define") {
      const into = getAt(nd.block, [...nd.at.slice(0, -2), "in"]);
      if (into && typeof into === "object" && "template" in into) {
        // the hand-off into a nested template
        const t = types[into.template];
        const op = opOf(nd.s.expr);
        // (one spelling: keccak(alice, slot 3); slot + 1)
        const formula = (y: X) => {
          const v = y.s.value.hex as Hex;
          if (op === "~keccak256" && y.s.args?.length === 2) {
            const [, b] = y.s.args.map((z: Any) => z.value.hex);
            return `keccak(${who(y.inst)}, slot ${small(b)}) = ${tail(v)}`;
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
        const slotN = small(xs[0].s.args?.[1]?.value.hex ?? "0x0");
        // (the first hash of the walkthrough says what it hashes)
        const hashGloss = op === "~keccak256" && !out.some((y) =>
          y.phase === "handoff" && y.constructs.includes("~keccak256"));
        const into1 = `the template \`${tn(into.template)}\` takes it as ` +
          "its `slot`";
        const rows = isRecord ? xs.map((y) => y.inst)
          : xs.map((y) => leafOf(y).path);
        const fm: Form = many ? table(xs.map((y) => [[who(y.inst)],
          [formula(y)], kOf(y.inst)])) : text(formula(xs[0]));
        step({ phase: "handoff", tkind: t?.kind, id: nd.k,
          cap: isRecord ? `${many ? "Each record is" : "The record is"} ` +
            `at keccak(key, slot ${slotN}); ${into1}`
            : `\`${fname(xs[0])}\` is in the next slot, slot + 1; ${into1}`,
          form: hashGloss && fm.kind === "text" ? text(formula(xs[0]),
            { prose: "  (keccak of two 32-byte words: the key, then the " +
              "slot)" }) : fm,
          constructs: ["define", ...(op ? [op] : [])],
          source: COMPILER,
          chip: isRecord ? `keccak(key, slot ${slotN})` : fname(xs[0]),
          chipLabel: isRecord ? "record" : tn(into.template),
          // (the computed slots, whole, outlined in their entries'
          // colours: found, not read yet)
          parts: xs.map((y) => ({ regions: [], rows: [isRecord ? y.inst
            : leafOf(y).path], colours: M, k: kOf(y.inst),
            wholes: [w32(y.s.value.hex)] })),
          rows,
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
        constructs: ["if"], source: STORAGE,
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
      // (the rule in the caption, the value in the form)
      // (a string by its own name: `name`, `motd`)
      const sname = (xs[0].leaves[0]?.path ?? "").split(".").pop()!
        .replace(/\[.*$/, "");
      const lbl = name === "length-flag" ? `The last byte of \`${sname
        }\`'s slot is its length flag` : name === "length" ? `Slot ${small(
          vals[0][1].slot!)} holds the length` : `\`${name}\` is read`;
      step({ phase: "read", rname: name, id: nd.k,
        cap: many && name === "length-flag" ? "The last byte of each " +
          `\`${sname}\` slot is its length flag` : lbl,
        form: many ? table(vals.map(([y, r]) => [[who(y.inst)], [byte(r)],
          kLeaf(y)])) : strip([{ name: `${name} = ${byte(vals[0][1])}`,
          from: vals[0][1].offset, to: vals[0][1].offset +
            vals[0][1].length - 1, k: kLeaf(vals[0][0]) }]),
        constructs: ["region"], source: STORAGE,
        chip: name === "length-flag" ? "flag" : name,
        chipLabel: name === "length" ? "array" : "string",
        parts: [{ regions: regionsOf(nd), rows: [...new Set(instRows(nd))],
          colours: M }],
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
        cap: one ? `The items start at keccak(slot ${small(base)})`
          : `The items start at keccak(slot ${small(base)}), one slot each, ` +
            "for `length` items",
        form: text(`keccak(slot ${small(base)}) = ${start ? tail(start) : "?"}${
          one ? `; item ${is[0]} at + ${is[0]}` : `; items ${is[0]}…${is.at(
            -1)} at + i`}`),
        constructs: ["~keccak256", "list"], source: COMPILER,
        chip: `keccak(slot ${small(base)})`, chipLabel: "items",
        parts: [{ regions: regionsOf(nd), rows: instRows(nd), colours: M }],
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
          : long ? `The text starts at keccak(slot ${tail(startOf)}) = ${
            tail(one.regions[0].slot!)}: ${lenOf(one)} bytes over ${slots(one)
            } ${slots(one) === 1 ? "slot" : "slots"}`
            : `The text is in the slot itself: ${lenOf(one)} bytes from ` +
              "the left",
        form: many ? table(xs.map((y) => [[who(y.inst)], [`${lenOf(y)
          } bytes at ${tail(y.regions[0].slot!)}`], kLeaf(y)]))
          : text(xs[0].leaves.at(-1)!.value?.text ?? ""),
        constructs: long ? ["~keccak256", "region"] : ["region"],
        source: COMPILER, chip: long ? "keccak(slot …)"
          : "inline", chipLabel: "text",
        parts: [{ regions: regionsOf(nd), rows: [...new Set(instRows(nd))],
          colours: M }],
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
      band: bandR, constructs: ["region"], source: COMPILER,
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
      form: strip(items.map((z) => ({ path: z.leaf.path, name: nm(z),
        from: z.region.offset, to: z.region.offset + z.region.length - 1,
        k: kc(z.leaf.path) }))),
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
        `keccak(slot ${tail(regs(y.inst)[0]?.slot ?? 0n)})`;
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
          kLeaf(y)])) : text(line(sx[0])),
      parts: [{ regions: sx.flatMap((y) => regs(y.inst)),
        rows: sx.flatMap((y) => rowsOf(y.inst)), colours: M }],
      rows: sx.flatMap((y) => rowsOf(y.inst)) });
    delete st._node;
    delete st._xs;
  }

  // step 0, the goal (vanilla c62550a): when the selection takes more
  // than one slot or region, every slot the walkthrough touches (but its
  // inputs'), whole, in the selection's yellow, with no label: which
  // bytes are what is what the steps find
  const touched = slotsOf(out.filter((y) => y.phase !== "input"));
  const allS = [...touched].sort((a, b) => toBig(a) < toBig(b) ? -1 : 1);
  const ownR = leaves.filter((l) => inTarget(l.path))
    .flatMap((l) => l.regions);
  const ownS = new Set(ownR.flatMap(spanned));
  const sk = pathName(path);
  const foreign = x.contrast;
  if (ownS.size > 1 || ownR.length > 1) {
    // (scattered: the selection's own slots are not one run)
    const own = [...ownS].sort((a, b) => toBig(a) < toBig(b) ? -1 : 1);
    const apart = own.some((h, k) => k > 0 &&
      toBig(h) - toBig(own[k - 1]) > 1n);
    const none = allS.filter((h) => !ownS.has(h)).length;
    const n = allS.length;
    const when = x.when ? `${x.when[0].toUpperCase()}${x.when.slice(1)}: ` : "";
    out.unshift({ id: "goal", phase: "goal", goal: true,
      cap: foreign ? `${when}These are the ${n === 1 ? "slot" : `${n} slots`
        } ${RULE(foreign.language)} would read for \`${sk}\`.`
        : `${when}${n === 1 ? "This slot holds" : `These ${n} slots belong to`
          } \`${sk}\`${apart ? ", scattered across storage" : ""}${none
          ? `; ${none === 1 ? "one of them holds" : `${nWord(none)} of them hold`
          } none of its data` : ""}.`,
      form: text({ question: n === 1 ? "Which rules find it, and what does " +
        "it mean?" : "Which rules find them, and what do they mean?" }),
      constructs: [], source: "", chip: "", chipLabel: "",
      parts: [{ regions: [], rows: [path], slots: allS }],
      rows: [path], gutters: [], band: [] });
  }
  // the last step, "found": the selection as it rests, its colours and
  // labels (light.ts: the resting view); the bookend to step 0. Not
  // after a lone step: it would add a click and nothing else
  const rules = out.filter((y) => !y.goal);
  if (FOUND && rules.length > 1) {
    const t = types[node.type];
    const n = node.children?.length ?? 0;
    const vt = t?.kind === "mapping"
      ? types[t.contains?.value?.type?.id] : null;
    const whoList = isRec && t?.kind === "mapping"
      ? ` (${insts.map(who).join(", ")})` : "";
    const what = t?.kind === "mapping" ? `${n} ${vt?.kind === "struct"
      ? n === 1 ? "record" : "records" : n === 1 ? "entry" : "entries"}${
        whoList}`
      : t?.kind === "struct" ? `${n} ${n === 1 ? "field" : "fields"}`
        : t?.kind === "array" ? `${n} ${n === 1 ? "item" : "items"}`
          : node.value?.text ?? "";
    out.push({ id: "found", phase: "found",
      cap: foreign ? `That's what ${RULE(foreign.language)} reads for \`${
        sk}\`${what ? `: ${what}` : ""}.`
        : `That's \`${sk}\`${what ? `: ${what}` : ""}, found.`,
      form: text(), constructs: [], source: "", chip: "found",
      chipLabel: sk, parts: [], rows: [path], gutters: [], band: [] });
  }
  // another compiler's storage: the walkthrough ends by naming the
  // misread, with that compiler's own layout, hand-written for comparison
  // (no ethdebug from it): its words for the selection, in a colour of
  // their own
  if (foreign && out.length) {
    const cd = foreign.d;
    const L = LANG(foreign.language);
    const words: { slot: Hex; name: string; text: string;
      r: ResolvedRegion }[] = [];
    const visitC = (n: ValueNode) => {
      for (const r of n.regions) {
        if (r.slot === undefined) continue;
        words.push({ slot: w32(r.slot), r, name: n.path.slice(
          (entryPath(n.path) ?? "").length).replace(/^\./, "") || n.label,
        text: r.role === "length" ? "length" : n.value?.text ?? "" });
      }
      (n.children ?? []).forEach(visitC);
    };
    const mine = cd.byPath.get(path);
    if (mine) visitC(mine);
    if (words.length) {
      const read = node.value?.text;
      const theirs = mine?.value?.text;
      const one = words.length === 1;
      // (what the slots Solidity's rule read hold in this storage)
      const solS = [...ownS];
      const blank = solS.every((h) => !toBig(wordAt(h) ?? "0x0"));
      out.push({ id: "external", phase: "external",
        cap: `The misread: ${L} keeps \`${sk}\` ${one ? `in slot ${tail(
          words[0].slot)}` : "in other slots"}${theirs !== undefined
          ? `, where it is ${theirs}` : ""}; ${RULE(foreign.language)} ${
          read !== undefined ? `read ${read} ` : "read "}from ${solS.length
          === 1 ? `slot ${tail(solS[0])}` : "slots"} where ${L} keeps ${
          blank ? "nothing" : "other data"}. (${L}'s rule here is ` +
          `hand-written for comparison: ${L} emits no ethdebug.)`,
        form: table(words.map((w) => [[tail(w.slot)], [w.r.role === "length"
          ? `${w.name} (length)` : `${w.name} = ${w.text}`], 9])),
        constructs: [], source: `from: ${L}'s layout, hand-written (not ` +
          "ethdebug)", chip: L, chipLabel: "hand-written",
        parts: [{ regions: words.map((w) => w.r), rows: [], k: 9 },
          { regions: ownR, rows: [path], colours: M }],
        rows: [path], gutters: [], band: [] });
    }
  }
  const names = new Map<string, string>();
  for (const i of insts) {
    const k = keyOf(i);
    if (k && nameOf(i)) names.set(short(k), who(i));
  }
  return { target: path, steps: out, recs, focus: every ? "*" : f,
    variable, span: allS, names };
}

// The slots steps touch: their regions' (whole), their parts' slots,
// their gutters
export function slotsOf(steps: Step[]): Set<Hex> {
  const out = new Set<Hex>();
  for (const st of steps) {
    for (const p of st.parts) {
      for (const r of p.regions) spanned(r).forEach((h) => out.add(h));
      for (const h of p.slots ?? []) out.add(h);
      for (const h of p.wholes ?? []) out.add(h);
    }
    for (const h of st.gutters) out.add(h);
  }
  return out;
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
  // (no match: the first step after the goal; moved: the step's number,
  // not counting the goal, changed: vanilla main.js retarget)
  const oa = from[0]?.goal ? 1 : 0;
  const ob = to[0]?.goal ? 1 : 0;
  let k = Math.min(ob, to.length - 1);
  for (let i = at; i >= 0; i--) {
    if (match.has(i)) {
      k = match.get(i)!;
      break;
    }
  }
  return { at: k, moved: k - ob !== at - oa };
}
