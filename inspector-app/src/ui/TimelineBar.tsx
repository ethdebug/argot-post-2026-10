// The timeline bar (addendum §5): the run's transactions as equal
// segments on a track, a dashed tail after the last (the open future),
// a mark for each of the scene's moments (the current one capped in
// brown), and one line under it: the moment's label, or where it is.
// ◀ ▶ (disabled at the ends, never hidden), a click on a mark, a drag
// that snaps to the marks (the step, one, on release); ← → Home End in
// the lens (Lens.tsx: the walkthrough's keys win while one runs). Its height is set by the
// scene's controls, never by the moment: "none" or one moment, the line
// alone; no label then, nothing.
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { MomentSource } from "../engine/source";
import { sceneOfTimeline } from "../engine/scene";
import {
  cutMiddle, lineOf, nearest, placeOf, segments,
} from "../engine/timeline-bar";
import { useLens, useLensState } from "./hooks";
import type { ViewId } from "./types";

const LABEL = 16;
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
  // (the bookmark's moments: their indexes in the scene)
  const ks = (bm?.points ?? []).map((id) => Number(id.slice(id
    .lastIndexOf(":") + 1)));
  const n = ks.length;
  const go = (k: number) => {
    if (!bm || k < 0 || k >= n || k === lens.store.get().moment) return;
    const l = lens.store.get().links[spec.links[0]];
    void lens.show(bm.id, { moment: k, sel: l?.selection ?? null,
      walk: l?.walk ?? null, step: true });
  };
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
  const places = s ? ks.map((k) => placeOf(s.moment(k), steps)) : [];
  const at = (e: PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return nearest(places, (e.clientX - r.left) / (r.width * TRACK));
  };
  // (focusable: its keys, Lens.tsx, with the focus here, as a button
  // that disables at an end drops it)
  return <div id={p.domId} className="tbar" data-view={view} tabIndex={0}
    aria-label="The scene's moments">
    <div className="tctl">
      <button type="button" className="btn" data-t="prev"
        aria-label="The previous moment" disabled={i <= 0}
        onClick={() => go(i - 1)}>◀</button>
      <button type="button" className="btn" data-t="next"
        aria-label="The next moment" disabled={i >= n - 1}
        onClick={() => go(i + 1)}>▶</button>
    </div>
    <div ref={track} className="ttrack"
      onPointerDown={(e) => {
        if (!s) return;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setDrag(at(e));
      }}
      onPointerMove={(e) => drag !== null && setDrag(at(e))}
      onPointerUp={() => {
        if (drag !== null) go(drag);
        setDrag(null);
      }}
      onPointerCancel={() => setDrag(null)}>
      {s && segments(s.txs).map((g, k) =>
        <span key={k} className="tseg" title={g.label}
          style={{ left: pct(g.x0), width: pct(g.x1 - g.x0) }}>
          <span className="tlab">{cutMiddle(g.label, LABEL)}</span>
        </span>)}
      <span className="ttail" style={{ left: pct(1) }} />
      {places.map((x, k) =>
        <button key={k} type="button" data-k={k}
          className={`tmark${k === (drag ?? i) ? " cur" : ""}`}
          aria-current={k === i ? "true" : undefined}
          aria-label={s?.moment(ks[k]).label ?? `moment ${k + 1}`}
          style={{ left: pct(x) }} />)}
    </div>
    <p className="tline">{line}</p>
  </div>;
}
