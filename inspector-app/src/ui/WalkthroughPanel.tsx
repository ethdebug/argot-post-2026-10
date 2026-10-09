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
import {
  Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import type { Decoded } from "../engine/types";
import { locked } from "../engine/target";
import { retarget, type Form, type Step, type Tok } from
  "../engine/walkthrough/fold";
import {
  constructOf, FOOT, footOf, placeOf,
} from "../engine/walkthrough/words";
import {
  decodingOf, useDecoded, useLayout, useLens, useLensState, useLink,
  usePoint, usePointAt, useViewSpec, useWalkthrough,
} from "./hooks";
import { infoOf, whereOf, type Info, type Part, type Sides } from "./info";
import { PointerYaml } from "./PointerYaml";
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

export function WalkthroughPanel(p: { id: ViewId; data: DataRef;
  link?: LinkId; domId?: string; compare?: DataRef;
  others?: { decoding: string; who?: string }[] }) {
  const { d, l } = useLayout(p.id);
  // (its parts' ids, after its own: "details" → "dtext"; "mdetails" →
  // "mdtext", for a second panel on the page)
  const idOf = (k: string) => p.domId ? `${p.domId.replace(/details$/,
    "")}${k}` : undefined;
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
    setLink((s) => s.walk ? { ...s, walk: { ...s.walk, busy: true } } : s);
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
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk, busy: false } }
        : s);
    });
  };
  const opening = useRef(false);
  // (where the reader was when they started: back there at exit)
  const back = useRef<{ box: Element; top: number } | null>(null);
  const start = (at = 0, from?: { x: number; y: number }) => {
    if (!sel || !w?.steps.length) return;
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
    setLink((s) => ({ ...s, hover: null, walk: { step: at,
      focus: undefined, n: w.steps.length } }));
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
  }, [!!walk]);
  const exit = async () => {
    if (!walk || unfolding) return;
    await fold(false);
    setLink((s) => ({ ...s, walk: null }));
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
  // each step brings what it lights in the dumps into view, below the
  // sticky panel, when some of it is out of view (not at entry: the
  // page is on its way to the bar; the tree brings its own rows)
  const shownKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    const key = walk ? `${sel}|${i}|${w?.focus ?? ""}` : null;
    const was = shownKey.current;
    shownKey.current = key;
    if (!key || !was || was === key || !unit.current) return;
    const dumps = lens.spec.views.filter((v) => v.kind === "dump" &&
      v.link === p.link).map((v) => `[data-view="${lens.key}:${v.id}"]` +
      ":not([hidden])");
    if (!dumps.length) return;
    const rows = [...document.querySelectorAll<HTMLElement>(dumps.map((q) =>
      `${q} .wrow:is(.on, .gut)`).join(", "))];
    void intoView(unit.current, rows.map((r) => r.getBoundingClientRect()));
  });
  // (an exit asked elsewhere: Escape in the lens)
  const exiting = useRef(false);
  useEffect(() => {
    if (walk?.exit && !exiting.current && !unfolding) {
      exiting.current = true;
      void exit();
    }
  });
  const stepTo = (k: number) => {
    if (!walk || unfolding) return;
    const to = Math.max(0, Math.min(steps.length - 1, k));
    if (to === walk.step) return;
    setLink((s) => s.walk ? { ...s, walk: { ...s.walk, step: to } } : s);
  };
  const setFocus = (f: string) => {
    if (!walk || unfolding || f === w?.focus) return;
    setLink((s) => s.walk ? { ...s, walk: { ...s.walk, focus: f } } : s);
  };
  // (the step count, in the link: the lens's keys clamp to it)
  useEffect(() => {
    if (walk && w && walk.n !== w.steps.length) {
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk,
        n: w.steps.length } } : s);
    }
  }, [walk, w, setLink]);

  // re-targeting: a new selection during a walkthrough keeps it, and its
  // place (the steps aligned by identity); a cue when the place moved
  const last = useRef<{ sel: string; steps: Step[]; at: number } | null>(
    null);
  const [cue, setCue] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const was = last.current;
    if (walk && w && was && was.sel !== sel && sel) {
      const r = retarget(was.steps, was.at, w.steps);
      last.current = { sel, steps: w.steps, at: r.at };
      setLink((s) => s.walk ? { ...s, walk: { step: r.at,
        n: w.steps.length } } : s);
      // (on any change of target: what it walks now, and where)
      setCue((c) => ({ text: `now: ${w.name}, ${placeOf(w.steps, r.at)}`,
        n: (c?.n ?? 0) + 1 }));
      return;
    }
    last.current = walk && w && sel ? { sel, steps: w.steps, at: i } : null;
  }, [walk, w, sel, i, setLink]);
  useEffect(() => {
    if (!cue) return;
    const t = setTimeout(() => setCue(null), 1800);
    return () => clearTimeout(t);
  }, [cue]);

  const onClick = (e: React.MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-r]");
    if (!b) return;
    const k = b.dataset.r!;
    // (✕ Exit while the details unfold: asked for, it ends the
    // walkthrough once they are open, as Escape does; never dropped)
    if (k === "exit") {
      setLink((x) => x.walk ? { ...x, walk: { ...x.walk, exit: true } } : x);
      return;
    }
    if (unfolding) return;
    if (k === "start") start(0, { x: e.clientX, y: e.clientY });
    else stepTo(i + (k === "next" ? 1 : -1));
  };

  let barBody: ReactNode;
  let construct: ReactNode = <span className="rsrc" />;
  let text: ReactNode;
  // (the scene, for the walkthrough's one line of context)
  const scene = useLensState((x) => x.scene);
  const sceneTitle = lens.project.bookmarks.find((b) => b.id === scene)
    ?.title;
  // The bar at rest, two lines (one footprint, selection or none): what
  // is selected, and the way in; with nothing selected, how to begin
  if (!node || !sides) {
    barBody = <><span className="rline1"><span className="rsel muted">
      Click a variable or a byte, then “How it was found” walks the
      pointer to its bytes.</span><span className="rctl" /></span><span
      className="rline2" /></>;
    const t = sides && locked(link.hover, null, sides.d.byPath);
    text = <Details info={sides ? infoOf(sides, t ?? null) : null} />;
  } else if (st && w) {
    // The bar in a walkthrough, three lines: what the reader is doing
    // and the way out; ◀ ▶, where they are, the steps as dots (each a
    // jump; its caption on hover); the step, in its one wording, with
    // what it is about and where its facts come from
    const lastStep = i === steps.length - 1;
    const fc = footOf(st);
    const kind = constructOf(st);
    // (what the step is about and where its facts come from: it
    // describes the pointer's band, so under the pointer; or, one
    // switch away, under the caption)
    construct = <span className="rsrc">{kind && <span className="rkind">
      construct: <b>{kind}</b> · </span>}<span className="source">{
      st.source}</span>{fc && <span className="fnotes"> · <a href={
      FOOT[fc][1]} target="_blank" rel="noopener" title={FOOT[fc][0]}>ⓘ {
      FOOT[fc][0]}</a></span>}</span>;
    barBody = <><span className="rline1"><span className="rtitle">How the
      pointer finds <code>{w.name}</code></span>{sceneTitle && <span
        className="rscene muted"> · {sceneTitle}</span>}<span
        className="rexit"><button type="button" className="btn"
        data-r="exit">✕ Exit</button></span></span>
      <span className="rline2"><span className="rctl"><button type="button"
        className="btn" data-r="prev" aria-label="Previous step"
        disabled={!i}>◀</button>
        {/* (at step 0, ▶ has a halo: the way on; vanilla 23c7c00) */}
        <button type="button" className={`btn rnext${st.goal ? " halo"
          : ""}`} data-r="next" aria-label="Next step"
          disabled={lastStep}>▶</button></span>
        <span className="rcount">{placeOf(steps, i)}</span>
        <span id={idOf("dots")} className="rdots">
          {steps.map((s, k) => <button key={k} type="button"
            className={`dot ${k < i ? "done" : k === i ? "cur" : "later"}`}
            data-k={k} data-n={s.goal ? undefined : k - goal}
            title={plain(s.cap)}
            aria-label={`Step ${placeOf(steps, k)}: ${plain(s.cap)}`}
            aria-current={k === i ? "step" : undefined}
            onClick={() => stepTo(k)} />)}</span>
        {cue && <span key={cue.n} className="rcue" aria-live="polite">
          {cue.text}</span>}</span>
      <span className="rline3"><span className="rcap">{cap(st.cap)}</span>
        {!KIND_UNDER_YAML && construct}</span></>;
    text = <p className="rform"><FormView f={st.form} /></p>;
  } else {
    const own = node.children && node.regions.some((r) =>
      r.role === "length");
    const v = node.value?.text ?? (own ? node.summary : undefined);
    const n = node.children?.length ?? 0;
    const otherText = o?.byPath.get(node.path)?.value?.text;
    // (the selection, as the tree names it; its value or its parts)
    barBody = <><span className="rline1"><span className="rsel"><code>{
      w?.name ?? shortKeys(sel!)}</code>{node.typeText && <> <span className="type">{
      node.typeText}</span></>}{v !== undefined ? <> = <b>{v}</b></>
      : node.children ? <span className="rparts"> · <span className="muted">
        {n} {partsWord(node.typeText, n)}</span></span> : null}{!single && <> <span
        className="muted">({side})</span></>}</span><span className="rctl">
        <button type="button" className="btn rstart" data-r="start"
          disabled={!w?.steps.length}><span className="rplay"
          aria-hidden="true">▶</span> How it was found</button></span>
      </span><span className="rline2 muted">{v === undefined &&
        !node.children ? missing(d!, sel!) : <>{otherText !== undefined &&
        otherText !== v && `${side === "after" ? "before" : "after"}: ${
          otherText} · `}Esc clears the selection</>}
      </span></>;
    text = null;
  }

  // (the focus picker: only at a step it changes, the packed fields;
  // its row kept, empty, at the others)
  const focusing = !!walk && !!w?.recs && st?.phase === "fields";
  return <div ref={unit} className={`wpanel${walk ? " walking" : ""}`}
    data-view={`${lens.key}:${p.id}`}>
    <div ref={bar} id={p.domId} className={`rbar${walk ? " replaying" : ""}`}
      aria-live="polite" tabIndex={0}
      aria-label="The selected value; how it was found"
      data-view={`${lens.key}:${p.id}`} onClick={onClick}>{barBody}
      {/* (in a walkthrough, the step's worked values and the focus, in
        reading order under its caption, in room kept for the tallest:
        stepping moves nothing) */}
      <div className="rdetail" hidden={!walk}>
        <div id={idOf("dtext")} className="dtext">{text}
        </div>
        <div id={idOf("dpick")} className="dpick">
          {focusing && <><span className="plab">Focus</span>
            {[{ path: "*", who: "all", full: "all" }, ...w!.recs!].map((r) =>
              <button key={r.path} type="button" className="btn"
                data-focus={r.path} aria-pressed={r.path === w!.focus
                  ? "true" : "false"} onClick={() => setFocus(r.path)}
                aria-label={`Focus: ${r.full ?? r.who}`}>
                {r.who}</button>)}</>}
          {/* (or, in its room, the pointer's formulas under a step's own
            words, quietly: never at the step the picker is) */}
          {!focusing && st?.formula && <span className="rformula"
            title={st.formula.join("\n")}>{st.formula.join("  ·  ")}
          </span>}</div>
      </div></div>
    <div ref={wrap} id={idOf("dwrap")} className="dwrap"
      data-view={`${lens.key}:${p.id}`}>
      <div ref={panel} id={idOf("dpanel")}
        className="dpanel" hidden={!walk}>
        <div className="ptr" aria-label="Ethdebug data from the compiler">
          <p className="plabel">Ethdebug data from the compiler <span
            className="pnote">(as YAML; template names shortened, yields
            folded)</span></p>
          <PointerYaml domId={idOf("ptr")} data={p.data}
            variable={sel?.split(/[.[]/)[0]} band={st?.band}
            goal={!!st?.goal} shown={!!walk} notes={st?.notes} />
          {KIND_UNDER_YAML && construct}
        </div>
      </div>
    </div>
  </div>;
}
