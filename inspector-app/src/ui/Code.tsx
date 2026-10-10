// The one source view: a source's lines, coloured (Shiki) once shown,
// with whole lines marked (a declaration: ContractSource) or a range of
// it (the code panel, addendum §6: the range of the context that holds
// at the moment, or the last one before it, muted). The panel's box
// keeps its size and scrolls on its own: the range is brought into view
// there, never by moving the page.
import {
  useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import { highlighter, withLang } from "./shiki";
import { useCompilation, useLens, usePoint } from "./hooks";
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
// characters [from, to) of `mark` in <mark>s; `line`: a line's class
export function lines(text: string, coloured: Coloured | null,
  o: { mark?: { from: number; to: number; className: string };
    line?: (k: number) => string } = {}): ReactNode[] {
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
  return rows.map((ts, k) => <span key={k} className={["line",
    o.line?.(k)].filter(Boolean).join(" ")}>{ts.flatMap((t, j) => {
    const end = t.offset + t.content.length;
    const cuts = [t.offset, ...(m ? [m.from, m.to] : []), end]
      .filter((x) => x >= t.offset && x <= end)
      .sort((a, b) => a - b);
    return cuts.slice(1).map((b, i) => [cuts[i], b] as const)
      .filter(([a, b]) => b > a).map(([a, b]) => piece(t, a, b, `${j}.${a}`));
  })}</span>).flatMap((x, k) => k ? ["\n", x] : [x]);
}

// Scrolls a box so its first `mark` shows, moving nothing else: down,
// a third of the way, on a whole line (when it is out of view), and
// across (when its start, or the most of it the box can show, is out of
// view: a phone's narrow panel): to its line's start where it is near
// it, else to a few characters before it
export function intoView(box: HTMLElement | null) {
  const m = box?.querySelector("mark");
  if (!box || !m) return;
  const b = box.getBoundingClientRect(), r = m.getBoundingClientRect();
  const top = r.top - b.top + box.scrollTop;
  if (top < box.scrollTop || top + r.height > box.scrollTop +
    box.clientHeight) {
    // (a line's box: its text's, less the half-leading, from the next
    // line's distance; whole lines from the box's top edge)
    const ln = m.closest(".line")?.getBoundingClientRect() ?? r;
    const nx = (m.closest(".line")?.nextElementSibling ??
      m.closest(".line")?.previousElementSibling)?.getBoundingClientRect();
    const pitch = Math.abs((nx?.top ?? ln.top) - ln.top) ||
      parseFloat(getComputedStyle(box).lineHeight) || r.height;
    const at = ln.top - b.top + box.scrollTop - (pitch - ln.height) / 2;
    box.scrollTop = Math.max(0, at - Math.round(box.clientHeight / 3 /
      pitch) * pitch);
  }
  const left = r.left - b.left + box.scrollLeft, cw = box.clientWidth;
  if (left < box.scrollLeft || left + Math.min(r.width, cw / 2) >
    box.scrollLeft + cw) {
    box.scrollLeft = left < cw * 0.6 ? 0 : left - 24;
  }
}

// The code panel: a moment's source, its range marked (Vyper's: no
// ethdebug, the source unmarked)
export function Code(p: { id: ViewId; data: DataRef; domId?: string }) {
  const lens = useLens();
  const c = useCompilation(p.data);
  const paused = usePoint(p.data)?.paused;
  const r = paused?.range;
  const src = c?.sources.find((x) => x.id === r?.source) ?? c?.sources[0];
  const text = src?.text ?? "";
  const coloured = useColoured(text, c?.language ?? "");
  const ethdebug = c?.language !== "vyper";
  const mark = ethdebug && r && src?.id === r.source ? {
    from: charAt(text, r.offset), to: charAt(text, r.offset + r.length),
    className: paused?.last ? "rng last" : "rng" } : undefined;
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => intoView(pre.current),
    [mark?.from, mark?.to, coloured]);
  const note = !c ? "" : !ethdebug ? "no ethdebug: the source unmarked"
    : !r ? "no source range here" : paused?.last
      ? "no range of its own here: the last one, muted" : "";
  return <div id={p.domId} className="code" data-view={`${lens.key}:${
    p.id}`}>
    <p className="codehead"><span className="srcfile">{src?.path
      .split("/").pop()}</span> <span className="codenote">{note}</span>
    </p>
    <pre ref={pre} className={`src codesrc${coloured ? " coloured" : ""}`}>
      {lines(text, coloured, mark ? { mark } : {})}</pre>
  </div>;
}
