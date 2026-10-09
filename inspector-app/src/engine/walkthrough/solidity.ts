// The storage walkthroughs' curated words (vanilla main.js replaySteps,
// at 1b0530a), as annotators of the fold: what solc's storage layout and
// the page's data mean beyond the pointer's constructs. A mapping's keys
// and where the page takes them from (`keys`); the entries by their
// on-chain `name` values, quoted (`names`); a focus per entry
// (`records`); solc's layout in its own words, each for a storage
// region only (`solidity`): a record at keccak(key, slot), a field in
// the next slot, a string's length flag and its short and long forms,
// an array's items, the packed fields of a slot as a byte strip; and
// another compiler's storage read by solc's rule (`contrast`).
import type { Colour, Hex, ResolvedRegion, ValueNode } from "../types";
import { short, toBig } from "../hex";
import { childColours } from "../light";
import type { Form, Step } from "./fold";
import {
  COMPILER, READ, nWord, type Annotator, type Cx, type Nd, type X,
} from "./hooks";

type Any = any;
const PICKS = 10;
const STORAGE = READ("storage");
const LANG = (l: string) => l[0].toUpperCase() + l.slice(1);
// (solc's rule over another compiler's storage: the Vyper scene)
const RULE = (_l: string) => "Solidity's rule";
const stored = (rs: ResolvedRegion[]) => rs.length > 0 &&
  rs.every((r) => r.location === "storage");

// bytes a–b of a region, or the slots it spans
function bytesText(r: ResolvedRegion) {
  const o = r.offset;
  const n = r.length;
  if (o + n > 32) return `${Math.ceil((o + n) / 32)} slots`;
  return o === 0 && n === 32 ? "the whole slot" : n === 1 ? `byte ${o}`
    : `bytes ${o}–${o + n - 1}`;
}
// the slots a storage region spans
const spanned = (cx: Cx, r: ResolvedRegion): Hex[] => {
  if (r.slot === undefined) return [];
  const n = Math.max(1, Math.ceil((r.offset + r.length) / 32));
  return Array.from({ length: n }, (_, k) => cx.w32(r.slot! + BigInt(k)));
};

// an instance's on-chain name: its `name` value, quoted ("" is none)
const named = (t?: string) => t && t !== '""' ? t : undefined;
export const names: Annotator = {
  id: "names",
  name: (cx, i) => named(cx.x.d.byPath.get(`${i}.name`)?.value?.text),
  names(cx) {
    const out = new Map<string, string>();
    for (const i of cx.insts) {
      const k = cx.keyOf(i);
      if (k && names.name!(cx, i)) out.set(short(k), cx.whoShort(i));
    }
    return out;
  },
};

// a mapping's keys: from the contract's own list of them (playerList,
// decoded from storage), or the trace; the step that says so
export const keys: Annotator = {
  id: "keys",
  inputs(cx) {
    const { x, insts, keyOf } = cx;
    const keyList = x.keys.from === "list" ? x.keys.path : null;
    const keyItem = (key: Hex) => {
      const list = keyList ? x.d.byPath.get(keyList) : undefined;
      const k = cx.w32(key).slice(-40);
      return list?.children?.find((ch) => ch.value?.text?.toLowerCase()
        .endsWith(k)) ?? null;
    };
    const keyed = insts.filter((i) => keyOf(i));
    if (!keyed.length) return;
    const items = keyed.map((i) => [i, keyItem(keyOf(i)!)] as const);
    const one = keyed.length === 1;
    const has = items.filter(([, it]) => it) as [string, ValueNode][];
    // (a mapping does not store its keys: the page supplies them; a key
    // the list does not have yet, from the trace: the transaction hashed
    // it with the mapping's slot)
    const TRACED = "the trace: this transaction hashed it with the " +
      "mapping's slot";
    const from = (it: ValueNode | null) => it ? `\`${it.path}\``
      : keyList ? TRACED : "the trace of the calls";
    const traced = keyList && items.some(([, it]) => !it);
    cx.step({ phase: "input", id: "input",
      cap: one ? `The key: the address of ${cx.who(keyed[0])}. A mapping ` +
        `does not store its keys; the page takes it from ${from(items[0][1])}`
        : "The keys: a mapping does not store its keys; the page takes " +
          `them from ${keyList ? `\`${keyList}\`` : "the trace of the calls"}` +
          (traced ? ", and one not listed yet from the trace (this " +
            "transaction hashed it with the mapping's slot)" : ""),
      form: one ? cx.text(cx.whoAt(keyed[0])) : cx.table(items.map(([i, it]) =>
        [[cx.whoAt(i)], [it?.label ?? "trace"], cx.srcOf(i)])),
      source: keyList ? `from: the page (${keyList}, read from storage)`
        : "from: the page (the trace)",
      chip: one ? "key" : "keys", chipLabel: keyList ?? "trace",
      parts: [{ regions: has.flatMap(([, it]) => it.regions),
        rows: has.map(([, it]) => it.path),
        colours: new Map(has.map(([i, it]) => [it.path, cx.srcOf(i)])) }],
      rows: has.map(([, it]) => it.path) });
  },
};

// a focus per entry, when there are several (a mapping's records)
export const records: Annotator = {
  id: "records",
  focus(cx) {
    const isRec = cx.insts.some((i) => cx.keyOf(i));
    return isRec && cx.insts.length > 1 ? cx.insts.map((i) => ({ path: i,
      who: cx.whoShort(i), full: cx.who(i) })) : null;
  },
};

// solc's storage layout, in its own words
export const solidity: Annotator = {
  id: "solidity",
  anchors: (cx, _nd, xs) => [...new Set(xs.map((y) => y.s.inputs?.slot?.hex)
    .filter(Boolean).map((h) => cx.w32(h)))],
  declared(cx, declared) {
    const { variable, M, x } = cx;
    const kind = cx.kindOf(cx.varNode) ?? "value";
    if (declared.context) {
      const r = declared.context;
      if (r.location !== "storage") return null;
      return {
        cap: `\`${variable}\` is at slot ${cx.small(r.slot!)}, ${r.length} ` +
          `bytes from offset ${r.offset}`,
        form: cx.strip([{ name: variable, from: r.offset, to: r.offset +
          r.length - 1, k: 0 }]),
        constructs: ["pointer"], source: COMPILER,
        chip: `slot ${cx.small(r.slot!)}`, chipLabel: "value",
        parts: [{ regions: [r], rows: [variable], colours: M }],
        rows: [variable] };
    }
    const w = cx.wordAt(declared.slot!);
    const at = `slot ${cx.small(declared.slot!)}`;
    const empty = w !== undefined && !toBig(w);
    return {
      cap: x.contrast ? `${RULE(x.contrast.language)} says \`${variable
        }\` is declared at ${at}${empty ? "; that slot holds nothing"
        : `; in ${LANG(x.contrast.language)}'s storage, that slot holds ` +
          "something else"}`
        : kind === "mapping" && empty
          ? `\`${variable}\` is declared at ${at}; that slot holds nothing`
          : `\`${variable}\` is declared at ${at}`,
      form: cx.text(),
      constructs: ["pointer"], source: COMPILER,
      chip: `slot ${cx.small(declared.slot!)}`, chipLabel: ["mapping",
        "string", "array", "struct"].includes(kind) ? kind === "struct"
        ? "record" : kind : "value",
      gutters: [cx.w32(declared.slot!)], parts: [{ regions: [],
        rows: [variable], colours: M }], rows: [variable] };
  },
  // (one spelling: keccak(alice, slot 3); slot + 1)
  handoff(cx, nd, xs, into) {
    const { types, out, who, small, tail, f, every, kOf, M } = cx;
    const t = types[into.template];
    const op = cx.opOf(nd.s.expr);
    const formula = (y: X) => {
      const v = y.s.value.hex as Hex;
      if (op === "~keccak256" && y.s.args?.length === 2) {
        const [, b] = y.s.args.map((z: Any) => z.value.hex);
        return `keccak(${cx.keyText(y.inst, xs.length === 1)}, slot ${
          small(b)}) = ${tail(v)}`;
      }
      if (op === "~sum") {
        const base = cx.inputs.get(`${y.inst}|${types[nd.block]?.kind}`)
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
    const into1 = `the template \`${cx.tn(into.template)}\` takes it as ` +
      "its `slot`";
    const rows = isRecord ? xs.map((y) => y.inst)
      : xs.map((y) => leafOf(y).path);
    const fm: Form = many ? cx.table(xs.map((y) => [[who(y.inst)],
      [formula(y)], kOf(y.inst)])) : cx.text(formula(xs[0]));
    // (its variables, as the focus has them)
    const fy = xs.find((y) => y.inst === f) ?? xs[0];
    const base = cx.inputs.get(`${fy.inst}|${types[nd.block]?.kind}`);
    const notes: Record<string, string> = {};
    if (base?.key) notes.key = cx.keyText(fy.inst);
    if (base?.slot) notes.slot = small(base.slot.hex);
    return {
      notes: { block: nd.block, values: notes },
      cap: isRecord ? `${many ? "Each record is" : "The record is"} ` +
        `at keccak(key, slot ${slotN}); ${into1}`
        : `\`${fname(xs[0])}\` is in the next slot, slot + 1; ${into1}`,
      form: hashGloss && fm.kind === "text" ? cx.text(formula(xs[0]),
        { prose: "  (keccak of two 32-byte words: the key, then the " +
          "slot)" }) : fm,
      constructs: ["define", ...(op ? [op] : [])],
      source: COMPILER,
      chip: isRecord ? `keccak(key, slot ${slotN})` : fname(xs[0]),
      chipLabel: isRecord ? "record" : cx.tn(into.template),
      // (the computed slots, lit whole, as a region is: in each
      // entry's colour; one entry alone, the selection's yellow;
      // with one entry in focus, the others echo)
      parts: xs.map((y) => ({ regions: [], rows: [isRecord ? y.inst
        : leafOf(y).path], colours: M, k: xs.length === 1 ? 0
        : kOf(y.inst), dim: !every && y.inst !== f,
        wholes: [cx.w32(y.s.value.hex)] })),
      rows };
  },
  read(cx, nd, xs) {
    if (!stored(cx.regionsOf(nd))) return null;
    const name = nd.s.name as string;
    const vals = xs.map((y) => [y, y.regions[0]] as const);
    const byte = (r: ResolvedRegion) => {
      const wv = cx.wordAt(r.slot!) ?? "0x0";
      if (name === "length-flag") return `0x${cx.w32(wv as Hex).slice(-2)}`;
      return String(toBig(wv));
    };
    const many = xs.length > 1;
    // (the rule in the caption, the value in the form)
    // (a string by its own name: `name`, `motd`)
    const sname = (xs[0].leaves[0]?.path ?? "").split(".").pop()!
      .replace(/\[.*$/, "");
    const lbl = name === "length-flag" ? `The last byte of \`${sname
      }\`'s slot is its length flag` : name === "length" ? `Slot ${cx.small(
        vals[0][1].slot!)} holds the length` : `\`${name}\` is read`;
    return {
      cap: many && name === "length-flag" ? "The last byte of each " +
        `\`${sname}\` slot is its length flag` : lbl,
      form: many ? cx.table(vals.map(([y, r]) => [[cx.who(y.inst)], [byte(r)],
        cx.kLeaf(y)])) : cx.strip([{ name: `${name} = ${byte(vals[0][1])}`,
        from: vals[0][1].offset, to: vals[0][1].offset +
          vals[0][1].length - 1, k: cx.kLeaf(vals[0][0]) }]),
      constructs: ["region"], source: STORAGE,
      chip: name === "length-flag" ? "flag" : name,
      chipLabel: name === "length" ? "array" : "string" };
  },
  value(cx, nd, xs, folded, bandR) {
    if (!stored(cx.regionsOf(nd))) return false;
    const { order, declared, M, out, tail, small } = cx;
    const name = nd.s.name as string;
    const prev = out.at(-1) as Any;
    const parent = nd.at.slice(0, -1).join(".");
    const instRows = cx.instRows(nd);
    if (name === "item" || folded.some((p) => p.kind === "list")) {
      const data = folded.find((p) => p.kind === "define");
      const base = data ? [...data.by.values()][0].s.args?.[0]?.value.hex
        ?? declared?.slot : declared?.slot;
      const start = data ? [...data.by.values()][0].s.value.hex : null;
      const idx = order.find((n) => n.kind === "list");
      const is = idx ? [...idx.by.values()].map((y) => +y.s.index)
        .sort((a, b) => a - b) : [];
      const one = is.length === 1;
      cx.step({ phase: "item", id: nd.k,
        cap: one ? `The items start at keccak(slot ${small(base!)})`
          : `The items start at keccak(slot ${small(base!)}), one slot each, ` +
            "for `length` items",
        form: cx.text(`keccak(slot ${small(base!)}) = ${start ? tail(start)
          : "?"}${one ? `; item ${is[0]} at + ${is[0]}` : `; items ${is[0]}…${
          is.at(-1)} at + i`}`),
        constructs: ["~keccak256", "list"], source: COMPILER,
        chip: `keccak(slot ${small(base!)})`, chipLabel: "items",
        parts: [{ regions: cx.regionsOf(nd), rows: instRows, colours: M }],
        rows: instRows, band: bandR });
      return true;
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
      cx.step({ phase: "data", id: nd.k,
        cap: many ? long ? "Each long text starts at keccak(its slot)"
          : "Each short text is in its slot, from the left"
          : long ? `The text starts at keccak(slot ${tail(startOf)}) = ${
            tail(one.regions[0].slot!)}: ${lenOf(one)} bytes over ${slots(one)
            } ${slots(one) === 1 ? "slot" : "slots"}`
            : `The text is in the slot itself: ${lenOf(one)} bytes from ` +
              "the left",
        form: many ? cx.table(xs.map((y) => [[cx.who(y.inst)], [`${lenOf(y)
          } bytes at ${tail(y.regions[0].slot!)}`], cx.kLeaf(y)]))
          : cx.text(xs[0].leaves.at(-1)!.value?.text ?? ""),
        constructs: long ? ["~keccak256", "region"] : ["region"],
        source: COMPILER, chip: long ? "keccak(slot …)"
          : "inline", chipLabel: "text",
        parts: [{ regions: cx.regionsOf(nd), rows: [...new Set(instRows)],
          colours: M }],
        rows: [...new Set(instRows)], band: bandR });
      return true;
    }
    // fields: the siblings in one group, one step
    if (prev?.phase === "fields" && prev._parent === `${nd.block}|${parent}`
      && !folded.length) {
      prev._nodes.push(nd);
      prev.band.push(...bandR);
      return true;
    }
    const st = cx.step({ phase: "fields", id: `fields|${nd.block}|${parent}`,
      band: bandR, constructs: ["region"], source: COMPILER,
      chipLabel: "fields" }) as Any;
    st._parent = `${nd.block}|${parent}`;
    st._nodes = [nd];
    return true;
  },
  // the fields steps, now that their nodes are known: the packed fields
  // of a slot, as a byte strip
  finish(cx) {
    const { out, insts, kOf, M, f, every, instOf } = cx;
    // a field's colour at the packed fields: its own in the
    // walkthrough's colours where it has one (the selection is its
    // record, or the field itself); else, with several entries shown, a
    // colour no entry uses
    const fieldColours = () => {
      const used = new Set(insts.map(kOf));
      const free = [...Array(PICKS).keys()].slice(1).filter((k) =>
        !used.has(k as Colour)) as Colour[];
      const fc = childColours(cx.x.d, f, 9);
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
    for (const st of out.filter((y) => y.phase === "fields") as Any[]) {
      const kc = fieldColours();
      const fs = (st._nodes as Nd[]).flatMap((nd) => [...nd.by.values()]
        .map((y) => ({ y, nd, leaf: y.leaves[0], region: y.regions[0] })));
      const mine = fs.filter((z) => z.y.inst === f);
      const items = [...mine].sort((a, b) => a.region.offset -
        b.region.offset);
      const n = st._nodes.length;
      const nm = (z: typeof fs[0]) => z.leaf.path.slice(z.y.inst.length)
        .replace(/^\./, "") || z.leaf.label;
      const row = items[0] && cx.w32(items[0].region.slot!);
      Object.assign(st, {
        cap: n > 1 ? `The first slot packs ${nWord(n)} fields, from ` +
          "the right"
          : `\`${nm(items[0])}\` is ${bytesText(items[0].region)} of the ` +
            "record's first slot",
        // (the byte strip: the word, its fields over their bytes)
        form: cx.strip(items.map((z) => ({ path: z.leaf.path, name: nm(z),
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
  },
  // a string's form, by the last byte of its slot (the length flag)
  branch(cx, st, nodeIf, sx) {
    const { order, wordAt, w32, f, who, tail, M, kLeaf, reads, pos } = cx;
    const flagNode = order.find((n) => n.kind === "region" && n.s.name ===
      "length-flag");
    if (!flagNode || !stored(cx.regionsOf(flagNode))) return null;
    const branchOf = new Map(sx.map((y) => [y.inst, y.s.branch]));
    const flagOf = (i: string) => {
      const r = flagNode.by.get(i)?.regions[0];
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
      return flagNode.by.get(i)?.regions ?? [];
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
    const branches = [...new Set(sx.map((y) => y.s.branch as string))];
    return {
      chip: branches.length > 1 ? "short | long" : branches[0] === "then"
        ? "short" : "long",
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
        : many ? cx.table(sx.map((y) => [[who(y.inst)], [line(y)],
          kLeaf(y)])) : cx.text(line(sx[0])),
      parts: [{ regions: sx.flatMap((y) => regs(y.inst)),
        rows: sx.flatMap((y) => rowsOf(y.inst)), colours: M }],
      rows: sx.flatMap((y) => rowsOf(y.inst)) } as Partial<Step>;
  },
};

// another compiler's storage, read by solc's rule: the first and last
// steps say whose rule it is; the walkthrough ends by naming the
// misread, with that compiler's own layout, hand-written for comparison
// (no ethdebug from it): its words for the selection, in a colour of
// their own
export const contrast: Annotator = {
  id: "contrast",
  goal(cx, { when, up, n }) {
    const foreign = cx.x.contrast;
    if (!foreign) return null;
    return `${when}${up("these")} are the ${n === 1 ? "slot"
      : `${n} slots`} ${RULE(foreign.language)} would read for \`${
      cx.pathName(cx.path)}\`.`;
  },
  found(cx, { parts }) {
    const foreign = cx.x.contrast;
    if (!foreign) return null;
    const sk = cx.pathName(cx.path);
    return `${RULE(foreign.language)} reads ${parts
      ? `\`${sk}\` as ${parts}` : `\`${sk}\` = ${cx.node.value?.text ?? ""}`}.`;
  },
  extra(cx) {
    const foreign = cx.x.contrast;
    const { out, path, node, M, tail, wordAt, entryPath } = cx;
    if (!foreign || !out.length) return;
    const cd = foreign.d;
    const L = LANG(foreign.language);
    const sk = cx.pathName(path);
    const words: { slot: Hex; name: string; text: string;
      r: ResolvedRegion }[] = [];
    const visitC = (n: ValueNode) => {
      for (const r of n.regions) {
        if (r.slot === undefined) continue;
        words.push({ slot: cx.w32(r.slot), r, name: n.path.slice(
          (entryPath(n.path) ?? "").length).replace(/^\./, "") || n.label,
        text: r.role === "length" ? "length" : n.value?.text ?? "" });
      }
      (n.children ?? []).forEach(visitC);
    };
    const mine = cd.byPath.get(path);
    if (mine) visitC(mine);
    if (!words.length) return;
    const ownR = cx.leaves.filter((l) => cx.inTarget(l.path))
      .flatMap((l) => l.regions);
    const read = node.value?.text;
    const theirs = mine?.value?.text;
    const one = words.length === 1;
    // (what the slots Solidity's rule read hold in this storage)
    const solS = [...new Set(ownR.flatMap((r) => spanned(cx, r)))];
    const blank = solS.every((h) => !toBig(wordAt(h) ?? "0x0"));
    out.push({ id: "external", phase: "external",
      cap: `The misread: ${L} keeps \`${sk}\` ${one ? `in slot ${tail(
        words[0].slot)}` : "in other slots"}${theirs !== undefined
        ? `, where it is ${theirs}` : ""}; ${RULE(foreign.language)} ${
        read !== undefined ? `read ${read} ` : "read "}from ${solS.length
        === 1 ? `slot ${tail(solS[0])}` : "slots"} where ${L} keeps ${
        blank ? "nothing" : "other data"}.`,
      form: cx.table(words.map((w) => [[tail(w.slot)], [w.r.role === "length"
        ? `${w.name} (length)` : `${w.name} = ${w.text}`], 9])),
      constructs: [], source: `from: ${L}'s layout, hand-written for ` +
        `comparison (${L} emits no ethdebug)`, chip: L,
      chipLabel: "hand-written",
      parts: [{ regions: words.map((w) => w.r), rows: [], k: 9 },
        { regions: ownR, rows: [path], colours: M }],
      rows: [path], gutters: [], band: [] });
  },
};
