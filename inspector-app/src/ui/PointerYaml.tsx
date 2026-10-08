// The pointer solc wrote, as YAML (vanilla main.js renderBox's #ptr,
// colourYaml, markAliases): one line each, nothing wraps; a step's lines
// in a band (a run of lit lines is one block, rounded at its ends) and
// the rest muted; the box scrolled inside itself so the band's top is a
// third of the way down. Coloured by Shiki (./shiki.ts), loaded the
// first time a pointer shows. A shortened template name is
// a button: it shows solc's id.
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { band as bandOf, pointerText } from "../engine/pointer-text";
import { useCompilation } from "./hooks";
import { highlighter } from "./shiki";
import type { DataRef } from "./types";

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

export function PointerYaml({ domId, data, variable, band, before }: {
  domId?: string; data: DataRef; variable?: string; band?: string[];
  before?: ReactNode }) {
  const c = useCompilation(data);
  const { lines, names } = useMemo(() => c && variable
    ? pointerText(c, variable) : { lines: [], names: {} }, [c, variable]);
  const text = lines.map((l) => l.text).join("\n");
  const [html, setHtml] = useState<{ text: string; lines: string[] }>();
  useEffect(() => {
    if (!text) return;
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
  }, [text]);
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
    const on = root.querySelector<HTMLElement>(".line.on");
    const top = on ? Math.min(Math.max(0, on.offsetTop - root.clientHeight /
      3), root.scrollHeight - root.clientHeight) : 0;
    const still = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    root.scrollTo?.({ top, behavior: on && !still ? "smooth" : "auto" });
  }, [first, text]);

  const onAlias = (e: React.MouseEvent | React.KeyboardEvent) => {
    const a = (e.target as Element).closest<HTMLElement>(".alias");
    if (!a) return;
    if ("key" in e && e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    setAlias(`${a.textContent}\n${a.dataset.id}`);
  };
  const coloured = html?.text === text ? html.lines : null;
  return <div ref={box} id={domId} className={`ptrscroll${lit.size
    ? " lit" : ""}`} onClick={onAlias} onKeyDown={onAlias}>
    {!variable ? <p className="muted small">Select a value to see the part
      of solc's ethdebug pointer that finds it.</p> : <>
      {before}
      <pre className="ptrlines"><code>{lines.map((l, k) => {
        const on = lit.has(k);
        const cls = `line${on ? ` on${lit.has(k - 1) ? "" : " on-top"}${
          lit.has(k + 1) ? "" : " on-end"}` : ""}`;
        if (coloured) {
          return <span key={`${k}:${coloured[k]}`} className={`${cls} html`}
            dangerouslySetInnerHTML={{ __html: coloured[k] ?? "" }} />;
        }
        const a = aliasAt(l.text);
        return <span key={k} className={cls}>{a ? <>{l.text.slice(0,
          a.from)}<span className="alias" tabIndex={0} role="button"
          data-id={a.id}>{l.text.slice(a.from, a.to)}</span>{
          l.text.slice(a.to)}</> : l.text}</span>;
      })}</code></pre>
      {Object.keys(names).length > 0 && <p className="muted small pids">
        {alias ? <><code className="alias">{alias.split("\n")[0]}</code> =
          solc's <code>{alias.split("\n")[1]}</code></> : PIDS}</p>}</>}
  </div>;
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
