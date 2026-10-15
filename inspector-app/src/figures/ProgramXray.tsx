// The program x-ray (the post's "underneath, the data soldb reads"): a
// compiler's ethdebug program for Arcade's play(), from solc or from Fe
// (the picker, the real debugger's), from the files the real debugger
// loads (bin/xray-data.mjs cuts play's instructions out, each entry
// unchanged). The instructions, a row each (byte offset, opcode, the
// source text in brief); beside them, the chosen one's entry, as YAML,
// coloured as the walkthrough's pointer is (PointerYaml's colouring),
// its `range` in the walkthrough's band, each field's name a popover
// saying what it is; under both, a small code panel, the range lit (an
// instruction with no context: the panel muted). Pointing at a row
// shows its entry; a click (a tap) chooses it, the arrow keys move the
// choice in a focused list. Both compilers open at the plays update,
// and each keeps its own choice. The keys show in the format's order
// (offset, operation, context) on both sides; the values, and which
// keys there are, as written: solc's PUSHes carry their bytes, Fe's do
// not; Fe's own fields are one line, "+3 Fe-specific fields", opened in
// place, in room kept for them. The box keeps its size whatever is
// shown (data-ready at once: its data is in the bundle).
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent, type MouseEvent,
} from "react";
import { charAt, intoView, lines, useColoured } from "../ui/Code";
import {
  shiki, useEdges, wrapRange, yamlLines,
} from "../ui/PointerYaml";
import { ResetButton } from "../ui/Reset";
import { UNHOVER } from "../ui/unhover";
import data from "./xray-data.json" with { type: "json" };

export type Json = null | boolean | number | string | Json[] |
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
// The instruction each compiler opens at: play()'s plays update, as the
// real debugger's (solc: the first of `player.plays += 1`; Fe: the
// first of `store.plays.set(…)`)
export const OPEN: Record<Lang, number> = { sol: 4432, fe: 6463 };
const GRAMMAR: Record<Lang, string> = { sol: "solidity", fe: "fe" };
// (the keys that move a focused list's choice: by one, or to an end)
const KEYS: Record<string, (i: number, n: number) => number> = {
  ArrowUp: (i) => i - 1, ArrowLeft: (i) => i - 1,
  ArrowDown: (i) => i + 1, ArrowRight: (i) => i + 1,
  Home: () => 0, End: (_, n) => n - 1 };
// The format's order of an instruction's keys, and of its parts' (the
// display's order only; a key not here, a compiler's own, after them)
const ORDER = ["offset", "operation", "mnemonic", "arguments", "context",
  "code", "source", "id", "range", "length"];
const TOP = ["offset", "operation", "context"];

// What each field is, in a few words, by its path; a field of a
// compiler's own, outside the format, says so
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
export function brief(text: string, from: number, to: number) {
  const t = text.slice(from, to).trim();
  const first = t.split("\n")[0].replace(/\s+/g, " ");
  return first === t.replace(/\s+/g, " ") ? first : `${first} …`;
}

// A scalar as YAML: a plain word when it reads as the same string,
// else double-quoted (JSON's escapes are YAML's)
const scalar = (v: Json) => typeof v === "string" &&
  !/^[A-Za-z_][\w./-]*$/.test(v) || /^(true|false|null|~|yes|no|on|off)$/i
  .test(String(v)) ? JSON.stringify(v) : String(v);
// (a collection of scalars: in flow style where it fits)
const flat = (v: Json) => v !== null && typeof v === "object" &&
  Object.values(v).every((x) => x === null || typeof x !== "object");
// an object's keys, in the format's order
const ordered = (v: Record<string, Json>) => Object.keys(v).sort((a, b) =>
  (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));

// One line of an entry's YAML: its text; its field names (where, and
// their paths); in the band (the range's lines); the toggle line;
// a value cut to fit (its whole, for its field's popover)
export interface Line { text: string; keys: { from: number; to: number;
  path: string }[]; band?: boolean; toggle?: boolean; full?: string }

// An entry's fields as YAML lines (the format's order; `cols`
// characters a line: a short collection on one line where it fits, a
// long scalar cut with "…")
export function yaml(v: Record<string, Json>, path: string, ind: number,
  out: Line[], cols: number, band = false) {
  const pad = "  ".repeat(ind);
  for (const k of ordered(v)) {
    const x = v[k];
    const sub = path ? `${path}.${k}` : k;
    const lit = band || sub === "context.code.range";
    const keys = [{ from: pad.length, to: pad.length + k.length,
      path: sub }];
    let text = `${pad}${k}:`;
    const pairs = flat(x) && !Array.isArray(x) ? ordered(x as Record<
      string, Json>).map((j) => [j, scalar((x as Record<string, Json>)[j])])
      : [];
    const one = Array.isArray(x) ? `${text} [ ${x.map(scalar)
      .join(", ")} ]` : `${text} { ${pairs.map(([j, y]) => `${j}: ${y}`)
      .join(", ")} }`;
    if (x === null || typeof x !== "object") {
      const s = scalar(x);
      const fits = text.length + 1 + s.length <= cols;
      out.push({ text: fits ? `${text} ${s}` : `${text} ${s.slice(0,
        Math.max(8, cols - text.length - 2))}…`, keys, band: lit,
      full: fits ? undefined : s });
      continue;
    }
    // (the instruction's own parts a field a line, on both sides alike;
    // a part's short parts, `source` and `range`, on one line)
    if (flat(x) && one.length <= cols && (ind > 0 || Array.isArray(x))) {
      if (!Array.isArray(x)) {
        text += " { ";
        pairs.forEach(([j, y], n) => {
          keys.push({ from: text.length, to: text.length + j.length,
            path: `${sub}.${j}` });
          text += `${j}: ${y}${n < pairs.length - 1 ? ", " : " }"}`;
        });
      }
      else text = one;
      out.push({ text, keys, band: lit });
      continue;
    }
    out.push({ text, keys, band: lit });
    if (Array.isArray(x)) {
      // (an item a line; an object item's fields under its "- ", as YAML)
      x.forEach((y) => {
        if (y === null || typeof y !== "object") {
          out.push({ text: `${pad}  - ${scalar(y)}`, keys: [], band: lit });
          return;
        }
        const under: Line[] = [];
        if (Array.isArray(y)) {
          under.push({ text: `${pad}    [ ${y.map(scalar).join(", ")} ]`,
            keys: [], band: lit });
        } else yaml(y, sub, ind + 2, under, cols, lit);
        if (!under.length) return;
        under[0] = { ...under[0], text: `${pad}  - ${under[0].text
          .trimStart()}`, keys: under[0].keys.map((k) => ({ ...k,
          from: k.from - (under[0].text.length - under[0].text
            .trimStart().length) + pad.length + 4, to: k.to -
            (under[0].text.length - under[0].text.trimStart().length) +
            pad.length + 4 })) };
        out.push(...under);
      });
    }
    else yaml(x, sub, ind + 1, out, cols, lit);
  }
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
      // (a line's own padding, the band's room: 1.5em)
      if (ch) setCols(Math.floor((w - 1.5 * parseFloat(cs.fontSize)) /
        ch));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box]);
  return cols;
}

export const esc = (s: string) => s.replace(/[&<>]/g,
  (c) => `&#${c.charCodeAt(0)};`);

export function ProgramXray() {
  const [lang, setLang] = useState<Lang>("sol");
  const [at, setAt] = useState<Partial<Record<Lang, number>>>({});
  const [hover, setHover] = useState<number>();
  // (every hover ended: ui/unhover.ts)
  useEffect(() => {
    const off = () => setHover(undefined);
    addEventListener(UNHOVER, off);
    return () => removeEventListener(UNHOVER, off);
  }, []);
  // (Fe's own fields: one line, or opened)
  const [extra, setExtra] = useState(false);
  const prog = PROGRAMS[lang];
  const open = (l: Lang) => PROGRAMS[l].instructions.findIndex((e) =>
    e.offset === OPEN[l]);
  const chosen = at[lang] ?? open(lang);
  const i = hover ?? chosen;
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

  // the code panel: the range a third of the way down, each time it
  // changes (the panel is small: a range at its edge reads as none)
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => intoView(pre.current, true),
    [mark?.from, mark?.to, coloured, lang]);
  // (its edges' buttons, the stepper's code box's: ui/Code.tsx)
  const { edge } = useEdges(pre, true, [mark?.from, mark?.to, coloured,
    lang], { what: "the code", band: "the step's range", on: "mark.rng" });
  // (the chosen row in its list's view, a third of the way down on a
  // whole row: the list's box scrolls, never the page)
  const list = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const b = list.current;
    const rows = b?.querySelectorAll<HTMLElement>("li");
    const row = rows?.[chosen];
    if (!b || !rows?.length || !row) return;
    const pitch = row.offsetHeight;
    const top = row.offsetTop - rows[0].offsetTop;
    if (top < b.scrollTop || top + pitch > b.scrollTop + b.clientHeight) {
      b.scrollTop = Math.max(0, top - Math.floor(b.clientHeight / 3 /
        pitch) * pitch);
    }
  }, [chosen, lang]);

  // the entry's lines
  const box = useRef<HTMLPreElement>(null);
  const cols = useCols(box);
  const entryLines = useMemo(() => {
    const out: Line[] = [];
    if (!e) return out;
    const v = e as unknown as Record<string, Json>;
    const own = Object.keys(v).filter((k) => !TOP.includes(k));
    yaml(Object.fromEntries(TOP.filter((k) => k in v).map((k) =>
      [k, v[k]])), "", 0, out, cols);
    if (own.length) {
      const t = `# ${extra ? "▾" : "▸"} +${own.length} ${prog.compiler}-` +
        "specific fields";
      out.push({ text: t, keys: [], toggle: true });
      if (extra) {
        yaml(Object.fromEntries(own.map((k) => [k, v[k]])), "", 0, out,
          cols);
      }
    }
    return out;
  }, [e, cols, extra, prog.compiler]);
  const yamlText = entryLines.map((l) => l.text).join("\n");
  // (coloured as the walkthrough's pointer is: PointerYaml's Shiki call)
  const [html, setHtml] = useState<{ text: string; lines: string[] }>();
  useEffect(() => {
    if (html?.text === yamlText) return;
    let live = true;
    shiki().then((hl) => {
      if (hl && live) setHtml({ text: yamlText, lines: yamlLines(hl,
        yamlText) });
    });
    return () => {
      live = false;
    };
  }, [yamlText, html?.text]);
  const shown = html?.text === yamlText ? html.lines : null;
  // (each field's name: a button, PointerYaml's wrapRange, its popover
  // over the line above it, never the lines after; the toggle line a
  // button too)
  const code = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = code.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(":scope > .line").forEach((el,
      k) => {
      const l = entryLines[k];
      if (!l || el.querySelector(".xname, .xtoggle")) return;
      if (l.toggle) {
        wrapRange(el, 0, l.text.length, "toggle", "xtoggle");
        el.querySelector(".xtoggle")?.setAttribute("aria-expanded",
          String(extra));
        return;
      }
      for (const key of [...l.keys].reverse()) {
        const what = FIELDS[key.path];
        if (!what) continue;
        wrapRange(el, key.from, key.to, key.path, "xname");
        const name = [...el.querySelectorAll<HTMLElement>(".xname")]
          .find((n) => n.dataset.id === key.path)!;
        const pop = document.createElement("span");
        pop.className = "pop wrap xpop";
        pop.setAttribute("aria-hidden", "true");
        pop.textContent = l.full && key.from === l.keys[0].from
          ? `${what}: ${l.full}` : what;
        name.setAttribute("aria-description", what);
        name.append(pop);
      }
    });
  });
  const onEntry = (ev: MouseEvent | KeyboardEvent) => {
    const t = (ev.target as Element).closest(".xtoggle");
    if (!t) return;
    if ("key" in ev && ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    setExtra((x) => !x);
  };

  const onKey = (ev: KeyboardEvent) => {
    const to = KEYS[ev.key];
    if (!to || ev.altKey || ev.metaKey || ev.ctrlKey) return;
    ev.preventDefault();
    setHover(undefined);
    const n = prog.instructions.length;
    setAt((x) => ({ ...x, [lang]: Math.max(0, Math.min(n - 1,
      to(chosen, n))) }));
  };
  const reset = () => {
    setLang("sol");
    setAt({});
    setHover(undefined);
    setExtra(false);
  };
  const changed = lang !== "sol" || extra || LANGS.some(([l]) =>
    (at[l] ?? open(l)) !== open(l));
  const op = (x: Entry) => [x.operation?.mnemonic,
    ...x.operation?.arguments ?? []].join(" ");

  return <div className="lens xray" data-figure="program-xray" data-ready
    data-lang={lang}>
    <ResetButton shown={changed} onReset={reset} />
    <p className="view-name treehead shead">Arcade's play(), as the
      compiler's ethdebug program<span className="handmade">the values as
        each compiler wrote them</span></p>
    <div className="picker" role="radiogroup" aria-label="Compiler">
      {LANGS.map(([k, t]) => <button key={k} type="button" role="radio"
        data-lang={k} aria-checked={k === lang ? "true" : "false"}
        onClick={() => {
          setHover(undefined);
          setLang(k);
        }}>{t}</button>)}
    </div>
    <ul ref={list} className="tree srows xrows" tabIndex={0}
      aria-label={`${prog.compiler}'s instructions for play()`}
      onKeyDown={onKey} onPointerLeave={() => setHover(undefined)}>
      {prog.instructions.map((x, k) => <li key={`${lang}:${k}`}
        data-offset={x.offset} className={rangeOf(x) ? undefined
          : "absent"}
        onPointerEnter={(ev) => ev.pointerType === "mouse" && setHover(k)}
        onClick={() => {
          setHover(undefined);
          setAt((y) => ({ ...y, [lang]: k }));
        }}>
        <div className={`row${k === i ? " hl" : ""}${k === chosen
          ? " sel" : ""}`}>
          <span className="type">{x.offset}</span>
          <span className="name">{op(x)}</span>
          <span className="val">{briefs[k] || "no context"}</span>
        </div></li>)}
    </ul>
    <div className="ptr xentry" aria-label="The instruction's entry">
      <p className="plabel"><span className="ptitle">Instruction at {
        e?.offset}</span> <span className="pnote">{r ? "its entry, as YAML"
          : "its entry, as YAML: no context"}</span></p>
      <div className="ptrbox"><div className="ptrscroll">
        <pre ref={box} className="ptrlines" data-offset={e?.offset}
          onClick={onEntry} onKeyDown={onEntry}><code ref={code}>
          {entryLines.map((l, k) => <span key={`${yamlText}:${k}:${
            !!shown}`} className={`line${l.band ? ` on${entryLines[k - 1]
            ?.band ? "" : " on-top"}${entryLines[k + 1]?.band ? ""
            : " on-end"}` : ""}${l.toggle ? " xtline" : ""}`}
            dangerouslySetInnerHTML={{ __html: shown?.[k] ?? esc(l.text) }}
          />)}</code></pre>
      </div></div>
    </div>
    <div className="code" data-none={r ? undefined : ""}>
      <div className="pbox"><pre ref={pre} className={`src codesrc${
        coloured ? " coloured" : ""}`}>{lines(text, coloured, {
          indent: true, ...mark ? { mark } : {} })}</pre>
        {edge("up")}{edge("down")}</div>
    </div>
  </div>;
}
