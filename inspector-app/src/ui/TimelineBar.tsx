// The timeline bar (addendum §5): the run's transactions as equal
// segments on a track, a dashed tail after the last (the open future),
// a mark for each of the scene's moments (the current one capped in
// brown), and one line under it: the moment's label, or where it is.
// ◀ ▶ (disabled at the ends, never hidden), a click on a mark, a drag
// that snaps to the marks (the step, one, on release); ← → Home End in
// the lens (Lens.tsx: the walkthrough's keys win while one runs). Its
// height is set by the scene's controls, never by the moment: "none" or
// one moment, the line alone; no label then, nothing.
//
// A replay (scene `replay`: every trace step a point, its own moments
// the marks): ◀ ▶ go mark to mark, ← → a trace step.
//
// Or (`bar: "moments"`) as the walkthrough's bar (WalkthroughPanel.tsx):
// ⏮ ◀ ▶ mark to mark, "n / N", a dot a moment, and under them the
// moment's caption (between marks: the transaction and its step). No
// track: a figure of a few moments. In a replay, each of them (and ← →
// Home End in the lens) moves through the trace steps between, back or
// on, in SPAN (aim), the bytes each step changed flashing (FLASH); at
// once with reduced motion. A new aim during a move goes from where it
// is; a step from one transaction to the next is one step: a cut. A
// frame shows the newest step decoded, its flash the union of the
// steps it passed. Any other show stops it.
import {
  useEffect, useMemo, useRef, useState, type PointerEvent,
} from "react";
import { changed, unionRows } from "../engine/replay";
import type { Location, Snapshot } from "../engine/types";
import type { MomentSource } from "../engine/source";
import { sceneOfTimeline } from "../engine/scene";
import {
  cutMiddle, lineOf, nearest, placeOf, segments,
} from "../engine/timeline-bar";
import { useLens, useLensState, type LensContextValue } from "./hooks";
import type { ViewId } from "./types";
import { cap, plain } from "./WalkthroughPanel";

const LABEL = 16;
// a move's length, ms, for a gap of `n` trace steps: 4 ms a step, at
// least 300, at most 900 (a move, not a wait)
const SPAN = (n: number) => Math.max(300, Math.min(900, 4 * n));
// a changed byte's flash: the change marks' colour, fading out
const FLASH = 250;
const still = () =>
  !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// (the track's share before the tail)
const TRACK = 0.94;
const pct = (x: number) => `${(x * TRACK * 100).toFixed(3)}%`;

// A replay's transactions, its tabs (the moments' bar): each mark's
// transaction, the scene's moment's; a trace step's, the last mark's at
// or before it (its steps run from a transaction's first mark to its
// last, then the next one's)
export function tabOf(marks: number[], txs: number[], k: number): number {
  let j = 0;
  marks.forEach((m, x) => {
    if (m <= k) j = x;
  });
  return txs[j];
}
// (the marks of the transaction `k` is in)
export const tabMarks = (marks: number[], txs: number[], k: number) => {
  const tx = tabOf(marks, txs, k);
  return marks.filter((_, x) => txs[x] === tx);
};

// Go to a moment of a replay, through the steps between (the moments'
// bar; Lens.tsx's keys): a move toward it (TimelineBar's), or at once
// with reduced motion or a walkthrough open (each step would end it)
export function aim(lens: LensContextValue, k: number) {
  const st = lens.store.get();
  const bm = lens.project.bookmarks.find((b) => b.id === st.scene);
  if (!bm || k < 0 || k >= bm.points.length) return;
  const l = st.links[lens.spec.links[0]];
  if (still() || l?.walk) {
    if (k !== st.moment || st.toward !== undefined) {
      void lens.show(bm.id, { moment: k, sel: l?.selection ?? null,
        walk: l?.walk ?? null, step: true });
    }
    return;
  }
  lens.store.set((x) => x.toward === k ? x : { ...x,
    toward: k === x.moment && x.toward === undefined ? undefined : k });
}

export function TimelineBar(p: { id: ViewId; domId?: string;
  bar?: "moments" }) {
  const lens = useLens();
  const { project, spec } = lens;
  const scene = useLensState((s) => s.scene);
  const i = useLensState((s) => s.moment);
  const bm = project.bookmarks.find((b) => b.id === scene);
  const sceneId = bm && sceneOfTimeline(bm.timeline);
  const sc = project.scenes.find((s) => s.id === sceneId);
  const [src, setSrc] = useState<{ id: string; src: MomentSource }>();
  useEffect(() => {
    if (!sceneId) return;
    let live = true;
    void project.source(sceneId).then((x) => live &&
      setSrc({ id: sceneId, src: x }), () => {});
    return () => {
      live = false;
    };
  }, [project, sceneId]);
  const s = src?.id === sceneId ? src?.src : undefined;
  const track = useRef<HTMLDivElement>(null);
  // (a drag: the mark it is at, shown; the step, one, on release)
  const [drag, setDrag] = useState<number | null>(null);
  // (the bookmark's moments: their indexes in the scene; a replay's
  // marks, the scene's own among them)
  const ks = (bm?.points ?? []).map((id) => Number(id.slice(id
    .lastIndexOf(":") + 1)));
  const n = ks.length;
  const replay = !!bm?.replay && !!s;
  const mk = useMemo(() => replay ? bm!.marks!
    : Array.from({ length: n }, (_, k) => k), [replay, bm, n]);
  // (a move under way: the moment it goes to, the lens's; the marks
  // around it, so a click during it goes on from where it is going)
  const toward = useLensState((x) => x.toward);
  const playing = toward !== undefined;
  const go = (k: number) => {
    if (!bm || k < 0 || k >= n) return;
    if (p.bar === "moments" && replay) return void aim(lens, k);
    if (k === lens.store.get().moment) return;
    const l = lens.store.get().links[spec.links[0]];
    void lens.show(bm.id, { moment: k, sel: l?.selection ?? null,
      walk: l?.walk ?? null, step: true });
  };
  const aimAt = toward ?? i;
  // (the moments' bar, a replay of transactions: its tab's marks alone;
  // a tab is a transaction, its moments' first to last, no stepping out)
  const txs = sc?.timeline.map((x) => x.tx) ?? [];
  const tabbed = p.bar === "moments" && replay &&
    new Set(txs).size > 1;
  const inTab = tabbed ? tabMarks(mk, txs, aimAt) : mk;
  const prevMark = [...inTab].reverse().find((k) => k < aimAt);
  const nextMark = inTab.find((k) => k > aimAt);

  // a move (the moments' bar): through every trace step from the one
  // shown to the one it goes to, back or on, in SPAN, a step a frame at
  // most, the newest reached once the one before is decoded; a new aim
  // during it goes on from where it is, to there; any other show stops
  // it (the lens's state says so: what only measures waits, types.ts;
  // and its box, data-playing: no fades of its own on what each step
  // lights)
  const me = useRef<HTMLDivElement>(null);
  // (the change marks' colour: read once a move, a style read a step
  // being a page's style worked out again)
  const colour = useRef("");
  useEffect(() => {
    lens.store.set((x) => !!x.playing === playing ? x
      : { ...x, playing: playing || undefined });
    const box = me.current?.closest(".lens");
    box?.toggleAttribute("data-playing", playing);
    colour.current = "";
    return () => box?.removeAttribute("data-playing");
  }, [playing, lens]);
  // (and its trees' rows, each held at its height while a move runs, a
  // longer value cut short (data-held): a value's lines come and go as
  // it moves, the rows keep theirs; released when it rests. Only the
  // rows drawn: a shut group's are none, and held at no height they
  // would open empty)
  const held = useRef<HTMLElement[] | null>(null);
  useEffect(() => {
    const box = me.current?.closest(".lens");
    if (playing && box && !held.current) {
      const rows = [...box.querySelectorAll<HTMLElement>(".tree li > .row")]
        .filter((r) => r.offsetParent);
      const hs = rows.map((r) => r.getBoundingClientRect().height);
      rows.forEach((r, k) => r.style.setProperty("height", `${hs[k]}px`));
      box.setAttribute("data-held", "");
      held.current = rows;
    }
    if (!playing && held.current) {
      for (const r of held.current) r.style.removeProperty("height");
      box?.removeAttribute("data-held");
      held.current = null;
    }
  }, [playing]);
  useEffect(() => {
    if (!playing || !bm || !replay) return;
    let raf = 0, busy = false, live = true;
    let pos = lens.store.get().moment;
    // (the aim it set its pace for, and the pace: steps a ms)
    let aimed = -1, pace = 0;
    const sel = lens.store.get().links[spec.links[0]]?.selection ?? null;
    let last = performance.now();
    // (the clock read here: a frame's own timestamp is not always on
    // performance.now()'s)
    const tick = () => {
      const goal = lens.store.get().toward;
      if (!live || goal === undefined) return;
      const t = performance.now();
      if (goal !== aimed) {
        aimed = goal;
        pace = Math.abs(goal - pos) / SPAN(Math.abs(goal - pos));
      }
      const d = pace * (t - last);
      last = t;
      pos = goal > pos ? Math.min(goal, pos + d) : Math.max(goal, pos - d);
      const want = goal > pos ? Math.floor(pos) : Math.ceil(pos);
      const shown = lens.store.get().moment;
      if (!busy && want !== shown) {
        busy = true;
        void lens.show(bm.id, { moment: want, sel, walk: null, step: true,
          play: true }).finally(() => {
          busy = false;
        });
      }
      // (there, and drawn: the move ends)
      if (!busy && shown === goal && pos === goal) {
        lens.store.set((x) => x.toward === goal ? { ...x,
          toward: undefined } : x);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [playing, bm, replay, lens, spec]);

  // the flash: the bytes the steps from the one drawn before changed,
  // in each dump (its rows: the replay's, engine/replay.ts)
  const drawn = useRef<number>(i);
  const snaps = useRef<{ id: string; s: Snapshot[];
    rows: Map<Location, string[]> } | undefined>(undefined);
  useEffect(() => {
    const from = drawn.current;
    drawn.current = i;
    if (!playing || !bm || still() || from === i) return;
    const dumps = spec.views.filter((v) => v.kind === "dump");
    const flash = (all: Snapshot[], rows: Map<Location, string[]>) => {
      const root = me.current?.closest(".lens") ?? document;
      colour.current ||= getComputedStyle(root as Element)
        .getPropertyValue("--chg-bg") || "#fff1c7";
      for (const v of dumps) {
        const l = (v as { location: Location }).location;
        const keys = new Set<string>();
        // (a move back: the same steps' changes)
        const [a, z] = from < i ? [from, i] : [i, from];
        for (let k = Math.max(a, 0) + 1; k <= z; k++) {
          for (const c of changed(all[k - 1], all[k], l, rows.get(l) as
            never)) keys.add(c);
        }
        const box = root.querySelector(`[data-view="${lens.key}:${v.id}"]`);
        // (a byte; an abbreviated word, the stack's: the word, once)
        const lit = new Set<Element>();
        for (const c of keys) {
          const [row, b] = c.split("|");
          const w = box?.querySelector(`.word[data-slot="${row}"]`);
          const el = w?.querySelector(`.b[data-i="${b}"]`) ??
            w?.querySelector(".ab");
          if (el) lit.add(el);
        }
        for (const el of lit) {
          el.animate([{ backgroundColor: colour.current },
            { backgroundColor: "transparent" }], { duration: FLASH,
            easing: "ease-out" });
        }
      }
    };
    const got = snaps.current;
    if (got?.id === bm.id) return flash(got.s, got.rows);
    void project.timeline(bm.timeline).then((t) => {
      const all = t.points.map((x) => x.snapshot);
      const rows = new Map(dumps.map((v) => {
        const l = (v as { location: Location }).location;
        return [l, unionRows(all, l)] as const;
      }));
      snaps.current = { id: bm.id, s: all, rows };
      flash(all, rows);
    }, () => {});
  }, [i, playing, bm, spec, lens.key, project]);
  const view = `${lens.key}:${p.id}`;
  const m = s && ks[i] !== undefined ? s.moment(ks[i]) : undefined;
  const line = m ? lineOf(m, s!.txs[m.tx]?.label ?? "") : "";
  if (p.bar === "moments") {
    // (the scene's own moments, its marks; their labels, the scene's,
    // known before its run loads: the bar keeps its form meanwhile)
    const labels = sc?.timeline.map((x) => x.label ?? "") ?? [];
    const onMark = s ? mk.indexOf(i) : -1;
    // (the tab's moments: their indexes among the scene's; before its
    // run loads, the first transaction's)
    const tx = s && tabbed ? tabOf(mk, txs, aimAt) : txs[0];
    const mine = labels.map((_, k) => k).filter((k) => !tabbed ||
      txs[k] === tx);
    const passed = s ? mine.filter((k) => mk[k] <= aimAt).length - 1 : 0;
    const tabs = [...new Set(txs)];
    const text = !m ? "" : onMark >= 0 ? m.label ?? "" : `${cutMiddle(
      s!.txs[m.tx]?.label ?? "", LABEL)} · ${m.step === "end"
      ? "after the transaction" : `step ${m.step}`}`;
    const first = mk[mine[0]] ?? mk[0];
    return <div ref={me} id={p.domId} className="rbar mbar"
      data-view={view} data-moment={i} tabIndex={0}
      aria-label="The figure's moments">
      {/* (its transactions, a tab each: a cut to its first moment) */}
      {tabbed && <span className="ttabs" role="tablist"
        aria-label="Transactions">{tabs.map((t) => <button key={t}
        type="button" role="tab" className="view-name ptab" data-tx={t}
        aria-selected={t === tx} tabIndex={t === tx ? 0 : -1}
        disabled={!s} onClick={() => {
          const k = mk[txs.indexOf(t)];
          if (!bm || t === tx) return;
          const l = lens.store.get().links[spec.links[0]];
          void lens.show(bm.id, { moment: k, sel: l?.selection ?? null,
            walk: null, step: true });
        }}>{sc?.transactions?.[t] ?? s?.txs[t]?.label ?? `tx ${t}`}
      </button>)}</span>}
      <span className="rline2"><span className="rctl">
        <button type="button" className="btn" data-t="first"
          aria-label="Back to the first moment"
          disabled={!s || prevMark === undefined}
          onClick={() => go(first)}>⏮</button>
        <button type="button" className="btn" data-t="prev"
          aria-label="The previous moment"
          disabled={!s || prevMark === undefined}
          onClick={() => go(prevMark!)}>◀</button>
        <button type="button" className="btn rnext" data-t="next"
          aria-label="The next moment"
          disabled={!s || nextMark === undefined}
          onClick={() => go(nextMark!)}>▶</button></span>
        <span className="rcount">{passed + 1} / {mine.length}</span>
        <span className="rdots">{mine.map((k) => [labels[k], k] as const)
          .map(([t, k]) => <button key={k}
          type="button" className={`dot ${!s ? "later" : mk[k] < aimAt
            ? "done" : mk[k] === aimAt ? "cur" : "later"}`} data-k={k}
          title={plain(t)} aria-label={`Moment ${mine.indexOf(k) + 1}: ${
            plain(t)}`}
          aria-current={s && mk[k] === aimAt ? "step" : undefined}
          disabled={!s} onClick={() => go(mk[k])} />)}</span>
      </span>
      <span className="rline3"><span className="rcap">{cap(text)}</span>
      </span>
    </div>;
  }
  const one = n < 2 || sc?.controls === "none";
  // (its run still loading: its line's room kept, as the page's static
  // line keeps it, so nothing moves when the line comes)
  if (one && !s && sceneId) {
    return <div id={p.domId} className="tbar one" data-view={view}>
      <p className="tline" aria-hidden="true">{"\u00a0"}</p></div>;
  }
  if (one && !m?.label) {
    return <div id={p.domId} className="tbar empty" data-view={view} />;
  }
  if (one) {
    return <div id={p.domId} className="tbar one" data-view={view}>
      <p className="tline">{line}</p></div>;
  }
  const steps = s?.txs.map((t) => t.steps) ?? [];
  const places = s ? mk.map((k) => placeOf(s.moment(ks[k]), steps)) : [];
  // (a replay's playhead: the step shown, between its marks)
  const head = replay && s && ks[i] !== undefined
    ? placeOf(s.moment(ks[i]), steps) : undefined;
  const at = (e: PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return nearest(places, (e.clientX - r.left) / (r.width * TRACK));
  };
  // (focusable: its keys, Lens.tsx, with the focus here, as a button
  // that disables at an end drops it)
  // (data-moment: the moment shown, its index in the bookmark's)
  return <div ref={me} id={p.domId} className="tbar" data-view={view}
    data-moment={i} tabIndex={0}
    aria-label="The scene's moments">
    <div className="tctl">
      <button type="button" className="btn" data-t="prev"
        aria-label="The previous moment" disabled={prevMark === undefined}
        onClick={() => go(prevMark!)}>◀</button>
      <button type="button" className="btn" data-t="next"
        aria-label="The next moment" disabled={nextMark === undefined}
        onClick={() => go(nextMark!)}>▶</button>
    </div>
    <div ref={track} className="ttrack"
      onPointerDown={(e) => {
        if (!s) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setDrag(at(e));
      }}
      onPointerMove={(e) => drag !== null && setDrag(at(e))}
      onPointerUp={() => {
        if (drag !== null) go(mk[drag]);
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}>
      {s && segments(s.txs).map((g, k) =>
        <span key={k} className="tseg" title={g.label}
          style={{ left: pct(g.x0), width: pct(g.x1 - g.x0) }}>
          <span className="tlab">{cutMiddle(g.label, LABEL)}</span>
        </span>)}
      <span className="ttail" style={{ left: pct(1) }} />
      {head !== undefined && <span className="thead"
        style={{ left: pct(head) }} />}
      {places.map((x, k) =>
        <button key={k} type="button" data-k={k}
          className={`tmark${(drag !== null ? k === drag : mk[k] === i)
            ? " cur" : ""}`}
          aria-current={mk[k] === i ? "true" : undefined}
          aria-label={s?.moment(ks[mk[k]]).label ?? `moment ${k + 1}`}
          style={{ left: pct(x) }} />)}
    </div>
    <p className="tline">{line}</p>
  </div>;
}
