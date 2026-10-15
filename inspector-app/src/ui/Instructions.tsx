// The stepper's program view (lenses/stepper.tsx): the instruction at
// each moment, from its compiler's ethdebug program. Its instructions, a
// list as the program x-ray's (figures/ProgramXray.tsx), in a column
// with a turned tab, shut at first (LensState.instrs), the one at the
// moment lit and in view; beside them, joined to it, its entry, as
// YAML, as the x-ray's.
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { sceneOfTimeline } from "../engine/scene";
import type { MomentSource } from "../engine/source";
import {
  esc, yaml, type Json, type Line,
} from "../figures/ProgramXray";
import { shiki, useEdges, yamlLines } from "./PointerYaml";
import { CHEV } from "./Tree";
import {
  useLens, useLensState, usePointAt,
} from "./hooks";
import type { DataRef, ViewId } from "./types";

type Instr = { offset: number; operation?: { mnemonic: string;
  arguments?: string[] }; context?: Json; [k: string]: Json | undefined };

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

// (a value that, while a replay plays, changes at most every `ms`: the
// last one at rest)
function useThrottled<T>(x: T, ms: number): T {
  const playing = useLensState((s) => !!s.playing);
  const [held, setHeld] = useState(x);
  const last = useRef(0);
  useEffect(() => {
    if (!playing) {
      setHeld(x);
      return;
    }
    const wait = last.current + ms - Date.now();
    const t = setTimeout(() => {
      last.current = Date.now();
      setHeld(x);
    }, Math.max(0, wait));
    return () => clearTimeout(t);
  }, [x, playing, ms]);
  return playing ? held : x;
}

// The instructions' column: a turned tab; open, the program's
// instructions, a list to read, not to choose from (the moment chooses),
// the one at the moment lit and in view; beside it, joined to it, that
// instruction's entry, as YAML, as the x-ray's
export function Instructions(p: { id: ViewId; data: DataRef;
  domId?: string }) {
  const lens = useLens();
  const open = useLensState((s) => !!s.instrs);
  const now = useInstrs(p.data);
  const pc = useThrottled(now.pc, 250);
  const { list } = now;
  const entry = pc === undefined ? undefined
    : list.find((x) => x.offset === pc);
  const box = useRef<HTMLUListElement>(null);
  // (the instruction at the moment, a third of the way down its list,
  // as the moment changes, its entry beside it; the list's box scrolls,
  // never the page)
  useLayoutEffect(() => {
    const b = box.current;
    const row = b?.querySelector<HTMLElement>("li > .row.hl");
    if (!b || !row || !open) return;
    const r = row.getBoundingClientRect(), bb = b.getBoundingClientRect();
    b.scrollTop += r.top - bb.top - b.clientHeight / 3;
  }, [pc, open, list]);
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
  // (the entry's box's edges: a button where there is more, the
  // pointer's)
  const ebox = useRef<HTMLDivElement>(null);
  const { more, edge } = useEdges(ebox, open, [text, !!shown], {
    what: "the entry", band: "its lines" });
  const toggle = () => lens.store.set((s) => ({ ...s,
    instrs: !s.instrs || undefined }));
  return <div id={p.domId} className="view instrs" data-open={String(open)}
    data-view={`${lens.key}:${p.id}`}>
    <div className="view-head"><button type="button"
      className="view-name ptab" aria-expanded={open} onClick={toggle}
      aria-label={`Instructions: ${open ? "fold" : "open"} the list`}>
      Instructions<span className="pchev">{CHEV}</span></button></div>
    <div className="ibox">{open && <>
      <ul ref={box} className="tree srows xrows"
        aria-label="The program's instructions">
        {list.map((x) => <li key={x.offset} data-offset={x.offset}>
          <div className={`row${x.offset === pc ? " hl" : ""}`}>
            <span className="type">{x.offset}</span>
            <span className="name">{op(x)}</span>
          </div></li>)}</ul>
      <div className="ptr xentry icall"
        aria-label={`The entry of the instruction at ${pc ?? "none"}`}>
        <div className="ptrbox"><div ref={ebox} className={`ptrscroll${
          more.up ? " more-up" : ""}${more.down ? " more-down" : ""}`}>
          <pre className="ptrlines"><code>{lines.map((l, k) =>
            <span key={`${text.length}:${k}`} className="line"
              dangerouslySetInnerHTML={{ __html: shown?.[k] ??
                esc(l.text) }} />)}</code></pre></div>
          {edge("up")}{edge("down")}</div></div></>}</div>
  </div>;
}
