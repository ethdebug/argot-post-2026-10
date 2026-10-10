// A figure's "↺ Reset": back to the scene as first shown (its bookmark,
// lens.show), shown only while the reader has changed it (its selection,
// rows, groups shut or opened, a walkthrough or its step, the moment);
// its room always kept, so nothing moves when it shows (the embed's)
import { useEffect, useRef, useState } from "react";
import type { LensContextValue } from "./hooks";
import type { LensState } from "./types";

// the state a reader changes (not a hover, nor what the lens counts)
const keyOf = (s: LensState) => JSON.stringify({ scene: s.scene,
  moment: s.moment, related: s.related?.context ?? null,
  links: Object.entries(s.links).map(([k, l]) => [k, l.selection,
    l.walk ? [l.walk.step, l.walk.focus ?? null] : null]),
  views: Object.entries(s.views).map(([k, v]) => [k,
    [...v.collapsed].sort(), [...v.open ?? []].sort()]) });

export function Reset(p: { lens: LensContextValue | null; scene: string;
  ready: Promise<boolean> | null }) {
  const first = useRef<string | null>(null);
  // (whether the reader has acted since the figure was shown, or reset)
  const acted = useRef(false);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    const { lens, ready } = p;
    if (!lens || !ready) return;
    let live = true;
    let off = () => {};
    // (the scene as first shown: what the lens settles to before the
    // reader does anything; then each change compared with it)
    const act = (e: Event) => {
      if (!(e.target as Element | null)?.closest?.(".reset")) {
        acted.current = true;
      }
    };
    const kinds = ["pointerdown", "keydown"];
    kinds.forEach((t) => addEventListener(t, act, true));
    void ready.then(() => {
      if (!live) return;
      first.current = keyOf(lens.store.get());
      off = lens.store.subscribe(() => {
        const now = keyOf(lens.store.get());
        if (!acted.current) first.current = now;
        setChanged(now !== first.current);
      });
    });
    return () => {
      live = false;
      off();
      kinds.forEach((t) => removeEventListener(t, act, true));
    };
  }, [p.lens, p.ready]);
  return <button type="button" className="btn reset" data-shown={changed
    ? "" : undefined} aria-hidden={!changed} tabIndex={changed ? 0 : -1}
    aria-label="Reset figure: back to the figure as first shown"
    onClick={() => {
      if (!p.lens) return;
      acted.current = false;
      void p.lens.show(p.scene).then(() => {
        first.current = keyOf(p.lens!.store.get());
        setChanged(false);
      });
    }}><span aria-hidden="true">↺</span> Reset</button>;
}
