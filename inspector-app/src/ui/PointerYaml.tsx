// The pointer the compiler wrote, as YAML (vanilla main.js renderBox's #ptr,
// colourYaml, markAliases): one line each, nothing wraps; a step's lines
// in a band (a run of lit lines is one block, rounded at its ends) and
// the rest muted; the box scrolled inside itself so the band's top is a
// third of the way down. Coloured by Shiki (./shiki.ts), loaded the
// first time a pointer shows. A shortened template name is
// a button: it shows solc's id.
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { band as bandOf, type PointerLine } from "../engine/pointer-text";
import { highlighter } from "./shiki";

const NONE: YamlText = { lines: [], names: {} };

type Highlighter = { codeToHtml(code: string, o: object): string };
type Shiki = Promise<Highlighter | null>;
const PIDS = <>Template names shortened for reading; solc writes ids like
  {" "}<code>t_array$_t_address_$dyn_storage</code>.</>;

// The colouring: loaded once a page (kept on the window: one load, for
// every lens on it)
function shiki(): Shiki {
  const w = window as unknown as { inspectorShiki?: Shiki };
  return w.inspectorShiki ??= highlighter().then((h) => h as Highlighter)
    .catch((e) => {
      console.warn("the colouring did not load", e);
      delete w.inspectorShiki;
      return null;
    });
}

// The pointer's text, for a variable (pointer-text.ts): what the panel
// draws, from its model
export interface YamlText { lines: PointerLine[];
  names: Record<string, string> }

// `text`: the selection's variable's pointer (none: nothing selected);
// `goal`: a walkthrough's step 0 (the pointer blurred and still);
// `shown`: the details are open (the edges' buttons only then);
// `piece`: the part of the pointer shown, the step's (a template's
// name; "" or none: the variable's own pointer); a new piece fades in,
// in the box's own room
export function PointerYaml({ domId, text: yaml, band, before, goal,
  shown, notes, piece = "" }: { domId?: string;
  text: YamlText | null; band?: string[]; before?: ReactNode;
  goal?: boolean; shown?: boolean;
  notes?: { block: string; values: Record<string, string> };
  piece?: string }) {
  // (its parts' ids, after its own: "ptr" → "pgo"; "mptr" → "mpgo")
  const pre = domId?.replace(/ptr$/, "") ?? "";
  const variable = !!yaml;
  const { lines, names } = yaml ?? NONE;
  const text = lines.map((l) => l.text).join("\n");
  const [html, setHtml] = useState<{ text: string; lines: string[] }>();
  // (coloured once it is shown: the colouring loads then, not with the
  // page)
  useEffect(() => {
    if (!text || !shown || html?.text === text) return;
    let live = true;
    shiki().then((hl) => {
      if (!hl || !live) return;
      const t = document.createElement("template");
      t.innerHTML = hl.codeToHtml(text, { lang: "yaml",
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false });
      setHtml({ text, lines: [...t.content.querySelectorAll(".line")]
        .map((l) => l.innerHTML) });
    });
    return () => {
      live = false;
    };
  }, [text, shown, html?.text]);
  const lit = new Set(band?.length ? bandOf(lines, band) : []);
  const box = useRef<HTMLDivElement>(null);
  const [alias, setAlias] = useState<string | null>(null);

  // the shortened names, as buttons: where each line has one (as a
  // template's definition, or a value of `template`)
  const byName = useMemo(() => Object.fromEntries(Object.entries(names)
    .map(([id, n]) => [n, id])), [names]);
  const aliasAt = (plain: string) => {
    if (!/^\s*(- )?[^:]*:\s*$|template: /.test(plain)) return null;
    for (const n of Object.keys(byName).sort((a, b) =>
      b.length - a.length)) {
      const at = [`template: ${n}`, `${n}:`].map((x) => [x,
        plain.indexOf(x)] as const).find(([x, k]) => k >= 0 &&
        (x.startsWith("template") || plain.trim().replace(/^- /, "") === x));
      if (!at) continue;
      const from = at[0].startsWith("template") ? at[1] + 10 : at[1];
      return { from, to: from + n.length, id: byName[n] };
    }
    return null;
  };
  // (in the coloured lines, whose markup is Shiki's: wrapped in place)
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    for (const line of root.querySelectorAll<HTMLElement>(".line.html")) {
      if (line.querySelector(".alias")) continue;
      const a = aliasAt(line.textContent ?? "");
      if (a) wrapRange(line, a.from, a.to, a.id);
    }
  });
  // the band's top a third of the way down the box (as far as the
  // content allows)
  const first = lit.size ? Math.min(...lit) : -1;
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    // (step 0: at its top, and still)
    if (goal) {
      root.scrollTop = 0;
      return;
    }
    const on = root.querySelector<HTMLElement>(".line.on");
    const top = on ? Math.min(Math.max(0, on.offsetTop - root.clientHeight /
      3), root.scrollHeight - root.clientHeight) : 0;
    const still = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo?.({ top, behavior: on && !still ? "smooth" : "auto" });
  }, [first, text, goal]);

  // The box scrolls inside itself, with no scrollbar shown: a button on
  // its top or bottom edge where there is more; it scrolls toward the
  // step's band, when that is out of view that way, else by about a
  // box's height (vanilla 00f6f8c ptrEdges, ptrGo)
  const [more, setMore] = useState({ up: false, down: false, bandUp: false,
    bandDown: false });
  useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const measure = () => {
      const on = root.querySelector(".line.on")?.getBoundingClientRect();
      const b = root.getBoundingClientRect();
      const can = !!shown && !goal;
      const m = { up: can && root.scrollTop > 1,
        down: can && root.scrollTop + root.clientHeight <
          root.scrollHeight - 1,
        bandUp: !!on && on.bottom <= b.top + 1,
        bandDown: !!on && on.top >= b.bottom - 1 };
      setMore((x) => JSON.stringify(x) === JSON.stringify(m) ? x : m);
    };
    measure();
    const later = requestAnimationFrame(measure);
    root.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(later);
      root.removeEventListener("scroll", measure);
    };
  });
  const go = (way: "up" | "down") => {
    const root = box.current!;
    const on = root.querySelector<HTMLElement>(".line.on");
    const band = way === "up" ? more.bandUp : more.bandDown;
    const top = band && on ? on.offsetTop - root.clientHeight / 3
      : root.scrollTop + (way === "up" ? -1 : 1) * root.clientHeight * 0.85;
    const still = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo({ top: Math.max(0, top), behavior: still ? "auto"
      : "smooth" });
  };
  const edge = (way: "up" | "down") => {
    const on = more[way];
    const band = way === "up" ? more.bandUp : more.bandDown;
    const text = `${band ? "current step" : "more"} ${way === "up" ? "above"
      : "below"}`;
    const icon = <svg viewBox="0 0 16 16" aria-hidden="true"><path
      d={way === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" /></svg>;
    return <div className={`pedge ${way}${on ? " on" : ""}`}
      aria-hidden={on ? "false" : "true"}>
      <button type="button" id={domId ? `${pre}pedge-${way}` : undefined}
        tabIndex={on ? 0 : -1} data-band={band ? "1" : ""}
        aria-label={band ? `Scroll the pointer ${way} to the step's lines`
          : `Scroll the pointer ${way}`} onClick={() => go(way)}>
        {way === "up" ? <>{icon}<span>{text}</span></>
          : <><span>{text}</span>{icon}</>}</button></div>;
  };

  const onAlias = (e: React.MouseEvent | React.KeyboardEvent) => {
    const a = (e.target as Element).closest<HTMLElement>(".alias");
    if (!a) return;
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    setAlias(`${a.textContent}\n${a.dataset.id}`);
  };
  const coloured = html?.text === text ? html.lines : null;
  // the glyph points toward ▶, from where ▶ is: on the sentence's right,
  // up and right, when ▶ is right of the sentence's middle; else on its
  // left, the same arrow mirrored, up and left (one rule, measured)
  const pgo = useRef<HTMLParagraphElement>(null);
  const [left, setLeft] = useState(true);
  useLayoutEffect(() => {
    const aim = () => {
      const g = pgo.current;
      const next = g?.closest("[data-view]")?.querySelector(
        'button[data-r="next"]');
      if (!goal || !g || !next) return;
      const gr = g.getBoundingClientRect();
      const n = next.getBoundingClientRect();
      setLeft(n.left + n.width / 2 < gr.left + gr.width / 2);
    };
    const f = requestAnimationFrame(aim);
    addEventListener("resize", aim);
    return () => {
      cancelAnimationFrame(f);
      removeEventListener("resize", aim);
    };
  }, [goal]);
  return <div className="ptrbox"><div ref={box} id={domId} tabIndex={0}
    className={`ptrscroll${lit.size ? " lit" : ""}${goal ? " goal" : ""}${
      more.up ? " more-up" : ""}${more.down ? " more-down" : ""}`}
    onClick={onAlias} onKeyDown={onAlias}>
    {!variable ? <p className="muted small">Select a value to see the part
      of the ethdebug data from the compiler that finds it.</p> : <>
      {before}
      <pre key={piece} className="ptrlines"><code>{lines.map((l, k) => {
        // (the piece's lines only: its head, then its own; the blank line
        // between pieces, none)
        if (l.pos.split("|")[0] !== piece || l.pos.endsWith("|-")) {
          return null;
        }
        const on = lit.has(k);
        const cls = `line${on ? ` on${lit.has(k - 1) ? "" : " on-top"}${
          lit.has(k + 1) ? "" : " on-end"}` : ""}`;
        // (a band line's variables, as the focus has them: "  # key =
        // alice, slot = 3"; the review's T4)
        const note = on && notes ? noteOf(l, notes) : "";
        if (coloured) {
          return <span key={`${k}:${coloured[k]}:${note}`}
            className={`${cls} html`} dangerouslySetInnerHTML={{
              __html: (coloured[k] ?? "") + (note ? `<span class="lnote">${
                note.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)
              }</span>` : "") }} />;
        }
        const a = aliasAt(l.text);
        return <span key={k} className={cls}>{a ? <>{l.text.slice(0,
          a.from)}<span className="alias" tabIndex={0} role="button"
          data-id={a.id}>{l.text.slice(a.from, a.to)}</span>{
          l.text.slice(a.to)}</> : l.text}{note && <span className="lnote">
          {note}</span>}</span>;
      })}</code></pre>
      {Object.keys(names).length > 0 && <p className="muted small pids">
        {alias ? <><code className="alias">{alias.split("\n")[0]}</code> =
          solc's <code>{alias.split("\n")[1]}</code></> : PIDS}</p>}</>}
  </div>{edge("up")}{edge("down")}
    {/* (at step 0, over the blurred pointer: the way on, with an arrow
      glyph toward ▶: vanilla goGlyph) */}
    <p ref={pgo} id={domId ? `${pre}pgo` : undefined} className={`pgo${left
      ? " left" : ""}`} hidden={!goal}>{left && <span className="pglyph"
      aria-hidden="true">⤴</span>}<span className="ptext">Press ▶ to see how
      this data from the compiler finds these bytes</span>{!left && <span
      className="pglyph" aria-hidden="true">⤴</span>}</p></div>;
}

// The values of the variables a line uses (an operand, not a key:
// "{ ~wordsized: key }", "expect: [slot, key]"), in its own block
function noteOf(l: { text: string; pos: string },
  n: { block: string; values: Record<string, string> }) {
  if (l.pos.split("|")[0] !== n.block) return "";
  const used = Object.keys(n.values).filter((v) => new RegExp(
    `(^|[^\\w~-])${v}(?![\\w:-])`).test(l.text.replace(/^\s*[\w-]+:/, "")));
  return used.length ? `  # ${used.map((v) => `${v} = ${n.values[v]}`)
    .join(", ")}` : "";
}

// a range of a line's text, wrapped in a button for its template's id
function wrapRange(el: HTMLElement, a: number, b: number, id: string) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = (node as Text).data.length;
    if (pos <= a && a <= pos + len) range.setStart(node, a - pos);
    if (pos <= b && b <= pos + len) {
      range.setEnd(node, b - pos);
      break;
    }
    pos += len;
  }
  const span = document.createElement("span");
  span.className = "alias";
  span.tabIndex = 0;
  span.setAttribute("role", "button");
  span.dataset.id = id;
  span.append(range.extractContents());
  range.insertNode(span);
}
