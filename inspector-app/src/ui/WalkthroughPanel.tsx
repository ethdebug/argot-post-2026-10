// The bar over both columns and the details under it, as one unit
// (vanilla main.js renderBox, startReplay, stepTo, endReplay, fold,
// setFocus, retarget, cue; index.html #details, #dwrap). At rest: the
// selection and "▸ Show how it was found" (with nothing selected, the
// details of what is pointed at). In a walkthrough: the bar tinted,
// "Walkthrough", ⏮ ◀ ▶ ⏭ (each disabled at its end), the count (step 0,
// the goal, counts 0), the step's short caption and ✕ Exit; under it,
// the pointer, the step in full, the focus picker and the chips. Every
// part keeps its slot, used or empty: nothing moves but the details'
// unfolding at entry and exit (280 ms; none with reduced motion).
//
// One path in every context: the controller (useWalkModel) makes a
// serializable model of the panel from the engine and the lens's link,
// and acts on the reader's intents; the view (PanelView) draws a model
// and sends intents. On the page and in the shell the two meet here; in
// the post, the figure's embed sends its model to a panel of its own
// frame (embed-panel.html), over a channel (panel-port.ts).
import {
  Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo,
  useRef, useState, type ReactNode,
} from "react";
import type { Decoded } from "../engine/types";
import { locked } from "../engine/target";
import {
  retarget, type Form, type Rec, type Step, type Tok,
} from "../engine/walkthrough/fold";
import { pointerText } from "../engine/pointer-text";
import {
  constructOf, FOOT, footOf, placeOf,
} from "../engine/walkthrough/words";
import {
  useCompilation, useDecoded, useLayout, useLens, useLensState, useLink,
  usePoint, usePointAt, useViewSpec, useWalkthrough,
} from "./hooks";
import { infoOf, type Info, type Part, type Sides } from "./info";
import { PointerYaml, type YamlText } from "./PointerYaml";
import { PanelPort } from "./panel-port";
import { intoView, scrollerOf, scrollBy, toTop } from "./scroll";
import type { DataRef, LinkId, ViewId } from "./types";

// (where the construct line stands: under the pointer it describes, or
// under the step's caption; the maintainer's open choice, 10-08)
const KIND_UNDER_YAML = true;
const PROBE = "Point at a value or a byte for its details.";
const short = (h: string, keep = 4) => {
  const s = "0x" + (h.replace(/^0x0*/, "") || "0");
  return s.length <= keep * 2 + 4 ? s
    : `${s.slice(0, keep + 2)}…${s.slice(-keep)}`;
};
const shortKeys = (path: string) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);
const partsWord = (typeText: string, n: number) =>
  (typeText.startsWith("mapping(") ? ["entry", "entries"]
    : /\[\d*\]$/.test(typeText) ? ["item", "items"]
      : typeText ? ["field", "fields"] : ["part", "parts"])[n === 1 ? 0 : 1];
const still = () =>
  !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const parts = (ps: Part[]) => ps.map((p, k) => typeof p === "string"
  ? <Fragment key={k}>{p}</Fragment> : <code key={k}>{p.code}</code>);
// a caption's names from the code (in `backticks`), in monospace
const plain = (t: string) => t.replace(/`/g, "");
const cap = (t: string) => t.split(/`([^`]+)`/).map((x, k) => k % 2
  ? <code key={k} className="id">{x}</code>
  : <Fragment key={k}>{x}</Fragment>);
const pk = (k: number | string | undefined) =>
  k === undefined || k === 0 ? "" : `pk${k}`;

function toks(ts: Tok[]): ReactNode {
  return ts.map((t, k) => typeof t === "string"
    ? <Fragment key={k}>{t}</Fragment>
    : "code" in t ? <code key={k}>{t.code}</code>
      : "gloss" in t ? <span key={k} className="gloss">{t.gloss}</span>
        : "prose" in t ? <span key={k} className="prose">{t.prose}</span>
          : "question" in t ? <span key={k} className="prose rq">{
            t.question}</span>
            : <span key={k} className="fname" data-path={t.field}>{t.text}
            </span>);
}

// A step's worked values: a line, a table (one row an instance), lines,
// or a byte strip (a word's 32 bytes as a dump row draws them, the
// fields over their bytes, in their colours)
function FormView({ f }: { f: Form }) {
  if (f.kind === "text") return <>{toks(f.toks)}</>;
  if (f.kind === "lines") {
    return <>{f.lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}
      {toks(l)}</Fragment>)}</>;
  }
  if (f.kind === "table") {
    return <span className="itab">{f.rows.map((r, k) => <Fragment key={k}>
      <span>{toks(r.a)}</span><span className="prose">→</span>
      <span className={r.k ? `${pk(r.k)} isw` : r.k === 0 ? "pk0 isw"
        : undefined}>{toks(r.b)}
      </span></Fragment>)}</span>;
  }
  // (as a dump row: 32 cells, a gap after each eight; on a phone two
  // rows of 16. A name too long for its span stands over it, in a row
  // kept for it, with a tick down to its cells: vanilla byteStrip)
  const fits = (n: string, a: number, b: number) => n.length <= (b - a + 1)
    * 2.6;
  const row = (lo: number, hi: number) => {
    const col = (i: number) => i - lo + 1;
    const vs: ReactNode[] = [];
    const cs: ReactNode[] = [];
    f.fields.forEach((x, k) => {
      if (x.to < lo || x.from > hi) return;
      const out = !fits(x.name, x.from, x.to);
      const [a, b] = [Math.max(x.from, lo), Math.min(x.to, hi)];
      const at = { gridColumn: `${col(a)} / ${col(b) + 1}` };
      vs.push(<span key={k} className={`bsv pk${x.k || 0}`}
        data-path={x.path} style={at}>{!out &&
          <span className="bsn">{x.name}</span>}</span>);
      if (out) {
        const side = a - lo <= 2 ? " lft" : hi - b <= 2 ? " rgt" : "";
        cs.push(<span key={k} className={`bsc${side}`} style={at}>
          <span className={`bsl pk${x.k || 0}`}>{x.name}</span></span>);
      }
    });
    return <><span className="bsrow bscall">{cs}</span>
      <span className="bsrow bsbar">{vs}</span>
      <span className="bsrow bsidx" aria-hidden="true">{Array.from(
        { length: hi - lo + 1 }, (_, j) => <span key={j}
          style={{ gridColumn: col(lo + j) }}>{lo + j}</span>)}</span></>;
  };
  return <span className="bstrip" role="img" aria-label={f.fields.map((x) =>
    `${x.name}: ${x.from === x.to ? `byte ${x.from}`
      : `bytes ${x.from} to ${x.to}`}`).join("; ")}>
    <span className="bs32">{row(0, 31)}</span>
    <span className="bs16">{row(0, 15)}{row(16, 31)}</span>
  </span>;
}

function Details({ info }: { info: Info | null }) {
  if (!info) return <p className="muted">{PROBE}</p>;
  return <dl>{info.map(([t, d]) => <Fragment key={t}>
    <dt>{t}</dt><dd>{parts(d)}</dd></Fragment>)}</dl>;
}

// "no such value (playerList has 2 items)"
function missing(d: Decoded, path: string) {
  const parent = d.byPath.get(path.replace(/(\.[^.[\]]+|\[[^\]]*\])$/, ""));
  const len = parent?.summary?.match(/^length (\d+)$/)?.[1];
  return `no such value${len !== undefined ? ` (${parent!.label} has ${len
    } item${len === "1" ? "" : "s"})` : ""}`;
}

// ------------------------------------------------------------- model

// The panel, as it is drawn: plain data (it crosses a frame's channel)
export interface PanelModel {
  key: string;                          // its views' data-view
  walking: boolean;
  // at rest: nothing selected (the details of what is pointed at), or the
  // selection and the way in
  rest?: { info: Info | null } | { name: string; typeText: string;
    value?: string; parts?: string; side?: string; canStart: boolean;
    line2: string };
  // in a walkthrough: its step
  walk?: { name: string; scene?: string; i: number; place: string;
    last: boolean; goal: boolean; dots: { cap: string; n?: number;
      place: string }[];
    cue?: { text: string; n: number }; cap: string; form: Form;
    formula?: string[]; construct: { kind: string; source: string;
      foot?: [string, string] };
    focus?: { recs: Rec[]; focus: string } };
  // the selection's pointer, its band, its notes
  yaml: { text: YamlText | null; band?: string[]; goal: boolean;
    notes?: { block: string; values: Record<string, string> } };
  exit?: boolean;                       // an exit asked for
}
// What the reader does, for the controller to act on
export type Intent = { type: "start" } | { type: "step"; to: number } |
  { type: "exit" } | { type: "exited" } | { type: "focus"; path: string } |
  { type: "busy"; on: boolean };

// -------------------------------------------------------- controller

export function useWalkModel(p: { id: ViewId; data: DataRef;
  link?: LinkId; compare?: DataRef }, external = false):
  { model: PanelModel; act: (i: Intent) => void } {
  const { d, l } = useLayout(p.id);
  const o = useDecoded(p.compare);
  const here = usePoint(p.data);
  const there = usePoint(p.compare);
  const [link, setLink] = useLink(p.link);
  // (of a pair, which this moment is: the earlier, before; the later)
  const side = (usePointAt(p.data)?.i ?? 0) < (usePointAt(p.compare)?.i ??
    0) ? "before" : "after";
  const single = !p.compare;
  useViewSpec(p.id);
  const lens = useLens();
  const w = useWalkthrough(p.id);
  const c = useCompilation(p.data);
  const sides: Sides | undefined = d && l ? { d, l, snap: here?.snapshot,
    ...(o ? { pair: side === "before"
      ? { before: { d, snap: here?.snapshot },
        after: { d: o, snap: there?.snapshot } }
      : { before: { d: o, snap: there?.snapshot },
        after: { d, snap: here?.snapshot } } } : {}) } : undefined;
  const sel = link.selection && d?.byPath.has(link.selection)
    ? link.selection : null;
  const node = sel ? d!.byPath.get(sel) : undefined;
  const walk = link.walk;
  const steps = w?.steps ?? [];
  const goal = steps[0]?.goal ? 1 : 0;
  const i = walk ? Math.max(0, Math.min(steps.length - 1, walk.step)) : -1;
  const st: Step | undefined = walk ? steps[i] : undefined;
  const key = `${lens.key}:${p.id}`;

  const act = (x: Intent) => {
    const busy = !!walk?.busy;
    if (x.type === "start") {
      if (!sel || !w?.steps.length) return;
      setLink((s) => ({ ...s, hover: null, walk: { step: 0,
        focus: undefined, n: w.steps.length } }));
    } else if (x.type === "step") {
      if (!walk || busy) return;
      const to = Math.max(0, Math.min(steps.length - 1, x.to));
      if (to === walk.step) return;
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk, step: to } } : s);
    } else if (x.type === "exit") {
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk, exit: true } } : s);
    } else if (x.type === "exited") {
      setLink((s) => ({ ...s, walk: null }));
    } else if (x.type === "focus") {
      if (!walk || busy || x.path === w?.focus) return;
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk, focus: x.path } }
        : s);
    } else {
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk, busy: x.on } } : s);
    }
  };

  // each step brings what it lights in the dumps into view, below the
  // sticky panel, when some of it is out of view (not at entry: the
  // page is on its way to the bar; the tree brings its own rows). In a
  // frame of the post, the host scrolls: the rows' place in the frame,
  // to it ({ type: "ethdebug:scroll-to", y, bottom })
  const shownKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const k = walk ? `${sel}|${i}|${w?.focus ?? ""}` : null;
    const was = shownKey.current;
    shownKey.current = k;
    if (!k || !was || was === k) return;
    const dumps = lens.spec.views.filter((v) => v.kind === "dump" &&
      v.link === p.link).map((v) => `[data-view="${lens.key}:${v.id}"]` +
      ":not([hidden])");
    if (!dumps.length) return;
    const rows = [...document.querySelectorAll<HTMLElement>(dumps.map((q) =>
      `${q} .wrow:is(.on, .gut)`).join(", "))];
    if (!rows.length) return;
    const rects = rows.map((r) => r.getBoundingClientRect());
    if (external) {
      parent.postMessage({ type: "ethdebug:scroll-to",
        y: Math.round(Math.min(...rects.map((r) => r.top)) + scrollY),
        bottom: Math.round(Math.max(...rects.map((r) => r.bottom)) +
          scrollY) }, "*");
      return;
    }
    const unit = document.querySelector(`.wpanel[data-view="${key}"]`);
    if (unit) void intoView(unit, rects);
  });
  // (the step count, in the link: the lens's keys clamp to it)
  useEffect(() => {
    if (walk && w && walk.n !== w.steps.length) {
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk,
        n: w.steps.length } } : s);
    }
  }, [walk, w, setLink]);

  // re-targeting: a new selection during a walkthrough keeps it, and its
  // place (the steps aligned by identity); a cue when the place moved.
  // (The same selection at another moment, the debugger's move: its
  // place kept the same way; a cue only if it moved)
  const last = useRef<{ sel: string; steps: Step[]; at: number;
    point?: string } | null>(null);
  const [cue, setCue] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const was = last.current;
    const point = d?.point;
    if (walk && w && was && sel && (was.sel !== sel ||
      (was.point !== point && was.steps !== w.steps))) {
      const r = retarget(was.steps, was.at, w.steps);
      last.current = { sel, steps: w.steps, at: r.at, point };
      setLink((s) => s.walk ? { ...s, walk: { step: r.at,
        n: w.steps.length } } : s);
      // (on any change of target: what it walks now, and where)
      if (was.sel !== sel || r.at !== was.at) {
        setCue((x) => ({ text: `now: ${w.name}, ${placeOf(w.steps,
          r.at)}`, n: (x?.n ?? 0) + 1 }));
      }
      return;
    }
    last.current = walk && w && sel ? { sel, steps: w.steps, at: i, point }
      : null;
  }, [walk, w, sel, i, setLink, d?.point]);
  useEffect(() => {
    if (!cue) return;
    const t = setTimeout(() => setCue(null), 1800);
    return () => clearTimeout(t);
  }, [cue]);

  // (the scene, for the walkthrough's one line of context)
  const scene = useLensState((x) => x.scene);
  const sceneTitle = lens.project.bookmarks.find((b) => b.id === scene)
    ?.title;
  // the selection's variable's pointer (a local's: from its graph)
  const variable = sel?.split(/[.[]/)[0];
  const pointer = variable ? d?.graphs.get(variable)?.pointer : undefined;
  const yaml = useMemo(() => c && variable ? pointerText(c, variable,
    pointer) : null, [c, variable, pointer]);

  let rest: PanelModel["rest"];
  let wm: PanelModel["walk"];
  if (!node || !sides) {
    const t = sides && locked(link.hover, null, sides.d.byPath);
    rest = { info: sides ? infoOf(sides, t ?? null) : null };
  } else if (st && w) {
    const fc = footOf(st);
    // (the focus picker: only at a step it changes, the packed fields)
    const focusing = !!w.recs && st.phase === "fields";
    wm = { name: w.name, ...sceneTitle ? { scene: sceneTitle } : {}, i,
      place: placeOf(steps, i), last: i === steps.length - 1,
      goal: !!st.goal, dots: steps.map((s, k) => ({ cap: s.cap,
        ...s.goal ? {} : { n: k - goal }, place: placeOf(steps, k) })),
      ...cue ? { cue } : {}, cap: st.cap, form: st.form,
      ...st.formula ? { formula: st.formula } : {},
      construct: { kind: constructOf(st), source: st.source,
        ...fc ? { foot: FOOT[fc] } : {} },
      ...focusing ? { focus: { recs: w.recs!, focus: w.focus } } : {} };
  } else {
    const own = node.children && node.regions.some((r) =>
      r.role === "length");
    const v = node.value?.text ?? (own ? node.summary : undefined);
    const n = node.children?.length ?? 0;
    const otherText = o?.byPath.get(node.path)?.value?.text;
    rest = { name: w?.name ?? shortKeys(sel!), typeText: node.typeText,
      ...v !== undefined ? { value: v } : node.children
        ? { parts: `${n} ${partsWord(node.typeText, n)}` } : {},
      ...!single ? { side } : {}, canStart: !!w?.steps.length,
      line2: v === undefined && !node.children ? missing(d!, sel!)
        : `${otherText !== undefined && otherText !== v ? `${side ===
          "after" ? "before" : "after"}: ${otherText} · ` : ""}Esc clears ` +
          "the selection" };
  }
  const model: PanelModel = { key, walking: !!walk, rest, walk: wm,
    yaml: { text: yaml, band: st?.band, goal: !!st?.goal,
      ...st?.notes ? { notes: st.notes } : {} },
    ...walk?.exit ? { exit: true } : {} };
  return { model, act };
}

// -------------------------------------------------------------- view

// The panel, drawn from its model; the reader's intents to `act`
export function PanelView({ model: m, act, domId }: { model: PanelModel;
  act: (i: Intent) => void; domId?: string }) {
  // (its parts' ids, after its own: "details" → "dtext"; "mdetails" →
  // "mdtext", for a second panel on the page)
  const idOf = (k: string) => domId ? `${domId.replace(/details$/,
    "")}${k}` : undefined;
  const walk = m.walking;
  const wm = m.walk;
  // the unfolding of the details: at entry and exit only; meanwhile the
  // walkthrough takes no input. At entry the page scrolls first, then
  // the details unfold (`after`: the scroll), one motion after the other
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const unit = useRef<HTMLDivElement>(null);
  const [unfolding, setUnfolding] = useState(false);
  const started = useRef(0);
  const fold = (open: boolean, after = Promise.resolve()) => {
    const dp = panel.current;
    const wr = wrap.current;
    const h = dp?.offsetHeight ?? 0;
    if (!dp || !wr || still() || !h || !wr.animate) return after;
    setUnfolding(true);
    // (no step while the details move: the lens's keys see it)
    act({ type: "busy", on: true });
    wr.classList.add("folding");
    // (shut while the page scrolls to the bar)
    if (open) wr.style.height = "0px";
    const o2 = { duration: 280, easing: open ? "ease-out" : "ease-in" };
    const hs = [{ height: "0px" }, { height: `${h}px` }];
    const ts = [{ transform: `translateY(${-h}px)` }, { transform: "none" }];
    if (!open) {
      hs.reverse();
      ts.reverse();
    }
    return after.then(() => {
      wr.style.height = "";
      wr.animate(hs, { ...o2, fill: "forwards" });
      return dp.animate(ts, { ...o2, fill: "forwards" }).finished;
    }).then(() => {
      wr.getAnimations().forEach((a) => a.cancel());
      dp.getAnimations().forEach((a) => a.cancel());
      wr.classList.remove("folding");
      setUnfolding(false);
      act({ type: "busy", on: false });
    });
  };
  const opening = useRef(false);
  // (where the reader was when they started: back there at exit)
  const back = useRef<{ box: Element; top: number } | null>(null);
  const start = (from?: { x: number; y: number }) => {
    if (!m.rest || !("canStart" in m.rest) || !m.rest.canStart) return;
    started.current = performance.now();
    opening.current = true;
    // (a double click on the entry: its second click, at the same place,
    // lands wherever the page has scrolled, on a step button or a tree
    // row; it is ignored)
    const swallow = (e: MouseEvent) => {
      if (from && e.detail > 1 && Math.abs(e.clientX - from.x) < 8 &&
        Math.abs(e.clientY - from.y) < 8 &&
        performance.now() - started.current < 600) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    document.addEventListener("click", swallow, true);
    setTimeout(() => document.removeEventListener("click", swallow, true),
      600);
    const s = bar.current && scrollerOf(bar.current);
    back.current = s ? { box: s.box, top: s.box.scrollTop } : null;
    act({ type: "start" });
  };
  // (once the details are drawn: bring the bar to the top of its scroll
  // container, then unfold them; the focus to ▶)
  useLayoutEffect(() => {
    if (!opening.current || !walk) return;
    opening.current = false;
    void fold(true, bar.current ? toTop(bar.current) : undefined);
    (bar.current?.querySelector<HTMLElement>(
      'button[data-r="next"]:not([disabled])') ?? bar.current
      ?.querySelector<HTMLElement>("button:not([disabled])"))
      ?.focus({ preventScroll: true });
  });
  // the panel sticks at the top of its scroll container during a
  // walkthrough, below the container's scroll-padding-top (a host's
  // sticky header)
  useLayoutEffect(() => {
    const u = unit.current;
    if (!u) return;
    const top = walk ? `${scrollerOf(u).pad}px` : "";
    if (u.style.top !== top) u.style.top = top;
  }, [walk]);
  // (and its section's dump headers stick under it, never under it: its
  // place and height, and the headers' own, as the section's variables,
  // as they change; the CSS reads them)
  useEffect(() => {
    const u = unit.current;
    const zone = u?.closest<HTMLElement>(".walkzone");
    if (!u || !zone || !walk) return;
    const put = (k: string, v: string) => {
      if (zone.style.getPropertyValue(k) !== v) zone.style.setProperty(k, v);
    };
    const head = zone.querySelector<HTMLElement>(".words > h2");
    const measure = () => {
      put("--walk-top", `${scrollerOf(u).pad}px`);
      put("--walk-h", `${u.offsetHeight}px`);
      if (head) put("--walk-head", `${head.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(u);
    if (head) ro.observe(head);
    return () => ro.disconnect();
  }, [walk]);
  const exit = async () => {
    if (!walk || unfolding) return;
    await fold(false);
    act({ type: "exited" });
    exiting.current = false;
    // (the reader back where they pressed Start)
    const b = back.current;
    back.current = null;
    if (b) {
      void scrollBy({ box: b.box, root: false, pad: 0 },
        b.top - b.box.scrollTop);
    }
    setTimeout(() => bar.current?.querySelector<HTMLElement>(
      'button[data-r="start"]')?.focus({ preventScroll: true }));
  };
  // (an exit asked for: ✕ Exit, or Escape in the lens)
  const exiting = useRef(false);
  useEffect(() => {
    if (m.exit && !exiting.current && !unfolding) {
      exiting.current = true;
      void exit();
    }
  });
  const stepTo = (k: number) => {
    if (!walk || unfolding) return;
    act({ type: "step", to: k });
  };

  const onClick = (e: React.MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-r]");
    if (!b) return;
    const k = b.dataset.r!;
    // (✕ Exit while the details unfold: asked for, it ends the
    // walkthrough once they are open, as Escape does; never dropped)
    if (k === "exit") {
      act({ type: "exit" });
      return;
    }
    if (unfolding) return;
    if (k === "start") start({ x: e.clientX, y: e.clientY });
    else if (wm) stepTo(wm.i + (k === "next" ? 1 : -1));
  };

  let barBody: ReactNode;
  let construct: ReactNode = <span className="rsrc" />;
  let text: ReactNode;
  const r = m.rest;
  if (wm) {
    // The bar in a walkthrough, three lines: what the reader is doing
    // and the way out; ◀ ▶, where they are, the steps as dots (each a
    // jump; its caption on hover); the step, in its one wording, with
    // what it is about and where its facts come from
    const { kind, source, foot } = wm.construct;
    // (what the step is about and where its facts come from: it
    // describes the pointer's band, so under the pointer; or, one
    // switch away, under the caption)
    construct = <span className="rsrc">{kind && <span className="rkind">
      construct: <b>{kind}</b> · </span>}<span className="source">{
      source}</span>{foot && <span className="fnotes"> · <a href={
      foot[1]} target="_blank" rel="noopener" title={foot[0]}>ⓘ {
      foot[0]}</a></span>}</span>;
    barBody = <><span className="rline1"><span className="rtitle">How the
      pointer finds <code>{wm.name}</code></span>{wm.scene && <span
        className="rscene muted"> · {wm.scene}</span>}<span
        className="rexit"><button type="button" className="btn"
        data-r="exit">✕ Exit</button></span></span>
      <span className="rline2"><span className="rctl"><button type="button"
        className="btn" data-r="prev" aria-label="Previous step"
        disabled={!wm.i}>◀</button>
        {/* (at step 0, ▶ has a halo: the way on; vanilla 23c7c00) */}
        <button type="button" className={`btn rnext${wm.goal ? " halo"
          : ""}`} data-r="next" aria-label="Next step"
          disabled={wm.last}>▶</button></span>
        <span className="rcount">{wm.place}</span>
        <span id={idOf("dots")} className="rdots">
          {wm.dots.map((s, k) => <button key={k} type="button"
            className={`dot ${k < wm.i ? "done" : k === wm.i ? "cur"
              : "later"}`}
            data-k={k} data-n={s.n}
            title={plain(s.cap)}
            aria-label={`Step ${s.place}: ${plain(s.cap)}`}
            aria-current={k === wm.i ? "step" : undefined}
            onClick={() => stepTo(k)} />)}</span>
        {wm.cue && <span key={wm.cue.n} className="rcue" aria-live="polite">
          {wm.cue.text}</span>}</span>
      <span className="rline3"><span className="rcap">{cap(wm.cap)}</span>
        {!KIND_UNDER_YAML && construct}</span></>;
    text = <p className="rform"><FormView f={wm.form} /></p>;
  } else if (!r || "info" in r) {
    // The bar at rest, two lines (one footprint, selection or none): what
    // is selected, and the way in; with nothing selected, how to begin
    barBody = <><span className="rline1"><span className="rsel muted">
      Click a variable or a byte, then “How it was found” walks the
      pointer to its bytes.</span><span className="rctl" /></span><span
      className="rline2" /></>;
    text = <Details info={r?.info ?? null} />;
  } else {
    // (the selection, as the tree names it; its value or its parts)
    barBody = <><span className="rline1"><span className="rsel"><code>{
      r.name}</code>{r.typeText && <> <span className="type">{
      r.typeText}</span></>}{r.value !== undefined ? <> = <b>{r.value}</b></>
      : r.parts ? <span className="rparts"> · <span className="muted">
        {r.parts}</span></span> : null}{r.side && <> <span
        className="muted">({r.side})</span></>}</span><span className="rctl">
        <button type="button" className="btn rstart" data-r="start"
          disabled={!r.canStart}><span className="rplay"
          aria-hidden="true">▶</span> How it was found</button></span>
      </span><span className="rline2 muted">{r.line2}
      </span></>;
    text = null;
  }

  const focus = wm?.focus;
  return <div ref={unit} className={`wpanel${walk ? " walking" : ""}`}
    data-view={m.key}>
    <div ref={bar} id={domId} className={`rbar${walk ? " replaying" : ""}`}
      aria-live="polite" tabIndex={0}
      aria-label="The selected value; how it was found"
      data-view={m.key} onClick={onClick}>{barBody}
      {/* (in a walkthrough, the step's worked values and the focus, in
        reading order under its caption, in room kept for the tallest:
        stepping moves nothing) */}
      <div className="rdetail" hidden={!walk}>
        <div id={idOf("dtext")} className="dtext">{text}
        </div>
        <div id={idOf("dpick")} className="dpick">
          {focus && <><span className="plab">Focus</span>
            {[{ path: "*", who: "all", full: "all" }, ...focus.recs].map((x) =>
              <button key={x.path} type="button" className="btn"
                data-focus={x.path} aria-pressed={x.path === focus.focus
                  ? "true" : "false"} onClick={() => !unfolding &&
                  act({ type: "focus", path: x.path })}
                aria-label={`Focus: ${x.full ?? x.who}`}>
                {x.who}</button>)}</>}
          {/* (or, in its room, the pointer's formulas under a step's own
            words, quietly: never at the step the picker is) */}
          {!focus && wm?.formula && <span className="rformula"
            title={wm.formula.join("\n")}>{wm.formula.join("  ·  ")}
          </span>}</div>
      </div></div>
    <div ref={wrap} id={idOf("dwrap")} className="dwrap" data-view={m.key}>
      <div ref={panel} id={idOf("dpanel")}
        className="dpanel" hidden={!walk}>
        <div className="ptr" aria-label="Ethdebug data from the compiler">
          <p className="plabel">Ethdebug data from the compiler <span
            className="pnote">(as YAML; template names shortened, yields
            folded)</span></p>
          <PointerYaml domId={idOf("ptr")} text={m.yaml.text}
            band={m.yaml.band} goal={m.yaml.goal} shown={walk}
            notes={m.yaml.notes} />
          {KIND_UNDER_YAML && construct}
        </div>
      </div>
    </div>
  </div>;
}

// ---------------------------------------------------------- the view kind

// The walkthrough's view: its controller, and its view on the page (or,
// in a figure of the post whose panel is a frame of its own, its model
// to that frame, and the frame's intents back: nothing drawn here)
export function WalkthroughPanel(p: { id: ViewId; data: DataRef;
  link?: LinkId; domId?: string; compare?: DataRef;
  others?: { decoding: string; who?: string }[] }) {
  const port = useContext(PanelPort);
  const { model, act } = useWalkModel(p, !!port);
  const latest = useRef(act);
  latest.current = act;
  const stable = useCallback((i: Intent) => latest.current(i), []);
  useEffect(() => port?.publish(model));
  useEffect(() => port?.listen(stable), [port, stable]);
  if (port) return null;
  return <PanelView model={model} act={stable} domId={p.domId} />;
}
