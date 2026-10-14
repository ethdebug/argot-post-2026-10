// The stepper's program views (lenses/stepper.tsx): the instruction at
// each moment, from its compiler's ethdebug program. Its instructions, a
// list as the program x-ray's (figures/ProgramXray.tsx), in a column
// with a turned tab, shut at first (LensState.instrs), the one at the
// moment lit and in view; and that instruction's entry, as YAML, as the
// x-ray's, in a drawer under the variables (LensState.entry), opened
// and shut by a line of its own under them.
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { sceneOfTimeline } from "../engine/scene";
import type { MomentSource } from "../engine/source";
import {
  brief, esc, yaml, type Json, type Line,
} from "../figures/ProgramXray";
import { shiki, useEdges, yamlLines } from "./PointerYaml";
import { CHEV } from "./Tree";
import {
  useCompilation, useLens, useLensState, usePointAt,
} from "./hooks";
import type { DataRef, ViewId } from "./types";

type Instr = { offset: number; operation?: { mnemonic: string;
  arguments?: string[] }; context?: Json; [k: string]: Json | undefined };

// a context's first source range (a gather's, a frame's: the first)
function rangeIn(c: Json | undefined): { offset: number; length: number }
  | undefined {
  if (!c || typeof c !== "object") return undefined;
  if (Array.isArray(c)) {
    for (const x of c) {
      const r = rangeIn(x);
      if (r) return r;
    }
    return undefined;
  }
  const code = (c as Record<string, Json>).code as Record<string, Json>
    | undefined;
  const r = code?.range as { offset: number; length: number } | undefined;
  if (r && typeof r.offset === "number") return r;
  for (const v of Object.values(c)) {
    const x = rangeIn(v);
    if (x) return x;
  }
  return undefined;
}

// The program's instructions, and the one at the moment shown: its
// offset (its pc); the run's or the snapshot's (the moments' pcs)
function useInstrs(data: DataRef) {
  const lens = useLens();
  const at = usePointAt(data);
  const scene = useLensState((s) => s.scene);
  const bm = lens.project.bookmarks.find((b) => b.id === scene);
  const id = bm && sceneOfTimeline(bm.timeline);
  const [src, setSrc] = useState<{ id: string; s: MomentSource }>();
  useEffect(() => {
    if (!id) return;
    let live = true;
    void lens.project.source(id).then((s) => live && setSrc({ id, s }),
      () => {});
    return () => {
      live = false;
    };
  }, [lens.project, id]);
  const s = src && src.id === id ? src.s : undefined;
  const list = useMemo(() => {
    const b = s?.build as { instructions?: Record<number, Instr>;
      programs?: { runtime: { instructions: Instr[] } } } | undefined;
    const xs = b?.programs?.runtime.instructions ??
      Object.values(b?.instructions ?? {});
    return [...xs].sort((a, c) => a.offset - c.offset);
  }, [s]);
  const k = at ? Number(at.p.id.slice(at.p.id.lastIndexOf(":") + 1)) : -1;
  const pc = s && k >= 0 ? s.moment(k)?.pc : undefined;
  const entry = pc === undefined ? undefined
    : list.find((x) => x.offset === pc);
  return { list, pc, entry };
}

const op = (x: Instr) => [x.operation?.mnemonic,
  ...x.operation?.arguments ?? []].join(" ");

// The instructions' column: a turned tab, its list when open
export function Instructions(p: { id: ViewId; data: DataRef;
  domId?: string }) {
  const lens = useLens();
  const open = useLensState((s) => !!s.instrs);
  const { list, pc } = useInstrs(p.data);
  const c = useCompilation(p.data);
  const text = c?.sources[0]?.text ?? "";
  const briefs = useMemo(() => list.map((x) => {
    const r = rangeIn(x.context);
    return r ? brief(text, r.offset, r.offset + r.length) : "";
  }), [list, text]);
  const box = useRef<HTMLUListElement>(null);
  // (the instruction at the moment, a third of the way down its list,
  // as the moment changes; the list's box scrolls, never the page)
  useLayoutEffect(() => {
    const b = box.current;
    const row = b?.querySelector<HTMLElement>("li > .row.hl");
    if (!b || !row || !open) return;
    const r = row.getBoundingClientRect(), bb = b.getBoundingClientRect();
    if (r.top >= bb.top && r.bottom <= bb.bottom) return;
    b.scrollTop += r.top - bb.top - b.clientHeight / 3;
  }, [pc, open, list]);
  const toggle = () => lens.store.set((s) => ({ ...s,
    instrs: !s.instrs || undefined }));
  return <div id={p.domId} className="view instrs" data-open={String(open)}
    data-view={`${lens.key}:${p.id}`}>
    <div className="view-head"><button type="button"
      className="view-name ptab" aria-expanded={open} onClick={toggle}
      aria-label={`Instructions: ${open ? "fold" : "open"} the list`}>
      Instructions<span className="pchev">{CHEV}</span></button></div>
    <div className="ibox">{open && <ul ref={box}
      className="tree srows xrows" tabIndex={0}
      aria-label="The program's instructions">
      {list.map((x, k) => <li key={x.offset} data-offset={x.offset}
        className={briefs[k] ? undefined : "absent"}>
        <div className={`row${x.offset === pc ? " hl" : ""}`}>
          <span className="type">{x.offset}</span>
          <span className="name">{op(x)}</span>
          <span className="val">{briefs[k] || "no context"}</span>
        </div></li>)}</ul>}</div>
  </div>;
}

// The entry's drawer: a line under the variables that opens it; open,
// the instruction at the moment's entry, as YAML
export function InstructionEntry(p: { id: ViewId; data: DataRef;
  domId?: string }) {
  const lens = useLens();
  const open = useLensState((s) => !!s.entry);
  const { entry, pc } = useInstrs(p.data);
  const lines = useMemo(() => {
    const out: Line[] = [];
    if (entry) yaml(entry as Record<string, Json>, "", 0, out, 200);
    return out;
  }, [entry]);
  const text = lines.map((l) => l.text).join("\n");
  const [html, setHtml] = useState<{ text: string; lines: string[] }>();
  useEffect(() => {
    if (!open || !text || html?.text === text) return;
    let live = true;
    void shiki().then((hl) => {
      if (hl && live) setHtml({ text, lines: yamlLines(hl, text) });
    });
    return () => {
      live = false;
    };
  }, [open, text, html?.text]);
  const shown = html?.text === text ? html.lines : null;
  // (its box's edges: a button where there is more, the pointer's)
  const box = useRef<HTMLDivElement>(null);
  const { more, edge } = useEdges(box, open, [text, !!shown], {
    what: "the entry", band: "its lines" });
  const toggle = () => lens.store.set((s) => ({ ...s,
    entry: !s.entry || undefined }));
  return <div id={p.domId} className="entrydrawer" data-open={String(open)}
    data-view={`${lens.key}:${p.id}`}>
    <button type="button" className="gap entrylink" onClick={toggle}
      aria-expanded={open}><span>{open ? "Hide" : "Show"} this
      instruction's ethdebug data</span></button>
    {open && <div className="ptr xentry"
      aria-label="The instruction's entry">
      <p className="plabel"><span className="ptitle">Instruction at {
        pc}</span> <span className="pnote">its entry, as YAML</span></p>
      <div className="ptrbox"><div ref={box} className={`ptrscroll${
        more.up ? " more-up" : ""}${more.down ? " more-down" : ""}`}>
        <pre className="ptrlines"><code>{lines.map((l, k) =>
          <span key={`${text.length}:${k}`} className="line"
            dangerouslySetInnerHTML={{ __html: shown?.[k] ?? esc(l.text) }}
          />)}</code></pre></div>{edge("up")}{edge("down")}</div></div>}
  </div>;
}
