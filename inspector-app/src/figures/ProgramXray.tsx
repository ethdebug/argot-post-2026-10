// The program x-ray (the post's "underneath, the data soldb reads"): a
// compiler's ethdebug program, as it wrote it, for Arcade's play(), from
// solc and from Fe (the files the real debugger loads; bin/xray-data.mjs
// cuts play's instructions out, each entry unchanged). On the left, the
// instructions, a row each (byte offset, opcode, the source text in
// brief); on the right, the source in the code panel; between them, the
// entry the reader points at or steps to, as JSON, each field's name a
// popover saying what it is. Pointing at a row shows its entry and
// lights its range; a click or a move chooses it. The moves skip an
// instruction with no source range (Fe's synthetic code: its row muted;
// pointed at, its entry shows, and the code nothing lit). Nothing is
// normalized: solc's PUSHes carry their bytes, Fe's do not; Fe writes
// fields of its own; each shows as written. The box keeps its size
// whatever is shown (data-ready at once: its data is in the bundle).
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

const LANGS = [["sol", "Solidity"], ["fe", "Fe"]] as const;
type Lang = typeof LANGS[number][0];
const PROGRAMS = data as Record<Lang, Program>;
// The instruction each language opens at: play()'s plays update, as
// the real debugger's (solc: the first of `player.plays += 1`; Fe: the
// first of `store.plays.set(…)`)
export const OPEN: Record<Lang, number> = { sol: 4432, fe: 6463 };
const GRAMMAR: Record<Lang, string> = { sol: "solidity", fe: "fe" };

type Move = "prev" | "next" | "first" | "last";
const KEYS: Record<string, Move> = { ArrowLeft: "prev", ArrowRight: "next",
  ArrowUp: "prev", ArrowDown: "next", Home: "first", End: "last" };

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

// the instructions a move stops at: each one with a range
const stops = (p: Program) => p.instructions.flatMap((e, k) =>
  rangeOf(e) ? [k] : []);

function moveOf(s: number[], i: number, how: Move): number {
  if (!s.length) return i;
  if (how === "first") return s[0];
  if (how === "last") return s[s.length - 1];
  if (how === "next") return s.find((k) => k > i) ?? i;
  return [...s].reverse().find((k) => k < i) ?? i;
}

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

export function ProgramXray() {
  const [lang, setLang] = useState<Lang>("sol");
  const [at, setAt] = useState<Partial<Record<Lang, number>>>({});
  const [hover, setHover] = useState<number>();
  const p = PROGRAMS[lang];
  const s = useMemo(() => stops(p), [p]);
  const open = p.instructions.findIndex((e) => e.offset === OPEN[lang]);
  const chosen = at[lang] ?? open;
  const i = hover ?? chosen;
  const e = p.instructions[i];
  const text = p.source.text;
  const r = rangeOf(e);
  const coloured = useColoured(text, GRAMMAR[lang]);
  const mark = r && { from: charAt(text, r.offset),
    to: charAt(text, r.offset + r.length), className: "rng" };

  // each row's source text in brief (once a language)
  const briefs = useMemo(() => p.instructions.map((x) => {
    const q = rangeOf(x);
    return q ? brief(text, charAt(text, q.offset), charAt(text,
      q.offset + q.length)) : "";
  }), [p, text]);

  // (how many characters a line of the entry's box holds: a short
  // collection on one line only where it fits)
  const box = useRef<HTMLPreElement>(null);
  const [cols, setCols] = useState(40);
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
  }, []);
  const pre = useRef<HTMLPreElement>(null);
  const shown = useRef<string>(undefined);
  useLayoutEffect(() => {
    const box = pre.current;
    const now = `${lang}:${!!coloured}`;
    if (box && shown.current !== now) {
      box.scrollTop = box.scrollLeft = 0;
      shown.current = now;
    }
    intoView(box);
  }, [mark?.from, mark?.to, coloured, lang]);
  // (the chosen row in its list's view, when a move or a language
  // chose it: the list's box scrolls, never the page)
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>(`li[data-k="${chosen}"]`);
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop || top + row.offsetHeight > box.scrollTop +
      box.clientHeight) {
      box.scrollTop = Math.max(0, top - Math.round(box.clientHeight / 3));
    }
  }, [chosen, lang]);

  const go = (how: Move) => {
    setHover(undefined);
    setAt((x) => ({ ...x, [lang]: moveOf(s, chosen, how) }));
  };
  const onKey = (ev: KeyboardEvent) => {
    const how = KEYS[ev.key];
    if (!how || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    ev.preventDefault();
    go(how);
  };
  const reset = () => {
    setLang("sol");
    setAt({});
    setHover(undefined);
  };
  const changed = lang !== "sol" || Object.entries(at).some(([k, n]) =>
    PROGRAMS[k as Lang].instructions[n]?.offset !== OPEN[k as Lang]);

  const rows: ReactNode[][] = [];
  if (e) yaml(e as unknown as Record<string, Json>, "", 0, rows, cols);
  const own = e ? Object.keys(e).filter((k) =>
    !["offset", "operation", "context"].includes(k)) : [];
  const n = p.at + i;
  const op = (x: Entry) => [x.operation?.mnemonic,
    ...x.operation?.arguments ?? []].join(" ");

  return <div className="lens xray" data-figure="program-xray" data-ready
    data-lang={lang} tabIndex={-1} onKeyDown={onKey}>
    <ResetButton shown={changed} onReset={reset} />
    <p className="view-name treehead shead">Arcade's play() · the
      compiler's ethdebug program<span className="handmade">each entry as
        the compiler wrote it</span></p>
    <div className="sbar">
      <div className="picker" role="radiogroup" aria-label="Compiler">
        {LANGS.map(([k, t]) => <button key={k} type="button" role="radio"
          data-lang={k} aria-checked={k === lang ? "true" : "false"}
          onClick={() => {
            setHover(undefined);
            setLang(k);
          }}>{t}</button>)}
      </div>
      <div className="moves" tabIndex={0} aria-label="The instructions">
        <span className="mctl">
          {([["first", "The first instruction with a source range", "⏮"],
            ["prev", "The previous instruction with a source range",
              "◀ Back"],
            ["next", "The next instruction with a source range", "Step ▶"],
            ["last", "The last instruction with a source range", "⏭"]
          ] as const).map(([how, label, t]) => <button key={how}
            type="button" className="btn" data-move={how} aria-label={label}
            title={label} disabled={moveOf(s, chosen, how) === chosen}
            onClick={() => go(how)}>{t}</button>)}
        </span>
        <span className="mat" data-k={chosen}>instruction <b>{chosen + 1}
        </b> of {p.instructions.length}</span>
      </div>
    </div>
    <section className="xlist" aria-label="The instructions">
      <p className="codehead"><span className="srcfile">{p.list}</span>{" "}
        <span className="codenote">{(p.at + 1).toLocaleString("en")}–{(
          p.at + p.instructions.length).toLocaleString("en")} of {
          p.total.toLocaleString("en")}</span></p>
      <ul ref={list} className="tree srows xrows" tabIndex={0}
        aria-label={`${p.compiler}'s instructions for play()`}
        onPointerLeave={() => setHover(undefined)}>
        {p.instructions.map((x, k) => <li key={`${lang}:${k}`} data-k={k}
          data-offset={x.offset}
          className={rangeOf(x) ? undefined : "absent"}
          onPointerEnter={(ev) => ev.pointerType === "mouse" &&
            setHover(k)}
          onClick={() => {
            setHover(undefined);
            setAt((y) => ({ ...y, [lang]: k }));
          }}>
          <div className={`row${k === i ? " hl" : ""}${k === chosen
            ? " sel" : ""}`}>
            <span className="type">{x.offset}</span>
            <span className="name">{op(x)}</span>
            <span className="val">{briefs[k] || "no source range"}</span>
          </div></li>)}
      </ul>
    </section>
    <section className="xentry" aria-label="The entry">
      <p className="codehead"><span className="srcfile">{p.list}[{n}]
      </span>{" "}<span className="codenote">its JSON, as YAML</span></p>
      <pre ref={box} className="src xjson" data-offset={e?.offset}>{
        rows.map((l, k) =>
        <span key={`${lang}:${i}:${k}`} className="line">{l}</span>)
        .flatMap((x, k) => k ? ["\n", x] : [x])}
        {own.length > 0 && <>{"\n\n"}<span className="line codenote xown">
          # {own.join(", ")}: {p.compiler}'s own, outside the format
        </span></>}</pre>
    </section>
    <div className="code" data-area="code">
      <p className="codehead"><span className="srcfile">{p.source.path}
      </span>{" "}<span className="codenote">{r ? ""
        : "this instruction has no source range"}</span></p>
      <pre ref={pre} className={`src codesrc${coloured ? " coloured"
        : ""}`}>{lines(text, coloured, { indent: true,
          ...mark ? { mark } : {} })}</pre>
    </div>
  </div>;
}
