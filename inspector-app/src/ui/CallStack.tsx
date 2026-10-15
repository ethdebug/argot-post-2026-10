// The stepper's call stack (lenses/stepper.tsx): at the moment, its
// functions from the program's invoke and return marks (engine/run/
// annotate.ts), outermost first, a line: "play › _applyCombo
// (inlined)", broken between frames, never in one. A frame chosen shows
// where it was called, its call site, in the code (ui/Code.tsx), until
// the next moment or another click. Beside the code, as wide as the
// variables' column; its room kept, so nothing moves from step to step.
import { useLayoutEffect, useRef } from "react";
import { useLens, useLensState, usePoint } from "./hooks";
import type { DataRef, ViewId } from "./types";

export function CallStack(p: { id: ViewId; data: DataRef;
  domId?: string }) {
  const lens = useLens();
  const calls = usePoint(p.data)?.paused?.calls ?? [];
  const site = useLensState((s) => s.site);
  const me = useRef<HTMLDivElement>(null);
  // (the variables' column's width, as it is)
  useLayoutEffect(() => {
    const el = me.current;
    const side = el?.closest(".lens")?.querySelector<HTMLElement>(
      ":scope > .sidecol");
    if (!el || !side || typeof ResizeObserver === "undefined") return;
    const set = () => el.style.setProperty("--side-w",
      `${side.getBoundingClientRect().width}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(side);
    return () => ro.disconnect();
  }, []);
  const pick = (s: (typeof calls)[number]["site"]) => lens.store.set(
    (x) => ({ ...x, site: !s || (x.site && x.site.offset === s.offset &&
      x.site.length === s.length) ? undefined : s }));
  return <div ref={me} id={p.domId} className="view callstack"
    data-view={`${lens.key}:${p.id}`}>
    <p className="codehead"><span className="srcfile">call stack</span></p>
    <div className="pbox cbox"><p className="cline" aria-label={
      "The call stack, outermost first"}>
      {calls.length ? calls.map((c, k) => <span key={k} className="cunit">
        {k > 0 && <span className="csep" aria-hidden="true">›</span>}
        <button type="button" className={`cframe${c.inline ? " inl" : ""}`}
          disabled={!c.site} aria-pressed={!!c.site && !!site &&
            site.offset === c.site.offset}
          title={c.site ? "Show where it was called" : undefined}
          onClick={() => pick(c.site)}><code>{c.name}</code>{c.inline &&
            <span className="cinl"> inlined</span>}</button></span>)
        : <span className="muted cnone">no function called</span>}
    </p></div>
  </div>;
}
