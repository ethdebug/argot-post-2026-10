// The program x-ray (the post's "underneath, the data soldb reads"): a
// compiler's ethdebug program, as it wrote it, for Arcade's play(), from
// solc and from Fe side by side (the files the real debugger loads;
// bin/xray-data.mjs cuts play's instructions out, each entry
// unchanged). Each column: the instructions, a row each (byte offset,
// opcode, the source text in brief); the chosen one's entry, as YAML,
// each field's name a popover saying what it is; under it, a small code
// panel with its range lit. Pointing at a row shows its entry and lights
// its range; a click (a tap) chooses it, and the arrow keys move the
// choice in a focused list. Both open at the plays update. Nothing is
// normalized: solc's PUSHes carry their bytes, Fe's do not; Fe writes
// fields of its own, and instructions with no context (its rows muted);
// each shows as written. The box keeps its size whatever is shown
// (data-ready at once: its data is in the bundle).
import {
  useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent,
  type ReactNode,
} from "react";
import { charAt, intoView, lines, useColoured } from "../ui/Code";
import { ResetButton } from "../ui/Reset";
import data from "./xray-data.json" with { type: "json" };

type Json = null | boolean | number | string | Json[] |
  { [k: string]: Json };
export interface Entry { offset: number; operation?: { mnemonic: string;
  arguments?: string[] }; context?: { code?: { source: { id: number };
    range: { offset: number; length: number } } }; [k: string]: Json |
  undefined }
interface Program { compiler: string; file: string; list: string;
  source: { path: string; text: string }; at: number; total: number;
  instructions: Entry[] }

const LANGS = [["sol", "Solidity", "solc"], ["fe", "Fe", "Fe"]] as const;
type Lang = typeof LANGS[number][0];
const PROGRAMS = data as Record<Lang, Program>;
// The instruction each column opens at: play()'s plays update, as the
// real debugger's (solc: the first of `player.plays += 1`; Fe: the
// first of `store.plays.set(…)`)
export const OPEN: Record<Lang, number> = { sol: 4432, fe: 6463 };
const GRAMMAR: Record<Lang, string> = { sol: "solidity", fe: "fe" };
// (the keys that move a focused list's choice: by one, or to an end)
const KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowUp: (i) => i - 1, ArrowLeft: (i) => i - 1,
  ArrowDown: (i) => i + 1, ArrowRight: (i) => i + 1,
  Home: () => 0, End: (_, n) => n - 1 };

// What each field is, in a few words, by its path (an array's items
// as "[]"); a field of a compiler's own, outside the format, says so
const FIELDS: Record<string, string> = {
  "offset": "where the instruction starts: its byte offset in the " +
    "bytecode",
  "operation": "the instruction itself",
  "operation.mnemonic": "its opcode",
  "operation.arguments": "the bytes it pushes",
  "context": "what the compiler says the instruction means",
  "context.code": "the source it came from",
  "context.code.source": "which source file",
  "context.code.source.id": "the file's id in the compilation",
  "context.code.range": "where in that file",
  "context.code.range.offset": "the range's first byte in the file",
  "context.code.range.length": "how many bytes it spans",
  "fe_origin_key": "Fe's own field, outside the format: its key for " +
    "this instruction",
  "confidence": "Fe's own field, outside the format: how sure it is " +
    "of the range",
  "classification": "Fe's own field, outside the format: what kind of " +
    "code this is",
};

// an instruction's range, or none
const rangeOf = (e?: Entry) => e?.context?.code?.range;

// a range's text in brief: its first line, its spaces closed up
function brief(text: string, from: number, to: number) {
  const t = text.slice(from, to).trim();
  const first = t.split("\n")[0].replace(/\s+/g, " ");
  return first === t.replace(/\s+/g, " ") ? first : `${first} …`;
}

// A scalar as YAML: a plain word when it reads as the same string,
// else double-quoted (JSON's escapes are YAML's)
const scalar = (v: Json) => typeof v === "string" &&
  !/^[A-Za-z_][\w./-]*$/.test(v) || /^(true|false|null|~|yes|no|on|off)$/i
  .test(String(v)) ? JSON.stringify(v) : String(v);
// (a flow collection's room: on one line when its scalars fit)
const flat = (v: Json) => v !== null && typeof v === "object" &&
  Object.values(v).every((x) => x === null || typeof x !== "object");

// One entry, as YAML (the compiler's JSON, its keys in its order): a
// field a line, a collection of scalars in flow style where it fits in
// `cols` characters; each field's name a popover's anchor
function yaml(v: Record<string, Json>, path: string, ind: number,
  out: ReactNode[][], cols: number) {
  const pad = "  ".repeat(ind);
  for (const [k, x] of Object.entries(v)) {
    const sub = path ? `${path}.${k}` : k;
    const line: ReactNode[] = [pad, key(k, sub), ":"];
    const fits = flat(x) && `${pad}${k}: { ${Object.entries(x as object)
      .map(([j, y]) => `${j}: ${scalar(y)}`).join(", ")} }`.length <= cols;
    if (x === null || typeof x !== "object") line.push(" ", scalar(x));
    else if (Array.isArray(x) && fits) {
      line.push(` [ ${x.map(scalar).join(", ")} ]`);
    }
    else if (Array.isArray(x)) {
      out.push(line);
      x.forEach((y) => out.push([`${pad}  - ${scalar(y)}`]));
      continue;
    }
    else if (fits) {
      const ks = Object.keys(x);
      line.push(" { ");
      ks.forEach((j, n) => line.push(key(j, `${sub}.${j}`), ": ",
        scalar(x[j]), n < ks.length - 1 ? ", " : ""));
      line.push(" }");
    }
    out.push(line);
    if (x !== null && typeof x === "object" && !fits &&
      !Array.isArray(x)) yaml(x, sub, ind + 1, out, cols);
  }
}

// a field's name, and its popover (under it, over the lines below)
function key(k: string, path: string) {
  const what = FIELDS[path];
  return <span key={path} className="xkey" data-field={path}>
    <span className="xname" tabIndex={what ? 0 : undefined}
      aria-description={what}>
      {k}</span>
    {what && <span className="pop under wrap xpop" aria-hidden="true">
      {what}</span>}</span>;
}


// (how many characters a line of a box holds)
function useCols(box: React.RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState(44);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const probe = document.createElement("span");
      probe.textContent = "0".repeat(20);
      el.append(probe);
      const ch = probe.getBoundingClientRect().width / 20;
      probe.remove();
      const cs = getComputedStyle(el);
      const w = el.clientWidth - parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      if (ch) setCols(Math.floor(w / ch));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);
  return cols;
}

// One compiler's column: its instructions, the chosen one's entry, its
// source with the range lit
function Column(p: { lang: Lang; title: string; chosen: number;
  choose(k: number): void }) {
  const { lang } = p;
  const prog = PROGRAMS[lang];
  const [hover, setHover] = useState<number>();
  const i = hover ?? p.chosen;
  const e = prog.instructions[i];
  const text = prog.source.text;
  const r = rangeOf(e);
  const coloured = useColoured(text, GRAMMAR[lang]);
  const mark = r && { from: charAt(text, r.offset),
    to: charAt(text, r.offset + r.length), className: "rng" };
  const briefs = useMemo(() => prog.instructions.map((x) => {
    const q = rangeOf(x);
    return q ? brief(text, charAt(text, q.offset), charAt(text,
      q.offset + q.length)) : "";
  }), [prog, text]);

  const box = useRef<HTMLPreElement>(null);
  const cols = useCols(box);
  const pre = useRef<HTMLPreElement>(null);
  // (the range a third of the way down, each time it changes: the
  // panel is small, and a range at its edge reads as none)
  useLayoutEffect(() => intoView(pre.current, true),
    [mark?.from, mark?.to, coloured]);
  // (the chosen row in its list's view: the list's box scrolls, never
  // the page)
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const b = list.current;
    const row = b?.querySelector<HTMLElement>(`li[data-k="${p.chosen}"]`);
    if (!b || !row) return;
    const top = row.offsetTop - b.offsetTop;
    if (top < b.scrollTop || top + row.offsetHeight > b.scrollTop +
      b.clientHeight) {
      b.scrollTop = Math.max(0, top - Math.round(b.clientHeight / 3));
    }
  }, [p.chosen]);
  const onKey = (ev: KeyboardEvent) => {
    const to = KEYS[ev.key];
    if (!to || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    ev.preventDefault();
    setHover(undefined);
    const n = prog.instructions.length;
    p.choose(Math.max(0, Math.min(n - 1, to(p.chosen, n))));
  };

  const rows: ReactNode[][] = [];
  if (e) yaml(e as unknown as Record<string, Json>, "", 0, rows, cols);
  const own = e ? Object.keys(e).filter((k) =>
    !["offset", "operation", "context"].includes(k)) : [];
  const op = (x: Entry) => [x.operation?.mnemonic,
    ...x.operation?.arguments ?? []].join(" ");

  return <section className="xcol" data-lang={lang}
    aria-label={`${p.title}: ${prog.compiler}'s program`}>
    <h3 className="view-name xtitle">{p.title}<span className="codenote">
      {" "}· {prog.compiler}, {prog.file}</span></h3>
    <p className="codehead"><span className="srcfile">{prog.list}</span>{" "}
      <span className="codenote">{(prog.at + 1).toLocaleString("en")}–{(
        prog.at + prog.instructions.length).toLocaleString("en")} of {
        prog.total.toLocaleString("en")}: play()</span></p>
    <ul ref={list} className="tree srows xrows" tabIndex={0}
      aria-label={`${prog.compiler}'s instructions for play()`}
      onKeyDown={onKey} onPointerLeave={() => setHover(undefined)}>
      {prog.instructions.map((x, k) => <li key={k} data-k={k}
        data-offset={x.offset} className={rangeOf(x) ? undefined
          : "absent"}
        onPointerEnter={(ev) => ev.pointerType === "mouse" && setHover(k)}
        onClick={() => {
          setHover(undefined);
          p.choose(k);
        }}>
        <div className={`row${k === i ? " hl" : ""}${k === p.chosen
          ? " sel" : ""}`}>
          <span className="type">{x.offset}</span>
          <span className="name">{op(x)}</span>
          <span className="val">{briefs[k] || "no context"}</span>
        </div></li>)}
    </ul>
    <p className="codehead"><span className="srcfile">{prog.list}[{
      prog.at + i}]</span>{" "}<span className="codenote">
      its entry, as YAML</span></p>
    <pre ref={box} className="src xjson" data-offset={e?.offset}>{
      rows.map((l, k) => <span key={`${i}:${k}`} className="line">{l}
      </span>).flatMap((x, k) => k ? ["\n", x] : [x])}
      {own.length > 0 && <>{"\n"}<span className="line codenote xown">
        # the last {own.length}: {prog.compiler}'s own, not the format's
      </span></>}</pre>
    <div className="code">
      <p className="codehead"><span className="srcfile">{prog.source.path}
      </span>{" "}<span className="codenote">{r ? ""
        : "no context: no source range"}</span></p>
      <pre ref={pre} className={`src codesrc${coloured ? " coloured"
        : ""}`}>{lines(text, coloured, { indent: true,
          ...mark ? { mark } : {} })}</pre>
    </div>
  </section>;
}

export function ProgramXray() {
  const open = (l: Lang) => PROGRAMS[l].instructions.findIndex((e) =>
    e.offset === OPEN[l]);
  const [at, setAt] = useState<Partial<Record<Lang, number>>>({});
  const changed = LANGS.some(([l]) => (at[l] ?? open(l)) !== open(l));
  return <div className="lens xray" data-figure="program-xray" data-ready>
    <ResetButton shown={changed} onReset={() => setAt({})} />
    <p className="view-name treehead shead">Arcade's play(), in two
      compilers' ethdebug programs<span className="handmade">each entry as
        the compiler wrote it</span></p>
    {LANGS.map(([l, title]) => <Column key={l} lang={l} title={title}
      chosen={at[l] ?? open(l)} choose={(k) => setAt((x) => ({ ...x,
        [l]: k }))} />)}
  </div>;
}
