// The stepper's program view (lenses/stepper.tsx): the instruction at
// each moment, from its compiler's ethdebug program. Its instructions, a
// list as the program x-ray's (figures/ProgramXray.tsx), in a column
// with a turned tab, shut at first (LensState.instrs), the one at the
// moment lit and in view; beside them, joined to it, its entry, as
// YAML, as the x-ray's.
import { glide } from "./scroll";
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
} from "react";
import { sceneOfTimeline } from "../engine/scene";
import type { MomentSource } from "../engine/source";
import {
  esc, flat, ordered, scalar, type Json,
} from "../figures/ProgramXray";
import { shiki, useEdges, wrapRange, yamlLines } from "./PointerYaml";
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
  // (the program's: its whole runtime program, or a snapshot's listing
  // of it, the entries the moments reach over it; else those entries)
  const list = useMemo(() => {
    const b = s?.build as { instructions?: Record<number, Instr>;
      listing?: string;
      programs?: { runtime: { instructions: Instr[] } } } | undefined;
    const reached = Object.values(b?.instructions ?? {});
    const byAt = new Map(reached.map((x) => [x.offset, x]));
    const listed = b?.listing?.split("\n").map((l): Instr => {
      const [o, m, ...args] = l.split(" ");
      const at = Number(o);
      return byAt.get(at) ?? { offset: at,
        ...m ? { operation: { mnemonic: m,
          ...args.length ? { arguments: args } : {} } } : {} };
    });
    const xs = b?.programs?.runtime.instructions ?? listed ?? reached;
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

// An entry as YAML lines, from its JSON, each key with nested content
// foldable (`fold`: its path, open or not; a folded one's line a muted
// summary from `sum`, its column). Keys in the format's order; a short
// collection on one line.
export type YLine = { text: string; fold?: { path: string; open: boolean };
  sum?: number };
const LONG = 64;
// (a folded value in brief: its keys, a scalar's value, a list's count)
function summary(x: Json): string {
  if (Array.isArray(x)) return `[ ${x.length} ${x.length === 1 ? "item"
    : "items"} ]`;
  const o = x as Record<string, Json>;
  const parts = ordered(o).map((k) => {
    const y = o[k];
    return y === null || typeof y !== "object" ? `${k}: ${scalar(y)}`
      : Array.isArray(y) ? `${k} (${y.length})` : k;
  });
  let s = "";
  for (const p of parts) {
    const next = s ? `${s}, ${p}` : p;
    if (next.length > LONG) return `{ ${s ? `${s}, ` : ""}… }`;
    s = next;
  }
  return `{ ${s} }`;
}
// (nested: more than one line's worth)
const nests = (x: Json) => x !== null && typeof x === "object" &&
  !(flat(x) && (Array.isArray(x) ? `[ ${x.map(scalar).join(", ")} ]`
    : summary(x)).length <= LONG);
export function entryYaml(v: Record<string, Json>, isOpen: (path: string)
  => boolean, path = "", ind = 0, out: YLine[] = []): YLine[] {
  const pad = "  ".repeat(ind);
  for (const k of ordered(v)) {
    const x = v[k];
    const sub = path ? `${path}.${k}` : k;
    if (x === null || typeof x !== "object") {
      out.push({ text: `${pad}${k}: ${scalar(x)}` });
      continue;
    }
    if (!nests(x)) {
      const o = x as Record<string, Json>;
      out.push({ text: Array.isArray(x) ? `${pad}${k}: [ ${x.map(scalar)
        .join(", ")} ]` : `${pad}${k}: { ${ordered(o).map((j) =>
        `${j}: ${scalar(o[j])}`).join(", ")} }` });
      continue;
    }
    const open = isOpen(sub);
    if (!open) {
      out.push({ text: `${pad}${k}: ${summary(x)} ›`,
        fold: { path: sub, open }, sum: pad.length + k.length + 2 });
      continue;
    }
    out.push({ text: `${pad}${k}:`, fold: { path: sub, open } });
    if (!Array.isArray(x)) {
      entryYaml(x as Record<string, Json>, isOpen, sub, ind + 1, out);
      continue;
    }
    x.forEach((y, n) => {
      const ip = `${sub}[${n}]`;
      if (!nests(y) || Array.isArray(y)) {
        out.push({ text: `${pad}  - ${y === null || typeof y !== "object"
          ? scalar(y) : Array.isArray(y) ? `[ ${y.map(scalar).join(", ")} ]`
          : summary(y)}` });
        return;
      }
      if (!isOpen(ip)) {
        out.push({ text: `${pad}  - ${summary(y)} ›`,
          fold: { path: ip, open: false }, sum: pad.length + 4 });
        return;
      }
      const under = entryYaml(y as Record<string, Json>, isOpen, ip,
        ind + 2);
      const first = under[0].text.trimStart();
      // (the item's first line its "- "; the item folds there unless
      // that line's key folds itself)
      under[0] = { ...under[0], text: `${pad}  - ${first}`,
        ...under[0].fold ? {} : { fold: { path: ip, open: true } } };
      out.push(...under);
    });
  }
  return out;
}
// (folded at first: a context's code, a variable's pointer)
export const foldedFirst = (path: string) => /^context(\.|\[).*\bcode$|^context\.code$/
  .test(path) || /\.pointer$/.test(path);

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
  // (the instruction at the moment in the middle of its list, as the
  // moment changes, its entry beside it: at once as the list opens, else
  // in the transitions' time; the list's box scrolls, never the page)
  const shownAt = useRef(false);
  useLayoutEffect(() => {
    const b = box.current;
    const row = b?.querySelector<HTMLElement>("li > .row.hl");
    if (!b || !row || !open) {
      shownAt.current = false;
      return;
    }
    const top = row.getBoundingClientRect().top -
      b.getBoundingClientRect().top + b.scrollTop;
    glide(b, top - (b.clientHeight - row.offsetHeight) / 2,
      !shownAt.current || undefined);
    shownAt.current = true;
  }, [pc, open, list]);
  // (the reader's folds and unfolds, by path, over the defaults: until
  // the next instruction arrives, held through a move)
  const playing = useLensState((s) => !!s.playing);
  const [mine, setMine] = useState<ReadonlyMap<string, boolean>>(new Map());
  const was = useRef(pc);
  useEffect(() => {
    if (playing || was.current === pc) return;
    was.current = pc;
    setMine(new Map());
  }, [pc, playing]);
  const lines = useMemo(() => entry ? entryYaml(entry as Record<string,
    Json>, (q) => mine.get(q) ?? !foldedFirst(q)) : [], [entry, mine]);
  const flip = (q: string, open: boolean) => setMine((m) =>
    new Map(m).set(q, !open));
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
  // (a new entry from its top)
  useLayoutEffect(() => {
    if (ebox.current) ebox.current.scrollTop = 0;
  }, [text]);
  const { more, edge } = useEdges(ebox, open, [text, !!shown], {
    what: "the entry", band: "its lines" });
  // (where the row meets the box: on its side, a fillet above and below
  // it; level with its top or bottom, that edge flat, its corner square;
  // as the list scrolls, and as it glides)
  const me = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const v = me.current, b = box.current;
    if (!v || !b || !open) return;
    const call = v.querySelector<HTMLElement>(".icall");
    const shape = () => {
      const row = b.querySelector<HTMLElement>("li > .row.hl");
      if (!row || !call) return;
      const r = row.getBoundingClientRect();
      const c = call.getBoundingClientRect();
      const R = 6;
      const top = r.top <= c.top + 0.5 ? "flat" : r.top < c.top + R + 0.5
        ? "none" : "side";
      const bot = r.bottom >= c.bottom - 0.5 ? "flat"
        : r.bottom > c.bottom - R - 0.5 ? "none" : "side";
      if (v.dataset.jt !== top) v.dataset.jt = top;
      if (v.dataset.jb !== bot) v.dataset.jb = bot;
    };
    shape();
    b.addEventListener("scroll", shape);
    const ro = typeof ResizeObserver === "undefined" ? null
      : new ResizeObserver(shape);
    ro?.observe(b);
    return () => {
      b.removeEventListener("scroll", shape);
      ro?.disconnect();
    };
  }, [open, pc, list]);
  const toggle = () => lens.store.set((s) => ({ ...s,
    instrs: !s.instrs || undefined }));
  return <div ref={me} id={p.domId} className="view instrs"
    data-open={String(open)}
    data-view={`${lens.key}:${p.id}`}>
    <div className="view-head"><button type="button"
      className="view-name ptab" aria-expanded={open} onClick={toggle}
      aria-label={`Raw ethdebug: ${open ? "fold" : "open"} the program`}>
      Raw ethdebug<span className="pchev">{CHEV}</span></button></div>
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
        <p className="plabel">ethdebug data for this instruction</p>
        <div className="ptrbox"><div ref={ebox} className={`ptrscroll${
          more.up ? " more-up" : ""}${more.down ? " more-down" : ""}`}>
          <pre className="ptrlines"><code>{lines.map((l, k) => {
            const ci = l.text.length - l.text.trimStart().length;
            return <span key={`${text.length}:${k}`} className={`line${
              l.fold ? " yfold" : ""}${l.fold && !l.fold.open ? " shut"
              : ""}`} style={{ "--ci": ci } as React.CSSProperties}
              data-path={l.fold?.path}>
              {l.fold && <button type="button" className="ychev pchev"
                aria-expanded={l.fold.open}
                aria-label={`${l.fold.open ? "Fold" : "Unfold"} ${
                  l.fold.path}`}
                onClick={() => flip(l.fold!.path, l.fold!.open)}>{CHEV}
              </button>}
              <span dangerouslySetInnerHTML={{ __html: (shown?.[k] ??
                esc(l.text)) }} ref={(el) => {
                // (a folded one's summary muted)
                if (!el || l.sum === undefined || el.querySelector(".ysum"))
                  return;
                wrapRange(el, l.sum, l.text.length, l.fold!.path, "ysum");
                const w = el.querySelector<HTMLElement>(".ysum")!;
                w.removeAttribute("role");
                w.removeAttribute("tabindex");
              }} /></span>;
          })}</code></pre></div>
          {edge("up")}{edge("down")}</div></div></>}</div>
  </div>;
}
