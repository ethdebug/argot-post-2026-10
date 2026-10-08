// The contract's source in a box at the top (vanilla index.html
// #contract-box, main.js markSource): closed by default, open or closed
// as this viewer left it; coloured (Shiki) the first time it opens; the
// selection's declaration marked, and scrolled into the box's view.
import { useEffect, useMemo, useRef, useState } from "react";
import { declarationOf, linesOf } from "../engine/declaration";
import { highlighter } from "./shiki";
import { useCompilation, useDecoded, useLens, useLink } from "./hooks";
import type { DataRef, ViewId } from "./types";

const KEY = "inspector-source-open";
const remembered = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

// (`file`, `text`: the page's own source, when it has one: shown at
// once, and its declarations marked only for a compilation of it)
export function ContractSource(p: { id: ViewId; data: DataRef;
  link?: string; domId?: string; file?: string; text?: string }) {
  const lens = useLens();
  const c = useCompilation(p.data);
  const d = useDecoded(p.data);
  const [link] = useLink(p.link);
  const [open, setOpen] = useState(remembered);
  const [lines, setLines] = useState<string[] | null>(null);
  const pre = useRef<HTMLPreElement>(null);
  const src = c?.sources[0];
  const text = p.text ?? src?.text ?? "";
  const file = p.file ?? src?.path.split("/").pop();
  // (coloured once it opens; plain lines until then)
  useEffect(() => {
    if (!open || !text || lines) return;
    let live = true;
    highlighter().then((hl) => {
      if (!live) return;
      const t = document.createElement("template");
      t.innerHTML = hl.codeToHtml(text, { lang: "solidity",
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false });
      setLines([...t.content.querySelectorAll(".line")].map((l) =>
        l.innerHTML));
    }, (e) => console.warn(
      "the colouring did not load; the source stays plain", e));
    return () => {
      live = false;
    };
  }, [open, text, lines]);
  const sel = link.selection;
  const decl = useMemo(() => {
    const r = c && d && sel && d.byPath.has(sel) && src?.text === text
      ? declarationOf(c, d, sel) : null;
    return r ? linesOf(text, r) : null;
  }, [c, d, sel, text, src]);
  useEffect(() => {
    const m = decl && pre.current?.querySelectorAll(".line")[decl[0]];
    if (m && open) {
      pre.current!.scrollTop = Math.max(0, (m as HTMLElement).offsetTop -
        pre.current!.offsetTop - 40);
    }
  }, [decl, open, lines]);
  const plain = text.replace(/\n$/, "").split("\n");
  const rows = lines ?? plain;
  return <details id={p.domId} className="srcbox" open={open}
    data-view={`${lens.key}:${p.id}`}
    onToggle={(e) => {
      const o = (e.currentTarget as HTMLDetailsElement).open;
      setOpen(o);
      try {
        localStorage.setItem(KEY, o ? "1" : "0");
      } catch { /* (no storage: not remembered) */ }
    }}>
    <summary><span className="srcfile">{file}</span>
      {" "}— the contract (<span className="srclines">{plain.length}</span>
      {" "}lines)</summary>
    <pre ref={pre} id="contract-src" className={`src${lines ? " coloured"
      : ""}`}>{rows.map((l, k) => <span key={k} className={`line${decl &&
        k >= decl[0] && k <= decl[1] ? " decl" : ""}`}
      {...(lines ? { dangerouslySetInnerHTML: { __html: l } }
        : { children: l })} />).flatMap((x, k) => k ? ["\n", x] : [x])}
    </pre></details>;
}
