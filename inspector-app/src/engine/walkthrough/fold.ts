// The walkthrough of a selection (vanilla main.js replaySteps, at
// 1b0530a, built here from the dereference graph): the rules its
// pointer follows, one step each, in the order of the YAML (the band
// only moves down), each for all of the selection's instances at once (a
// mapping's entries, an array's items). Every construct the pointer
// schema allows walks, in every location: every template entered is a
// step, and the define that leads into it; every region read and every
// branch taken is a step, one fork step where instances part; a value's
// own region is a step, with the defines and lists that lead to it.
// When the selection spans more than one row or region, step 0 comes
// first: what we are about to find (its rows, whole, in yellow; no
// labels); with more than one step, "found" comes last. The steps' words
// are the fold's own, from the construct and the region's location;
// annotators (hooks.ts) add what a layout or the page's data know: where
// an input comes from, the instances' names, a focus, a layout's own
// words for a step (solc's storage: solidity.ts), steps of their own.
import type {
  Colour, Compilation, Decoded, Hex, Instance, KeySource, Location, Path,
  ResolvedRegion, RuleNode, Snapshot, ValueNode,
} from "../types";
import { short, slotHex, toBig } from "../hex";
import { typeName } from "../values";
import { childColours } from "../light";
import { pointerText } from "../pointer-text";
import { addressing, rangeText, regionBytes, regionHex } from "../location";
import { exprText } from "./expr";
import {
  COMPILER, READ, nWord, type Annotator, type Cx, type Declared, type Nd,
  type X,
} from "./hooks";
import { annotatorsFor } from "./annotators";

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
// `wholes`: slots computed here, lit whole in `k`, their bytes not read;
// `at`: the location of `slots`, when it is not storage)
export interface Part { regions: ResolvedRegion[]; rows: Path[];
  colours?: ReadonlyMap<Path, Colour>; dim?: boolean; slots?: Hex[];
  k?: Colour; wholes?: Hex[]; at?: Location }
export interface Step {
  id: string;            // the step's identity: its node and kind, not
                         // its instances (re-targeting aligns on it)
  phase: string; cap: string; form: Form; constructs: string[];
  source: string; sourceTint?: boolean; chip: string; chipLabel: string;
  parts: Part[]; rows: Path[]; gutters: Hex[]; band: string[];
  ruler?: Hex; tkind?: string; rname?: string;
  goal?: boolean;        // step 0: what we are about to find
  // (the values of the pointer's variables at this step, as the focus
  // has them: shown beside the band's lines that name them)
  // (the template, or "" for the variable's own pointer, they hold in)
  notes?: { block: string; values: Record<string, string> };
  // (a layout's own words for a step: the pointer's formulas under them,
  // as the focus has them, quietly; FORMULAS)
  formula?: string[];
}
// an instance the reader can focus (a mapping's entry)
export interface Rec { path: Path; who: string; full?: string }
// (a rule's instances in a form's table: `k` its entry's colour; `dim`:
// not the focus, an echo)
export interface Walkthrough {
  target: Path; steps: Step[];
  // a mapping's entries, for the focus picker; "*": all at full strength
  recs: Rec[] | null; focus: string;
  variable: string;
  // (the rows the walkthrough touches: its labels' runs; and who each
  // key is, for the labels: "0x7099…79c8" → "alice")
  span: Hex[]; names: Map<string, string>;
  // (the selection, its keys by name: players[carol].name)
  name: string;
}
export interface WalkInput {
  d: Decoded; c: Compilation; snap?: Snapshot; keys: KeySource;
  // (the point, as the scene names it, when it is one side of a pair)
  when?: string;
  // (another compiler's storage read by this rule: that compiler's own
  // reading of it, for the contrast at the end)
  contrast?: { d: Decoded; language: string };
  // (the annotators, when not the compilation's language's)
  annotators?: Annotator[];
}

type Any = any;
// (the walkthrough's last step, "found": one switch, to try it; vanilla
// 6b1df3a FOUND)
export const FOUND = true;
// (under a step an annotator words, the pointer's formulas for it: one
// switch, to try it; the maintainer's trial, 10-09)
export const FORMULAS = true;
// (a location's rows, by name: storage's slots, a segment's words)
const NOUN: Record<string, [string, string]> = {
  storage: ["slot", "slots"], transient: ["transient slot",
    "transient slots"], stack: ["stack item", "stack items"] };
const noun = (l: Location, n: number) =>
  (NOUN[l] ?? ["word", "words"])[n === 1 ? 0 : 1];

// a raw step: one instance of one rule node, as vanilla's replay()
// recorded a step (its kind, block and path of keys)
export function walkthrough(x: WalkInput, path: Path, focus?: string):
  Walkthrough | null {
  const { d, c, snap } = x;
  const node = d.byPath.get(path);
  if (!node) return null;
  const types = c.types as Record<string, Any>;
  const variable = path.split(/[.[]/)[0];
  const varNode = d.byPath.get(variable);
  const g = d.graphs.get(variable);
  if (!g) return null;
  const hs = annotatorsFor(x);
  // (the first annotator's answer to a hook)
  const ask = <T>(f: (h: Annotator) => T | null | undefined): T |
    undefined => {
    for (const h of hs) {
      const v = f(h);
      if (v !== null && v !== undefined) return v;
    }
    return undefined;
  };
  // (the templates: the compilation's, and those the pointer defines)
  const inline: Record<string, Any> = {};
  const scan = (o: Any) => {
    if (!o || typeof o !== "object") return;
    if (o.templates && typeof o.templates === "object" && "in" in o) {
      Object.assign(inline, o.templates);
    }
    Object.values(o).forEach(scan);
  };
  scan(g.pointer);
  const pointers = { ...inline, ...c.templates } as Record<string, Any>;
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
    at.reduce<Any>((o, k) => o?.[k], block ? pointers[block] : g.pointer);
  const opOf = (e: Any) => e && typeof e === "object" ? Object.keys(e)[0]
    : null;
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
  const { lines } = pointerText(c, variable, g.pointer);
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
      return { id, expr: ast, value: { hex: i.value ?? "0x" }, args,
        bindings: i.bindings };
    }
    if (n.kind === "conditional") {
      return { branch: i.branch, cond: { expr: ast.if }, bindings:
        i.bindings };
    }
    if (n.kind === "list") {
      const each = ast.list.each;
      const r = leaf.regions.map((q) => byId.get(q.instance))
        .find((q) => q?.bindings[each] !== undefined);
      return { index: String(toBig(r?.bindings[each] ?? "0x0")), each,
        count: ast.list.count };
    }
    return { name: ast.name, fields: i.fields, bindings: i.bindings };
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
    nd.node.instances.some((i: Instance) => i.uses.some(isRegion));

  // the nodes: one per place in the pointer; each with its instances
  // (a value's own regions, and those read to find it: a local's frame
  // pointer)
  let declared: (Declared & { nd?: RuleNode; i?: Instance }) | null = null;
  const nodes = new Map<string, Nd>();
  let seen = 0;
  for (const leaf of leaves) {
    const inst = instOf(leaf);
    const mine = [...leaf.regions, ...leaf.reads ?? []];
    const rs = mine.map((r) => byId.get(r.instance)!)
      .filter(Boolean).sort((a, b) => seqOf(a.id) - seqOf(b.id));
    const raws: { i: Instance; region?: ResolvedRegion }[] = [];
    const had = new Set<string>();
    for (const ri of rs) {
      for (const id of ri.within ?? []) {
        if (had.has(id)) continue;
        had.add(id);
        raws.push({ i: byId.get(id)! });
      }
      raws.push({ i: ri, region: mine.find((q) => q.instance === ri.id) });
    }
    for (const { i, region } of raws) {
      const n = g.nodes.get(i.node)!;
      if (n.kind === "declared") {
        declared ??= i.region ? { context: i.region, region: i.region,
          nd: n, i } : { slot: i.value, nd: n, i };
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
  // each instance's template inputs, by template kind (and by template)
  const inputs = new Map<string, Record<string, { hex: Hex }>>();
  for (const nd of order.filter((n) => n.kind === "template")) {
    for (const [i, xx] of nd.by) {
      inputs.set(`${i}|${types[nd.s.name]?.kind}`, xx.s.inputs ?? {});
      inputs.set(`${i}|@${nd.s.name}`, xx.s.inputs ?? {});
    }
  }
  // an instance's key: the value it is given from outside the pointer
  // (a graph input, as its first template takes it)
  const inputNames = g.inputs.map((n) => n.name);
  const keyOf = (i: string): Hex | undefined => {
    for (const nd of order) {
      if (nd.kind !== "template") continue;
      const ins = nd.by.get(i)?.s.inputs ?? {};
      for (const k of inputNames) if (ins[k]) return ins[k].hex;
    }
    return undefined;
  };
  // an instance by its name (an annotator's), else its key, else its
  // path: one name for each, everywhere; its key once, at the inputs
  const nameOf = (i: string) => ask((h) => h.name?.(cx, i));
  const who = (i: string) => nameOf(i) ?? (keyOf(i) ? short(keyOf(i)!)
    : i.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`));
  const whoAt = (i: string) => keyOf(i) && nameOf(i)
    ? `${who(i)} (${short(keyOf(i)!)})` : who(i);
  // (shortened, within its quotes, for a narrow place: vanilla 0225d35)
  const clip = (t: string, n = 16) => t.length > n
    ? `${t.slice(0, n - 2)}…${t.endsWith('"') ? '"' : ""}` : t;
  // (a path with its keys by name, shortened: players["carol, the un…"])
  const pathName = (p: string) => p.replace(/\[(0x[0-9a-fA-F]{16,})\]/g,
    (m, h, at) => {
      const nm = nameOf(`${p.slice(0, at)}${m}`);
      return `[${nm ? clip(nm) : short(h)}]`;
    });
  const whoShort = (i: string) => clip(who(i));

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

  // the focus: one instance at full strength, the others echoing it;
  // or "*", all of them (by default for a composite with several; one
  // entry or a value in it: that entry)
  const ownE = entryPath(node.path);
  const own = ownE && insts.includes(ownE) ? ownE
    : insts.includes(node.path) ? node.path : null;
  const every = focus === "*" || (focus === undefined && !own &&
    insts.length > 1);
  const f = focus && insts.includes(focus) ? focus : own ?? insts[0];

  const cx: Cx = { x, snap, path, variable, node, varNode, types,
    pointers, leaves, insts, f, every, order, out, declared, M, kOf, srcOf,
    kLeaf, who, whoAt, whoShort, keyOf, inputs, kindOf, tn, getAt, opOf,
    reads, entryPath, instOf, inTarget, w32, wordAt, tail, small, step,
    pathName,
    text, table, strip, pos,
    exact, defineBand, instRows, regionsOf };
  const recs = ask((h) => h.focus?.(cx)) ?? null;

  // (a region's place, in its location's words: slot 3, bytes 0–7;
  // stack item 2; memory 0x0080–0x009f)
  const placeText = (r: ResolvedRegion) => {
    const bytes = r.offset === 0 && r.length === 32 ? ""
      : r.length === 0 ? `, no bytes (at byte ${r.offset})`
      : r.length === 1 ? `, byte ${r.offset}`
        : `, bytes ${r.offset}–${r.offset + r.length - 1}`;
    if (addressing(r.location) === "slot") {
      return `${noun(r.location, 1)} ${small(r.slot ?? 0n)}${bytes}`;
    }
    if (!r.length) return `${rangeText(r.location, r.offset, r.offset)}, ` +
      "no bytes";
    return rangeText(r.location, r.offset, r.offset + r.length - 1);
  };
  // (a value as the dump shows it: its bytes' number, or the value's own
  // text when the selection is that value)
  // (a region read for another's offset in a segment: as an offset,
  // 0x0680, as the dump addresses it)
  const asOffset = (name?: string) => !!name && order.some((n) =>
    n.kind === "region" && [...n.by.values()].some((y) =>
      (y.s.fields ?? []).some((fl: Any) => fl.field === "offset" &&
        addressing(y.regions[0]?.location ?? "storage") === "offset" &&
        JSON.stringify(fl.expr).includes(JSON.stringify({ "~read":
          name }).slice(1, -1)))));
  const valueText = (r: ResolvedRegion) => {
    const h = regionHex(snap, r);
    if (h === undefined) return "not part of this state";
    const n = toBig(h);
    if (asOffset(r.name) && n < 1n << 32n) {
      return `0x${n.toString(16).padStart(4, "0")}`;
    }
    return n < 1n << 32n ? String(n) : short(h);
  };
  // (a computed field: its expression, its operands' values, its value:
  // "offset = read(-frame) + 188 = 0x0200 + 188 = 0x02bc")
  const fieldText = (r: ResolvedRegion, fl: NonNullable<Instance[
    "fields"]>[number], bindings: Record<string, Hex> = {}) => {
    const asNum = (h: Hex) => fl.field === "offset" &&
      addressing(r.location) === "offset"
      ? `0x${toBig(h).toString(16).padStart(4, "0")}` : small(h);
    const e = exprText(fl.expr);
    // (its operands' values: an expression's, as the walk evaluated it;
    // a variable's, as it is bound)
    const mid = exprText(fl.expr, (a) => {
      const v = fl.args?.find((y) => y.expr === a);
      if (v && typeof a === "object") return asNum(v.value);
      return typeof a === "string" && bindings[a] !== undefined
        ? small(bindings[a]) : undefined;
    });
    const top = typeof fl.expr === "string";
    const val = asNum(fl.value);
    return [`${fl.field} = ${e}`, ...!top && mid !== e && mid !== val
      ? [mid] : [], val].join(" = ");
  };
  // (the fields a region computes: those that are expressions)
  const computed = (fs: Instance["fields"]) => (fs ?? []).filter((fl) =>
    fl.expr !== null && typeof fl.expr === "object" ||
    (typeof fl.expr === "string" && !/^(0x[0-9a-f]*|\d+)$/i.test(fl.expr)));
  const formula = (y: X) => {
    const e = y.s.expr;
    const v = y.s.value.hex as Hex;
    // (an input, by its instance's name: keccak(alice, 3))
    const named = (a: unknown) => typeof a !== "string" ||
      y.s.bindings?.[a] === undefined ? undefined
      : inputNames.includes(a) ? who(y.inst) : small(y.s.bindings[a]);
    const mid = exprText(e);
    const withVals = exprText(e, named, false, true);
    const val = small(v);
    return [`${y.s.id} = ${mid}`, ...withVals !== mid ? [withVals] : [],
      ...val !== withVals ? [val] : []].join(" = ");
  };

  // the formulas of a node, as the focus has them: a define's, a region's
  // fields that are operations, a condition's (FORMULAS: under the words
  // an annotator gives a step; the fold's own steps show them already)
  const isOp = (e: unknown) => !!e && typeof e === "object";
  const formulasOf = (nd: Nd): string[] => {
    const y = nd.by.get(f) ?? [...nd.by.values()][0];
    if (!y) return [];
    if (nd.kind === "define") return isOp(y.s.expr) ? [formula(y)] : [];
    if (nd.kind === "if") {
      const c = exprText(y.s.cond.expr);
      const v = exprText(y.s.cond.expr, (a) => typeof a === "string" &&
        y.s.bindings?.[a] !== undefined ? small(y.s.bindings[a]) : undefined,
      false, true);
      return [`if ${c}${v !== c ? ` = ${v}` : ""} → ${y.s.branch}`];
    }
    const r = y.regions[0];
    if (!r) return [];
    return (y.s.fields ?? []).filter((fl: Any) => isOp(fl.expr))
      .map((fl: Any) => fieldText(r, fl, y.s.bindings));
  };
  const withFormulas = (st: Step, nds: Nd[]) => {
    if (!FORMULAS) return st;
    const ls = [...new Set([...st.formula ?? [], ...nds.flatMap(formulasOf)])];
    if (ls.length) st.formula = ls;
    return st;
  };

  // (1) the inputs: where the values the pointer expects come from
  for (const h of hs) h.inputs?.(cx);
  if (!out.length && g.inputs.length) {
    const ks = insts.filter((i) => keyOf(i));
    if (ks.length) {
      step({ phase: "input", id: "input",
        cap: `The ${g.inputs.map((n) => `\`${n.name}\``).join(" and ")}: ` +
          "from outside the pointer",
        form: ks.length === 1 ? text(whoAt(ks[0])) : table(ks.map((i) =>
          [[whoAt(i)], [short(keyOf(i)!)], srcOf(i)])),
        source: "from: the page", chip: g.inputs[0].name,
        chipLabel: "input" });
    }
  }

  // (2) declared
  if (declared) {
    const words = ask((h) => h.declared?.(cx, declared!));
    if (words) {
      const st = step({ phase: "declared", id: `declared|${variable}`,
        band: ["~var"], ...words });
      const fs = declared.context ? computed(declared.i?.fields)
        .filter((fl) => isOp(fl.expr)) : [];
      if (FORMULAS && fs.length) {
        st.formula = fs.map((fl) => fieldText(declared!.context!, fl,
          declared!.i?.bindings));
      }
    }
    else if (declared.context) {
      const r = declared.context;
      const fs = computed(declared.i?.fields);
      step({ phase: "declared", id: `declared|${variable}`, band: ["~var"],
        cap: `\`${variable}\` is at ${placeText(r)}`,
        form: fs.length ? { kind: "lines", lines: [...fs.map((fl) =>
          [fieldText(r, fl, declared!.i?.bindings)]), [`${variable} = ${
          node.value?.text ?? valueText(r)}`]] }
          : text(`${variable} = ${node.value?.text ?? valueText(r)}`),
        constructs: ["pointer"], source: COMPILER,
        chip: placeText(r), chipLabel: "value",
        parts: [{ regions: [r], rows: [variable], colours: M }],
        rows: [variable] });
    } else {
      const k = Object.keys((g.pointer as Any)?.define ?? {})[0] ?? "slot";
      step({ phase: "declared", id: `declared|${variable}`, band: ["~var"],
        cap: `\`${variable}\`'s pointer defines \`${k}\` = ${small(
          declared.slot!)}`,
        form: text(), constructs: ["pointer"], source: COMPILER,
        chip: `${k} ${small(declared.slot!)}`, chipLabel: "value",
        parts: [{ regions: [], rows: [variable], colours: M }],
        rows: [variable] });
    }
  }

  // (3) the pointer's nodes, in document order
  let openIf: Any = null; // an `if` step and its branches' places
  let pending: Nd[] = []; // defines and lists folded into the next region
  const inBranch = (nd: Nd) => openIf && openIf.branches.some((b: Any[]) =>
    nd.block === openIf.block && b.every((k, j) => nd.at[j] === k));
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
      const valOf = (y: X, k: string) => inputNames.includes(k) ||
        k === "key" ? who(y.inst) : small(y.s.inputs[k].hex);
      const what = (k: string) => {
        const vs = vals(k);
        if (vs.length === 1 && vs[0] !== undefined) {
          return `${k} = ${valOf(xs[0], k)}`;
        }
        return `${k} = ${xs.map((y) => valOf(y, k)).join(" · ")}`;
      };
      const fx = xs.find((y) => y.inst === f) ?? xs[0];
      step({ phase: "template", tkind: t?.kind, id: nd.k,
        notes: { block: nd.s.name, values: Object.fromEntries(ks.filter((k) =>
          fx.s.inputs?.[k]).map((k) => [k, valOf(fx, k)])) },
        cap: ks.length ? `The template \`${tn(nd.s.name)}\` takes ${ks.map(
          (k) => `\`${k}\``).join(" and ")}`
          : `The template \`${tn(nd.s.name)}\` takes nothing`,
        form: text(ks.map(what).join("; ")),
        constructs: ["template"], source: COMPILER,
        chip: tn(nd.s.name), chipLabel: "template",
        gutters: ask((h) => h.anchors?.(cx, nd, xs)) ?? [],
        parts: [{ regions: [], rows: [variable], colours: M }],
        rows: [variable], band: tband });
      continue;
    }
    if (nd.kind === "define") {
      const into = getAt(nd.block, [...nd.at.slice(0, -2), "in"]);
      if (into && typeof into === "object" && "template" in into) {
        // the hand-off into a nested template
        const band = [...defineBand(nd), pos(nd.block, [...nd.at.slice(0,
          -2), "in"])];
        const words = ask((h) => h.handoff?.(cx, nd, xs, into));
        const t = types[into.template];
        const op = opOf(nd.s.expr);
        if (words) {
          withFormulas(step({ phase: "handoff", tkind: t?.kind, id: nd.k,
            band, ...words }), [nd]);
          continue;
        }
        const many = xs.length > 1;
        const fy = xs.find((y) => y.inst === f) ?? xs[0];
        const leafOf = (y: X) => y.leaves.find((l) => l.path !== y.inst) ??
          y.leaves[0];
        step({ phase: "handoff", tkind: t?.kind, id: nd.k, band,
          notes: { block: nd.block, values: Object.fromEntries(Object
            .entries(fy.s.bindings ?? {}).map(([k, v]) => [k,
              inputNames.includes(k) ? who(fy.inst) : small(v as Hex)])) },
          cap: `\`${nd.s.id}\` = ${exprText(nd.s.expr)}; the template ` +
            `\`${tn(into.template)}\` takes it as its \`${nd.s.id}\``,
          form: many ? table(xs.map((y) => [[who(y.inst)], [formula(y)],
            kOf(y.inst)])) : text(formula(xs[0])),
          constructs: ["define", ...(op ? [op] : [])], source: COMPILER,
          chip: nd.s.id, chipLabel: tn(into.template),
          parts: xs.map((y) => ({ regions: [], rows: [leafOf(y).path],
            colours: M, k: xs.length === 1 ? 0 : kOf(y.inst),
            dim: !every && y.inst !== f })),
          rows: xs.map((y) => leafOf(y).path) });
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
      const loc = (regionsOf(nd)[0] ?? xs[0]?.leaves[0]?.regions[0])
        ?.location ?? "storage";
      openIf.st = step({ phase: "if", id: nd.k,
        constructs: ["if"], source: READ(loc),
        chip: branches.join(" | "), chipLabel: "branch",
        band: [pos(nd.block, nd.at), ...branches.map((b) =>
          exact(nd.block, [...P, b]))] });
      (openIf.st as Any)._node = nd;
      (openIf.st as Any)._absorbed = openIf.absorbed;
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
      const band = [pos(nd.block, nd.at)];
      const rows = [...new Set(instRows(nd))];
      const parts = [{ regions: regionsOf(nd), rows, colours: M }];
      const words = ask((h) => h.read?.(cx, nd, xs));
      if (words) {
        withFormulas(step({ phase: "read", rname: name, id: nd.k, band,
          parts, rows, ...words }), [nd]);
        continue;
      }
      const r0 = xs[0].regions[0];
      const many = xs.length > 1;
      const fs = computed(xs[0].s.fields);
      const more = xs[0].regions.length - 1;
      step({ phase: "read", rname: name, id: nd.k, band, parts, rows,
        cap: `\`${name}\` is read: ${placeText(r0)}${more > 0 ? ` (and ${
          nWord(more)} more)` : ""}`,
        form: many ? table(xs.map((y) => [[who(y.inst)], [`${name} = ${
          valueText(y.regions[0])}`], kLeaf(y)]))
          : { kind: "lines", lines: [...fs.map((fl) => [fieldText(r0, fl,
            xs[0].s.bindings)]),
            [`${name} = ${valueText(r0)}`]] },
        constructs: [`region:${r0.location}`], source: READ(r0.location),
        chip: name, chipLabel: "region" });
      continue;
    }
    // a value's own region: a field, a string's data, a list's item
    const folded = pending;
    pending = [];
    const bandR = [pos(nd.block, nd.at), ...folded.flatMap((p) =>
      p.kind === "define" ? defineBand(p) : [pos(p.block, p.at)])];
    if (hs.some((h) => h.value?.(cx, nd, xs, folded, bandR))) {
      // (the step it made or joined: the last)
      withFormulas(out.at(-1)!, [...folded, nd]);
      continue;
    }
    const y0 = xs.find((y) => y.inst === f) ?? xs[0];
    const r0 = y0.regions[0];
    const lbl = (y: X) => (y.leaves.find((l) => l.path !== y.inst) ??
      y.leaves[0])?.label ?? name;
    const nameR = name ?? lbl(y0);
    const rs = regionsOf(nd);
    const fs = computed(y0.s.fields);
    const many = xs.length > 1;
    // (the defines and lists folded into it: each, as the focus has it)
    const lead: Tok[][] = folded.flatMap((p) => {
      const py = p.by.get(y0.inst) ?? [...p.by.values()][0];
      if (!py) return [];
      if (p.kind === "list") {
        const n = rs.length;
        return [[`${py.s.each} = 0…${Math.max(0, n - 1)}: ${n} ${n === 1
          ? "item" : "items"} (count = ${exprText(py.s.count)})`]];
      }
      return [[formula(py)]];
    });
    const placeOfAll = rs.length > 1
      ? `${placeText(rs[0])} … ${placeText(rs.at(-1)!)}` : placeText(r0);
    step({ phase: "value", id: nd.k, band: bandR,
      cap: many ? `Each \`${nameR}\` is at its own place`
        : `\`${nameR}\` is at ${placeOfAll}`,
      form: many ? table(xs.map((y) => [[who(y.inst)], [placeText(
        y.regions[0])], kLeaf(y)]))
        : { kind: "lines", lines: [...lead, ...fs.map((fl) =>
          [fieldText(r0, fl, y0.s.bindings)]), ...rs.length === 1
          ? [[`${lbl(y0)} = ${y0.leaves[0]?.value?.text ?? valueText(r0)}`]]
          : []] },
      constructs: [`region:${r0.location}`, ...folded.map((p) => p.kind)],
      source: COMPILER, chip: nameR, chipLabel: "region",
      parts: [{ regions: rs, rows: [...new Set(instRows(nd))],
        colours: M }],
      rows: [...new Set(instRows(nd))] });
  }

  // the steps an annotator completes (its deferred words), or adds
  for (const h of hs) h.finish?.(cx);

  // the `if` steps, now that what they took in is known
  for (const st of out.filter((y) => y.phase === "if") as Any[]) {
    const nodeIf = st._node as Nd;
    const sx = st._xs as X[];
    const absorbed = (st._absorbed ?? []) as Nd[];
    delete st._node;
    delete st._xs;
    delete st._absorbed;
    const words = ask((h) => h.branch?.(cx, st, nodeIf, sx));
    if (words) {
      withFormulas(Object.assign(st, words), [nodeIf, ...absorbed]);
      continue;
    }
    // what it lights: the regions it took in
    const regs = (i: string) => order.filter((n) => n.kind === "region" &&
      reads(n.block, n.s.name) && n.by.has(i) && n.line > nodeIf.line &&
      st.band.includes(pos(n.block, n.at))).flatMap((n) =>
      n.by.get(i)!.regions);
    const rowsOf = (i: string) => sx.find((y) => y.inst === i)!.leaves
      .map((l) => l.path);
    const cond = exprText(sx[0].s.cond.expr);
    const line = (y: X) => `${exprText(y.s.cond.expr, (a) =>
      typeof a === "string" && y.s.bindings?.[a] !== undefined
        ? small(y.s.bindings[a]) : undefined, false)} → ${y.s.branch}`;
    const branches = [...new Set(sx.map((y) => y.s.branch))];
    Object.assign(st, {
      cap: branches.length > 1 ? `The condition \`${cond}\` parts the ` +
        "instances: some take `then`, some `else`"
        : `The condition \`${cond}\` takes \`${branches[0]}\``,
      form: sx.length > 1 ? table(sx.map((y) => [[who(y.inst)], [line(y)],
        kLeaf(y)])) : text(line(sx[0])),
      parts: [{ regions: sx.flatMap((y) => regs(y.inst)),
        rows: sx.flatMap((y) => rowsOf(y.inst)), colours: M }],
      rows: sx.flatMap((y) => rowsOf(y.inst)) });
  }

  // step 0, the goal (vanilla c62550a): when the selection takes more
  // than one row or region (or reads one to find it), every row of its
  // location the walkthrough touches (but its inputs'), whole, in the
  // selection's yellow, with no label: which bytes are what is what the
  // steps find
  const ownR = leaves.filter((l) => inTarget(l.path))
    .flatMap((l) => l.regions);
  const readR = node.reads ?? [];
  const byOrder = (a: Hex, b: Hex) => toBig(a) < toBig(b) ? -1 : 1;
  // (per location: the rows touched, its own, those read to find it)
  const locs = [...new Set([...ownR, ...readR].map((r) => r.location))];
  if (!locs.length) locs.push("storage");
  const per = locs.map((l) => {
    const own = new Set(ownR.filter((r) => r.location === l)
      .flatMap(spanned));
    return { l, own,
      all: [...slotsOf(out.filter((y) => y.phase !== "input"), l)]
        .sort(byOrder),
      read: new Set(readR.filter((r) => r.location === l).flatMap(spanned)
        .filter((h) => !own.has(h))) };
  });
  const allS = per.flatMap((q) => q.all);
  const ownN = per.reduce((n, q) => n + q.own.size, 0);
  const sk = pathName(path);
  if (ownN > 1 || ownR.length + readR.length > 1) {
    const [{ l: loc, own: ownS }] = per;
    // (scattered: the selection's own rows are not one run)
    const mine = [...ownS].sort(byOrder);
    const step1 = addressing(loc) === "slot" ? 1n : 32n;
    const apart = mine.some((h, k) => k > 0 &&
      toBig(h) - toBig(mine[k - 1]) > step1);
    const none = per[0].all.filter((h) => !ownS.has(h)).length;
    const n = allS.length;
    // (one side of a pair: "After setMotd, this slot holds `motd`.")
    const when = x.when ? `${x.when[0].toUpperCase()}${x.when.slice(1)}, `
      : "";
    const up = (t: string) => when ? t : t[0].toUpperCase() + t.slice(1);
    // (rows of more than one location: places)
    const nn = per.length > 1 ? n === 1 ? "place" : "places" : noun(loc, n);
    // (rows read to find it, not its own: a local's frame pointer)
    const k = per.reduce((m, q) => m + q.read.size, 0);
    const cap = ask((h) => h.goal?.(cx, { when, up, n, noun: nn })) ??
      (k ? `${when}${up(`these ${n} ${nn} find`)} \`${sk}\`: ${ownN === 1
        ? "one holds it" : `${nWord(ownN)} hold it`}; ${k === 1
        ? "one is read to find it" : `${nWord(k)} are read to find it`}.`
        : undefined) ??
      (per.length > 1 ? `${when}${up(`these ${n} ${nn} belong to`)} \`${
        sk}\`, in ${locs.join(" and ")}.` : undefined) ??
      `${when}${up(n === 1 ? `this ${nn} holds` : `these ${n} ${nn} belong to`)
      } \`${sk}\`${apart ? `, scattered across ${loc}` : ""}${none
        ? `; ${none === 1 ? "one of them holds" : `${nWord(none)} of them hold`
        } none of its data` : ""}.`;
    out.unshift({ id: "goal", phase: "goal", goal: true, cap,
      form: text({ question: n === 1 ? "Which rules find it, and what does " +
        "it mean?" : "Which rules find them, and what do they mean?" }),
      constructs: [], source: "", chip: "", chipLabel: "",
      parts: per.map((q) => ({ regions: [], rows: [path], slots: q.all,
        ...q.l !== "storage" ? { at: q.l } : {} })),
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
    // (a plain statement of the result: "`players` holds 3 records:
    // alice, bob, carol."; "`totalScore` = 140.")
    const whoList = insts.some((i) => keyOf(i)) && t?.kind === "mapping"
      ? `: ${insts.map(who).join(", ")}` : "";
    const parts = t?.kind === "mapping" ? `${n} ${vt?.kind === "struct"
      ? n === 1 ? "record" : "records" : n === 1 ? "entry" : "entries"}${
        whoList}`
      : t?.kind === "struct" ? `${n} ${n === 1 ? "field" : "fields"}`
        : t?.kind === "array" ? `${n} ${n === 1 ? "item" : "items"}` : "";
    const said = parts ? `\`${sk}\` holds ${parts}`
      : `\`${sk}\` = ${node.value?.text ?? ""}`;
    out.push({ id: "found", phase: "found",
      cap: ask((h) => h.found?.(cx, { parts })) ?? `${said}.`,
      form: text(), constructs: [], source: "", chip: "found",
      chipLabel: sk, parts: [], rows: [path], gutters: [], band: [] });
  }
  // (and the steps an annotator adds after them: another rule's reading)
  for (const h of hs) h.extra?.(cx);
  const names = new Map<string, string>();
  for (const h of hs) h.names?.(cx).forEach((v, k) => names.set(k, v));
  return { target: path, steps: out, recs, focus: every ? "*" : f,
    variable, span: allS, names, name: sk };
}

// The rows of a location that steps touch: their regions' (whole),
// their parts' slots, their gutters (storage's: a slot computed whole)
export function slotsOf(steps: Step[], location: Location = "storage"):
  Set<Hex> {
  const out = new Set<Hex>();
  const store = location === "storage";
  for (const st of steps) {
    for (const p of st.parts) {
      for (const r of p.regions) {
        if (r.location === location) spanned(r).forEach((h) => out.add(h));
      }
      if ((p.at ?? "storage") === location) {
        for (const h of p.slots ?? []) out.add(h);
      }
      if (store) for (const h of p.wholes ?? []) out.add(h);
    }
    if (store) for (const h of st.gutters) out.add(h);
  }
  return out;
}

// the rows a region spans (storage's: slots; a segment's: its words)
function spanned(r: ResolvedRegion): Hex[] {
  if (r.location !== "storage") {
    return [...new Set(regionBytes(r).map(([row]) => row))];
  }
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
