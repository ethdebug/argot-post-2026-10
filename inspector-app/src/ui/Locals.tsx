// The memory section's own views (vanilla mem.js): the details of what
// is pointed at (#mdetails), how the selection was found (#mhow), the
// source with the paused instructions marked (#msrc and its legend),
// and the lines about the pause (#mnote, #mviewing, #mmeta)
import { Fragment, type ReactNode } from "react";
import type { Decoded, Path, ValueNode } from "../engine/types";
import { derivation, readText, shown, span, type Item }
  from "../engine/derivation";
import { short } from "../engine/hex";
import {
  useCompilation, useDecoded, useLayout, useLens, useLensState, useLink,
  usePoint,
} from "./hooks";
import type { DataRef, ViewId } from "./types";

const hex4 = (n: number) => "0x" + n.toString(16).padStart(4, "0");
const C = ({ children }: { children: ReactNode }) => <code>{children}</code>;

// both sides of the pause: [before, after] (one point: after only)
function useSides(data: DataRef) {
  const single = useLensState((s) => s.points.a === s.points.b);
  const a = useDecoded({ ...data, point: { slot: "a" } });
  const b = useDecoded({ ...data, point: { slot: "b" } });
  const pa = usePoint({ ...data, point: { slot: "a" } });
  const pb = usePoint({ ...data, point: { slot: "b" } });
  return { single, before: single ? undefined : a, after: b, pa, pb };
}

// where a value is, in words
// (a function's: its frame, or none)
const whereOf = (n?: ValueNode) => !n ? "not listed" : n.none
  ? "no location at this point" : n.regions[0] && !n.kind
    ? span(n.regions[0]) : n.value?.text ?? "";

// ------------------------------------------------------------ details

export function LocalsDetails(p: { id: ViewId; data: DataRef;
  domId?: string; link?: string }) {
  const { single, before, after, pa, pb } = useSides(p.data);
  const { l } = useLayout(p.id, undefined, p.data);
  const [link] = useLink(p.link);
  const t = link.hover ?? (link.selection ? { path: link.selection } : null);
  let info: [string, ReactNode][] | null = null;
  const at = (d: Decoded | undefined, q: Path) => d?.byPath.get(q);
  if (t?.path && after?.byPath.has(t.path)) {
    const n = at(after, t.path)!;
    info = [["Value", <><C>{t.path}</C> ({n.typeText})</>]];
    const val = (x?: ValueNode) => `${whereOf(x)}${x?.regions[0] &&
      !x.kind && x.value ? ` = ${x.value.text}` : ""}`;
    if (!single) {
      info.push(["Before", val(at(before, t.path))],
        ["After", val(n)]);
    } else {
      info.push(["Where", whereOf(n)]);
      if (n.regions[0] && !n.kind && n.value) {
        info.push(["Holds", n.value.text]);
      }
    }
  } else if (t?.bytes && l) {
    const { row, from, to, location } = t.bytes;
    const ids = (l.cover.get(`${location}|${row}|${from}`) ?? []);
    const h = (pt: typeof pa) => {
      const m = pt?.snapshot;
      if (location === "storage") {
        const w = m?.storage.get(row);
        return w ? "0x" + w.slice(2 + from * 2, 2 + (to + 1) * 2) : "—";
      }
      const o = Number(BigInt(row));
      const mem = m?.memory ?? new Uint8Array();
      if (o + to >= mem.length) return "not in memory";
      return "0x" + [...mem.slice(o + from, o + to + 1)].map((x) =>
        x.toString(16).padStart(2, "0")).join("");
    };
    const range = from === to ? `byte ${from}` : `bytes ${from}–${to}`;
    const where = location === "storage"
      ? `${range} of storage slot ${short(row)}`
      : `${range} of word ${row} (${hex4(Number(BigInt(row)) + from)}–${
        hex4(Number(BigInt(row)) + to)})`;
    info = [ids.length ? ["Values", <C>{ids.join(", ")}</C>]
      : ["Value", "none shown owns these bytes"], ["Bytes", where],
    ...(!single ? [["Before", <C>{h(pa)}</C>], ["After", <C>{h(pb)}</C>]]
      : [["Hex", <C>{h(pb)}</C>]]) as [string, ReactNode][]];
  } else if (t?.row) {
    // (a storage slot's address is a whole word)
    const store = t.row.length > 10;
    const w = Number(BigInt(t.row));
    info = [[store ? "Slot" : "Word", <C>{store ? t.row
      : `word ${t.row} (${hex4(w)}–${hex4(w + 31)})`}</C>]];
  } else if (t?.region) {
    info = [["Region", <C>{t.region.name}</C>],
      ["Where", span(t.region)]];
  }
  return <div id={p.domId} className="details" aria-live="polite"
    data-view={`${useLens().key}:${p.id}`}>
    {info ? <dl>{info.map(([k, v]) => <Fragment key={k}><dt>{k}</dt>
      <dd>{v}</dd></Fragment>)}</dl>
      : <p className="muted">Point at a value or a byte for its
        details.</p>}</div>;
}

// --------------------------------------------------- how it was found

const Steps = ({ xs }: { xs: [string, ReactNode][] }) =>
  <ol className="steps">{xs.map(([k, c]) => <li key={k}>
    <span className="k">{k}</span><div className="c">{c}</div></li>)}</ol>;
const ex = (e: unknown) => <C>{JSON.stringify(e)}</C>;

function itemOf(x: Item, path: string, side: string, two: boolean,
  hover: (r: Item, side: string) => void, evals?: ReactNode) {
  const at = x.kind === "start" ? {} : { "data-region": JSON.stringify(
    x.region, (_, v) => typeof v === "bigint" ? String(v) : v),
  "data-side": side, tabIndex: 0, onPointerOver: () => hover(x, side),
  onFocus: () => hover(x, side) };
  if (x.kind === "start") {
    return <li key="start"><span className="k">Start</span><div className="c">
      <C>{path}</C> is a local in memory here <span className="tag">from
      bugc</span><br />Its pointer is in the variables context of the
      paused instruction.{evals}</div></li>;
  }
  if (x.kind === "region") {
    const t = readText(x.name, x.read);
    return <li key={x.key} {...at}><span className="k">Region</span>
      <div className="c"><C>{x.name}</C>: {x.fields.map((f, k) =>
        <Fragment key={f.field}>{k ? "; " : ""}{f.field}{" "}
          {typeof f.expr === "object" ? <>{ex(f.expr)} = </> : null}
          <b>{shown(f.value)}</b>{f.args && <div className="args">where{" "}
            {f.args.map((a, j) => <Fragment key={j}>{j ? ", " : ""}
              {ex(a.expr)} = <b>{shown(a.value)}</b></Fragment>)}</div>}
        </Fragment>)}.
        <div>Holds {t.what}, {x.name === "-frame" ? <b>{t.value}</b>
          : <C>{t.value}</C>}</div>{evals}</div></li>;
  }
  return <li key="result" className="final" {...at}>
    <span className="k">Result</span><div className="c">memory{" "}
      {span(x.region)}, {x.region.length} bytes.
      <div>Read{two ? ` ${side} the step` : ""}: <b>{x.text}</b></div>
      {evals}</div></li>;
}

export function Derivation(p: { id: ViewId; data: DataRef;
  domId?: string; link?: string }) {
  const { single, before, after, pa, pb } = useSides(p.data);
  const lens = useLens();
  const side = useLensState((s) => single ? "after" : s.side ?? "after");
  const opt = useLensState((s) => s.bookmark?.split("/")[0]
    .slice(1) ?? "0");
  const [link, setLink] = useLink(p.link);
  const record = (single ? pb : pb ?? pa)?.record;
  const sel = link.selection;
  const box = (body: ReactNode) => <div id={p.domId} className="how"
    aria-live="polite" data-view={`${lens.key}:${p.id}`}>{body}</div>;
  const mine = side === "before" ? before : after;
  const n = sel ? mine?.byPath.get(sel) ?? after?.byPath.get(sel) : null;
  if (!sel || !n) {
    return box(<p className="muted howrest">Click any value, or a byte in
      the words, to see how the page found it.</p>);
  }
  const head = <p className="howhead"><C>{n.path}</C>{" "}
    <span className="type">{n.typeText}</span></p>;
  const hover = (x: Item, sd: string) => x.kind !== "start" &&
    setLink((s) => ({ ...s, hover: { region: x.region,
      side: sd as "before" | "after" } }));
  if (n.kind === "group") {
    const frame = n.regions[0];
    return box(<>{head}{!frame ? <Steps xs={[["Inlined", <>At -O{opt},
      bugc inlines <C>{n.path}</C>: no call, no frame.</>],
    ["Locals", <>Each of its locals' pointers is a fixed memory offset
      (pick one to see it).</>]]} /> : <Steps xs={[["Call", <>At -O{opt},{" "}
      <C>{n.path}</C> runs as a call, with a frame in memory.</>],
    ["Frame", <>The word at <C>{hex4(frame.offset)}</C> holds the
      frame's address, <b>{n.value!.text.slice(9)}</b>.</>],
    ["Locals", <>Each local's pointer reads that word (region{" "}
      <C>-frame</C>) and adds its own offset (pick one to see it).</>]]}
    />}</>);
  }
  if (n.kind === "record" || (record && n.root === record.path)) {
    const r = record!;
    const member = !n.kind;
    return box(<>{head}<Steps xs={[
      ["Start", <><C>players</C> is in storage at slot <b>{r.base}</b>{" "}
        <span className="tag">from bugc</span><br />bugc's pointer for it
        gives its base slot only.</>],
      ["Key", <><C>msg.sender</C> = <C>{r.key}</C>, alice.</>],
      ["Slot", <>keccak256(key . {r.base}) = <C>{r.slot}</C>{" "}
        <span className="tag">BUG's rule</span></>],
      ...(member ? [["Bytes", <><C>{n.label}</C>: {span(n.regions[0])}
        (byte 0 is the most significant), packed from the low end as
        Solidity does <span className="tag">BUG's rule</span></>]] : []) as
        [string, ReactNode][],
      ["Value", member ? <><b>{n.value?.text}</b>, from the slot as the
        trace has it at this step</> : <>the slot as the trace has it at
        this step: before the transaction, then each SSTORE to it so
        far</>]]} /></>);
  }
  const v = mine?.byPath.get(sel);
  if (!v || v.none) {
    return box(<>{head}<p className="small">bugc lists <C>{n.path}</C>{" "}
      here with its type and no pointer: no location at this point.</p></>);
  }
  // At a two-step point, the other side's derivation beside this one:
  // shared steps once, a step that evaluates differently with both
  // evaluations; where the two part, the rest as two lists
  const other = side === "before" ? "after" : "before";
  const A = derivation(mine!, (side === "before" ? pa : pb)!.snapshot,
    sel)!;
  const od = single ? undefined : (other === "before" ? before : after);
  const ov = od?.byPath.get(sel);
  const B = ov && !ov.none ? derivation(od!, (other === "before" ? pa
    : pb)!.snapshot, sel) : null;
  let k = B ? 0 : A.length;
  while (B && k < A.length && k < B.length && A[k].key === B[k].key) k++;
  const forked = !!B && (k < A.length || k < B.length);
  const two = !single;
  const dual = (x: Item, i: number) => {
    const y = B?.[i];
    if (!y || x.eval === y.eval) return itemOf(x, n.path, side, two, hover);
    const [a, b] = side === "before" ? [x, y] : [y, x];
    return itemOf(x, n.path, side, two, hover, <div className="evals">
      <div><span className="ev-tag">before</span> {a.eval}</div>
      <div><span className="ev-tag">after</span> {b.eval}</div></div>);
  };
  const list = (xs: Item[], sd: string, cls: string) =>
    <div className={`branch ${cls}`}><p className="branch-head">
      <span className="ev-tag">{sd}</span></p>
      <ol className="steps" start={k + 1}
        style={{ counterReset: `step ${k}` }}>{xs.slice(k).map((x) =>
          itemOf(x, n.path, sd, two, hover))}</ol></div>;
  const same = !!B && !forked && A.every((x, i) => x.eval === B[i].eval);
  return box(<>{head}{two && <p className="howside">For the memory{" "}
    <b>{side}</b> the step.{same ? " The same steps find the same bytes " +
      "before and after." : ""}{forked ? <> From step {k + 1}, the two
      differ: bugc points <C>{n.path}</C> at another word.</> : null}
    {B ? "" : " The other side lists it with no location."}</p>}
    <ol className="steps">{A.slice(0, k).map(dual)}</ol>
    {forked && <>{list(A, side, "mine")}{list(B!, other, "theirs")}</>}
    <p className="muted small">The library's dereference() returned these
      regions for bugc's pointer and read them. The steps above walk
      through the pointer with the library's evaluator; they agree.</p>
  </>);
}

// ------------------------------------------------------------- source

// The source, with the paused instructions' code ranges marked: one
// point's, or the two steps' (before, after); and its legend
export function Source(p: { id: ViewId; data: DataRef; domId?: string;
  part?: "legend" }) {
  const lens = useLens();
  const { single, pa, pb } = useSides(p.data);
  const c = useCompilation(p.data);
  if (p.part === "legend") {
    return <span className="legend" id={p.domId}>{single
      ? <mark className="mb">paused here</mark> : <><mark className="ma">
        before</mark> <mark className="mb">after</mark></>}</span>;
  }
  const src = c?.sources[0]?.text ?? "";
  const bytes = new TextEncoder().encode(src);
  const cls = new Array<string>(bytes.length).fill("");
  for (const [pt, k] of single ? [[pb, "b"] as const]
    : [[pa, "a"] as const, [pb, "b"] as const]) {
    const r = pt?.paused?.range;
    if (!r) continue;
    for (let i = r.offset; i < r.offset + r.length; i++) cls[i] += k;
  }
  const out: ReactNode[] = [];
  const dec = new TextDecoder();
  for (let k = 0; k < bytes.length;) {
    let e = k;
    while (e < bytes.length && cls[e] === cls[k]) e++;
    const t = dec.decode(bytes.slice(k, e));
    out.push(cls[k] ? <mark key={k} className={`m${cls[k]}`}>{t}</mark>
      : t);
    k = e;
  }
  return <pre id={p.domId} className="src"
    data-view={`${lens.key}:${p.id}`}>{out}</pre>;
}

// --------------------------------------------------------------- note

const NOTES: Record<string, (inl: string) => string> = {
  roll: () => "Just after `let hit = rolledHit()`: the first step where " +
    "bugc gives hit a location.",
  mult: (inl) => `Inside multiplied(10, 3), ${inl}: the two steps around ` +
    "`m = combo`, the first where all three locals have a location with " +
    "m = 5, then with m = 3.",
  writes: () => "gained = 30, just before the SSTORE that adds it to her " +
    "score; her record slot as the trace has it then (every counter but " +
    "score already written).",
};

// a line about the pause; or the selection ("viewing …"); or the
// program and compiler
export function Note(p: { id: ViewId; data: DataRef; domId?: string;
  part: "note" | "viewing" | "meta"; link?: string }) {
  const lens = useLens();
  const { single, pa, pb } = useSides(p.data);
  const c = useCompilation(p.data);
  const [link] = useLink(p.link);
  const id = useLensState((s) => s.bookmark ?? "");
  if (p.part === "viewing") {
    const sel = link.selection;
    return <span id={p.domId} className="viewing" hidden={!sel}>{sel
      ? `viewing ${sel} · Esc to clear` : ""}</span>;
  }
  if (p.part === "meta") {
    const m = c?.compiler.match(/\(ethdebug\/format (\S+), (\w+)\)/);
    // (kept, hidden, as vanilla's since ab53776: the About page says it)
    return <p className="meta" id={p.domId} hidden>Program{" "}
      <code>{c?.sources[0]?.path}</code>, alice's third hit, compiled by
      bugc from ethdebug/format {m?.[1] === "main" ? "main"
        : <>branch <code>{m?.[1]}</code></>} (commit <code>{m?.[2]}</code>).
    </p>;
  }
  const [o, pt] = id.split("/");
  const steps = (single ? [pb] : [pa, pb]).map((x) => x?.paused);
  const inl = o === "O0" ? "a real call, with its frame"
    : "inlined: no call, no frame";
  const text = NOTES[pt]?.(inl) ?? "";
  return <p id={p.domId} className="summary">{`${text} At -O${
    o?.slice(1)}: ${steps.map((s) => `step ${s?.step} (${s?.op})`)
    .join(" and ")} of ${steps[0]?.of}.`}</p>;
}
