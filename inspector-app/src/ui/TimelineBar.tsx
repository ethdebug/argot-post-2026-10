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
// the marks): ◀ ▶ go mark to mark, ← → a trace step, and its play (▶,
// ⏸ while it plays) steps through the transaction from the step shown
// to its end, a tape spinning up (RATE), the bytes each step changed in
// its dumps flashing (FLASH; none with reduced motion). A frame shows
// the newest step decoded, its flash the union of the steps it passed.
// Any other move stops it.
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
import { useLens, useLensState } from "./hooks";
import type { ViewId } from "./types";

const LABEL = 16;
// a play's rate, trace steps a second, `t` ms after it starts: 20,
// easing up to 120 over two seconds
const RATE = (t: number) => 20 + 100 * Math.min(1, t / 2000) ** 2;
// a changed byte's flash: the change marks' colour, fading out
const FLASH = 250;
const still = () =>
  !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
// (the track's share before the tail)
const TRACK = 0.94;
const pct = (x: number) => `${(x * TRACK * 100).toFixed(3)}%`;

export function TimelineBar(p: { id: ViewId; domId?: string }) {
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
  const [playing, setPlaying] = useState(false);
  const go = (k: number) => {
    setPlaying(false);
    if (!bm || k < 0 || k >= n || k === lens.store.get().moment) return;
    const l = lens.store.get().links[spec.links[0]];
    void lens.show(bm.id, { moment: k, sel: l?.selection ?? null,
      walk: l?.walk ?? null, step: true });
  };
  const prevMark = [...mk].reverse().find((k) => k < i);
  const nextMark = mk.find((k) => k > i);

  // the play: from the step shown (its end: from its first mark) to the
  // transaction's end, a step a frame at most, the newest the rate has
  // reached once the one before is decoded; any other move stops it
  // (the lens's state says so: what only measures waits, types.ts; and
  // its box, data-playing: no fades of its own on what each step lights)
  const me = useRef<HTMLDivElement>(null);
  // (the change marks' colour: read once a play, a style read a step
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
  // (and its trees' rows, each held at its height as the play starts,
  // a longer value cut short (data-held): a value's lines come and go
  // as it plays, the rows keep theirs; until the next move after it)
  const held = useRef<{ at: number; rows: HTMLElement[] } | null>(null);
  useEffect(() => {
    const box = me.current?.closest(".lens");
    if (playing && box && !held.current) {
      const rows = [...box.querySelectorAll<HTMLElement>(".tree li > .row")];
      const hs = rows.map((r) => r.getBoundingClientRect().height);
      rows.forEach((r, k) => r.style.setProperty("height", `${hs[k]}px`));
      box.setAttribute("data-held", "");
      held.current = { at: i, rows };
    }
    if (playing && held.current) held.current.at = i;
    if (!playing && held.current && held.current.at !== i) {
      for (const r of held.current.rows) r.style.removeProperty("height");
      box?.removeAttribute("data-held");
      held.current = null;
    }
  }, [playing, i]);
  useEffect(() => {
    if (!playing || !bm || !replay) return;
    let raf = 0, busy = false, live = true;
    const t0 = performance.now();
    let pos = lens.store.get().moment;
    if (pos >= n - 1) pos = mk[0];
    let asked = pos;
    const sel = lens.store.get().links[spec.links[0]]?.selection ?? null;
    // (another show, a key's or a mark's, clears the lens's playing:
    // stopped, its next step never asked; Lens.tsx)
    const off = lens.store.subscribe(() => {
      if (!lens.store.get().playing) {
        live = false;
        cancelAnimationFrame(raf);
        setPlaying(false);
      }
    });
    let last = t0;
    // (the clock read here: a frame's own timestamp is not always on
    // performance.now()'s)
    const tick = () => {
      if (!live) return;
      const t = performance.now();
      pos += RATE(t - t0) * (t - last) / 1000;
      last = t;
      const want = Math.min(n - 1, Math.floor(pos));
      if (!busy && want !== lens.store.get().moment) {
        busy = true;
        asked = want;
        void lens.show(bm.id, { moment: want, sel, walk: null, step: true,
          play: true }).finally(() => {
          busy = false;
        });
      }
      if (asked >= n - 1 && !busy) return setPlaying(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      off();
    };
  }, [playing, bm, replay, n, lens, spec, mk]);

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
        for (let k = Math.max(from, 0) + 1; k <= i; k++) {
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
      {replay && <button type="button" className="btn tplaybtn"
        data-t="play" aria-pressed={playing}
        aria-label={playing ? "Pause" : "Play the transaction, a step at " +
          "a time"} onClick={() => setPlaying((x) => !x)}>
        {playing ? "⏸" : "⏵"}</button>}
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
