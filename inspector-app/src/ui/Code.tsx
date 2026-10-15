// The one source view: a source's lines, coloured (Shiki) once shown,
// with whole lines marked (a declaration: ContractSource) or a range of
// it (the code panel, addendum §6: the range of the context that holds
// at the moment, or the last one before it, muted). The panel's box
// keeps its size and scrolls on its own: the range is brought into view
// there, never by moving the page.
import { centring, glide } from "./scroll";
import {
  useEffect, useLayoutEffect, useRef, useState, type CSSProperties,
  type ReactNode,
} from "react";
import { highlighter, withLang } from "./shiki";
import { useCompilation, useLens, useLensState, usePoint } from "./hooks";
import { useEdges } from "./PointerYaml";
import type { DataRef, ViewId } from "./types";

type Token = { content: string; offset: number;
  htmlStyle?: Record<string, string> };
export type Coloured = Token[][];

// the grammar a language's source is coloured with (BUG's: Solidity's,
// which it looks like; Fe's: Rust's, likewise; Vyper's is not loaded:
// plain)
const GRAMMAR: Record<string, string> = { solidity: "solidity",
  bug: "solidity", fe: "rust" };

// A text's lines as Shiki colours them, once `on` (null until then, or
// with no grammar)
export function useColoured(text: string, language: string, on = true):
  Coloured | null {
  const lang = GRAMMAR[language];
  const [got, setGot] = useState<{ text: string; lines: Coloured }>();
  const done = got?.text === text;
  useEffect(() => {
    if (!on || !text || !lang || done) return;
    let live = true;
    highlighter().then((hl) => withLang(hl, lang)).then((hl) => {
      if (live) {
        setGot({ text, lines: hl.codeToTokens(text, { lang,
          themes: { light: "github-light", dark: "github-dark" },
          defaultColor: false }).tokens as Coloured });
      }
    }, (e) => console.warn(
      "the colouring did not load; the source stays plain", e));
    return () => {
      live = false;
    };
  }, [on, text, lang, done]);
  return done ? got!.lines : null;
}

// a byte offset in a text, as a character (UTF-16) offset
export const charAt = (text: string, byte: number) => new TextDecoder()
  .decode(new TextEncoder().encode(text).slice(0, byte)).length;

// The lines of a text (coloured, or plain), each a span.line, with the
// characters [from, to) of `mark` in <mark>s; `line`: a line's class;
// `indent`: each line's indent as --ind (a wrapped line's hanging indent)
export function lines(text: string, coloured: Coloured | null,
  o: { mark?: { from: number; to: number; className: string };
    line?: (k: number) => string; indent?: boolean } = {}): ReactNode[] {
  let at = 0;
  const rows: Token[][] = coloured ?? text.replace(/\n$/, "").split("\n")
    .map((l) => {
      const t = { content: l, offset: at };
      at += l.length + 1;
      return [t];
    });
  const m = o.mark;
  const piece = (t: Token, a: number, b: number, k: string) => {
    const s = t.content.slice(a - t.offset, b - t.offset);
    const lit = !!m && a >= m.from && b <= m.to;
    const body = lit ? <mark className={m!.className}>{s}</mark> : s;
    return t.htmlStyle ? <span key={k} style={t.htmlStyle}>{body}</span>
      : lit ? <mark key={k} className={m!.className}>{s}</mark> : s;
  };
  // (each line's indent, --ind, for a wrapped line's hanging indent;
  // its leading spaces in a span.ind of their own, which that layout
  // hides: the padding indents it, and a long first word never leaves
  // the spaces alone on a row)
  const ind = (ts: Token[]) => ts.map((t) => t.content).join("")
    .match(/^ */)![0].length;
  return rows.map((ts, k) => {
    const n = o.indent ? ind(ts) : 0;
    const lead = (ts[0]?.offset ?? 0) + n;
    return <span key={k} className={["line", o.line?.(k)].filter(Boolean)
      .join(" ")} style={o.indent ? { "--ind": `${n}ch` } as CSSProperties
      : undefined}>{ts.flatMap((t, j) => {
      const end = t.offset + t.content.length;
      const cuts = [t.offset, ...(m ? [m.from, m.to] : []), ...n ? [lead]
        : [], end].filter((x) => x >= t.offset && x <= end)
        .sort((a, b) => a - b);
      return cuts.slice(1).map((b, i) => [cuts[i], b] as const)
        .filter(([a, b]) => b > a).map(([a, b]) => b <= lead && n
          ? <span key={`${j}.${a}`} className="ind">{piece(t, a, b,
            "p")}</span> : piece(t, a, b, `${j}.${a}`));
    })}</span>;
  }).flatMap((x, k) => k ? ["\n", x] : [x]);
}

// Scrolls a box so its first `mark` shows, moving nothing else: down,
// a third of the way, on a whole line (when it is out of view), and
// across (when its start, or the most of it the box can show, is out of
// view: a phone's narrow panel): as little as shows it, a few
// characters to spare, its line's start kept where it can be
// (`always`: a third of the way down even when it shows already: a
// small panel whose reader has just chosen it, the program x-ray's)
export function intoView(box: HTMLElement | null, instant = true) {
  // (its first shown piece: not a hidden indent's)
  const m = [...box?.querySelectorAll("mark") ?? []].find((x) =>
    !x.closest(".ind"));
  if (!box || !m) return;
  const b = box.getBoundingClientRect(), r = m.getBoundingClientRect();
  // (its marks, all: the range's lines, in the middle of the box, when
  // not in view clear of its edges; at once when `always`, a figure's
  // first look and a full figure's code, else in the transitions' time)
  const ms = [...box.querySelectorAll("mark")].filter((x) =>
    !x.closest(".ind")).map((x) => x.getBoundingClientRect());
  const pitch = parseFloat(getComputedStyle(box).lineHeight) || r.height;
  const run = { top: Math.min(...ms.map((x) => x.top)) - b.top -
    box.clientTop + box.scrollTop, bottom: Math.max(...ms.map((x) =>
    x.bottom)) - b.top - box.clientTop + box.scrollTop };
  const y = centring(box, run, { row: pitch, clear: Math.max(pitch / 2,
    18) });
  if (y !== undefined) glide(box, y, instant || undefined);
  const left = r.left - b.left + box.scrollLeft, cw = box.clientWidth;
  if (left < box.scrollLeft || left + Math.min(r.width, cw / 2) >
    box.scrollLeft + cw) {
    box.scrollLeft = Math.max(0, Math.min(left - 24, left +
      Math.min(r.width, cw - 48) - cw + 48));
  }
}

// The code panel: a moment's source, its range marked (Vyper's: no
// ethdebug, the source unmarked). As a pane (`pane`), the program
// x-ray's small code box (lenses/xray.css), a fixed number of lines,
// the range brought a third of the way down; its edges' buttons where
// there is more (PointerYaml.tsx useEdges)
export function Code(p: { id: ViewId; data: DataRef; domId?: string;
  pane?: boolean }) {
  const lens = useLens();
  const c = useCompilation(p.data);
  const paused = usePoint(p.data)?.paused;
  // (a call's site, chosen in the call stack: shown in place of the
  // step's range, ui/CallStack.tsx)
  const site = useLensState((s) => p.pane ? s.site : undefined);
  const r = site ?? paused?.range;
  const src = c?.sources.find((x) => x.id === r?.source) ?? c?.sources[0];
  const text = src?.text ?? "";
  const coloured = useColoured(text, c?.language ?? "");
  const ethdebug = c?.language !== "vyper";
  const mark = ethdebug && r && src?.id === r.source ? {
    from: charAt(text, r.offset), to: charAt(text, r.offset + r.length),
    className: site ? "rng site" : paused?.last ? "rng last" : "rng" }
    : undefined;
  const pre = useRef<HTMLPreElement>(null);
  // (the range in the middle of the box as it leaves it; a pane's in the
  // transitions' time, following a replay's steps so)
  useLayoutEffect(() => intoView(pre.current, !p.pane),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [mark?.from, mark?.to, coloured, p.pane]);
  const note = !c ? "" : !ethdebug ? "no ethdebug: the source unmarked"
    : !r ? "no source range here" : paused?.last
      ? "no range of its own here: the last one, muted" : "";
  const { edge } = useEdges(pre, !!p.pane, [mark?.from, mark?.to,
    text, coloured], { what: "the code", band: "the step's range",
    on: "mark.rng" });
  const file = src?.path.split("/").pop();
  const body = <pre ref={pre} className={`src codesrc${coloured
    ? " coloured" : ""}`}>
    {lines(text, coloured, { indent: true, ...mark ? { mark } : {},
    })}
  </pre>;
  if (p.pane) {
    return <div id={p.domId} className="code pane" data-view={`${
      lens.key}:${p.id}`}>
      <p className="codehead"><span className="srcfile">{file}</span> <span
        className="codenote">{note}</span></p>
      <div className="pbox">{body}{edge("up")}{edge("down")}</div>
    </div>;
  }
  return <div id={p.domId} className="code" data-view={`${lens.key}:${
    p.id}`}>
    <p className="codehead"><span className="srcfile">{file}</span> <span
      className="codenote">{note}</span></p>
    {body}
  </div>;
}
