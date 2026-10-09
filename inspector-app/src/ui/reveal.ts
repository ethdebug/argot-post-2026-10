// The annotated layer's reveal (the post's first before/after): its
// progress, 0 (the raw bytes) to 1 (every value explained). The host
// page's scroll sets it ({ type: "ethdebug:reveal", on, progress }:
// embed/main.tsx); standing alone, the toggle runs it 0 ↔ 1; the hash's
// reveal=1, at 1. Scroll-linked: each value's look is a pure function
// of the progress, written as CSS custom properties on the annotated
// panels (no React render, no layout): raw.css draws them.
import { useSyncExternalStore } from "react";
import { createStore } from "./store";

// The reveal's shape, in one place (to tune). The values come in reading
// order (storage top-down, then the stack, then memory): value i of n
// over [start, start + slice] of the progress, start = i / (n + 1) ·
// span; within its slice, its bytes light over the first `fill` of it
// (each byte `sweep` later than the first, left to right) and its
// popover rises over the rest, from `popFrom`. The toggle runs the
// progress over `toggleMs`; a popover eases each change over `smoothMs`
// (raw.css reads --a-smooth; the bytes follow the scroll as it is). Reduced motion: each value at once, on or off, at
// the middle of its slice.
export const REVEAL = { span: 0.85, slice: 0.25, fill: 0.6, sweep: 0.35,
  popFrom: 0.45, toggleMs: 1500, smoothMs: 80 };

export const reveal = createStore({ progress: new URLSearchParams(
  globalThis.location?.hash.slice(1) ?? "").get("reveal") === "1" ? 1 : 0 });
// (on: any of it shown)
export const useRevealed = () => useSyncExternalStore(reveal.subscribe,
  () => reveal.get().progress > 0);

let anim = 0;
export function setProgress(p: number) {
  cancelAnimationFrame(anim);
  const progress = Math.max(0, Math.min(1, p));
  reveal.set((s) => s.progress === progress ? s : { progress });
}
const still = () => !!globalThis.matchMedia?.(
  "(prefers-reduced-motion: reduce)").matches;
// on or off, run there over REVEAL.toggleMs (at once with reduced motion)
export function setRevealed(on: boolean) {
  const to = on ? 1 : 0;
  const from = reveal.get().progress;
  if (still() || typeof requestAnimationFrame === "undefined") {
    return setProgress(to);
  }
  cancelAnimationFrame(anim);
  const t0 = performance.now();
  const ms = REVEAL.toggleMs * Math.abs(to - from);
  const step = (t: number) => {
    const k = ms ? Math.min(1, (t - t0) / ms) : 1;
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    reveal.set(() => ({ progress: from + (to - from) * e }));
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
// value i of n at progress p: its fill and its popover, 0 to 1
export function stage(i: number, n: number, p: number) {
  const start = i / (n + 1) * REVEAL.span;
  const t = clamp((p - start) / REVEAL.slice);
  if (still()) {
    const on = p >= start + REVEAL.slice / 2 ? 1 : 0;
    return { f: on, p: on };
  }
  return { f: clamp(t / REVEAL.fill),
    p: clamp((t - REVEAL.popFrom) / (1 - REVEAL.popFrom)) };
}

// Write the progress on the annotated panels of the page: on each value's
// bytes (in its panel's reading order, after the panels before it) its
// --tf (fill), on its popover --tp; on the panel, --dim (the rest
// stepping back). Only what changed since the last write (`force`: all
// of a panel, its elements new): a frame of scrolling restyles a value
// or two, never the figure.
const last = new WeakMap<HTMLElement, { f: string[]; p: string[];
  dim: string }>();
const views = () => typeof document === "undefined" ? []
  : [...document.querySelectorAll<HTMLElement>(".view.annot")];
export function paintView(v: HTMLElement, force = false) {
  const all = views();
  const n = all.reduce((m, x) => m + Number(x.dataset.units ?? 0), 0);
  const at = all.slice(0, all.indexOf(v)).reduce((m, x) =>
    m + Number(x.dataset.units ?? 0), 0);
  const k = Number(v.dataset.units ?? 0);
  const p = reveal.get().progress;
  const was = force ? undefined : last.get(v);
  const now = { f: [] as string[], p: [] as string[],
    dim: clamp(p * 4).toFixed(3) };
  if (now.dim !== was?.dim) {
    v.style.setProperty("--dim", now.dim);
    v.style.setProperty("--a-smooth", `${REVEAL.smoothMs}ms`);
    v.style.setProperty("--a-sweep", String(REVEAL.sweep));
  }
  for (let r = 0; r < k; r++) {
    const g = stage(at + r, n, p);
    now.f[r] = g.f.toFixed(3);
    now.p[r] = g.p.toFixed(3);
    if (now.f[r] !== was?.f[r]) {
      for (const c of v.querySelectorAll<HTMLElement>(
        `.rows [data-r="${r}"]`)) c.style.setProperty("--tf", now.f[r]);
    }
    if (now.p[r] !== was?.p[r]) {
      for (const c of v.querySelectorAll<HTMLElement>(
        `.pop.note[data-r="${r}"]`)) c.style.setProperty("--tp", now.p[r]);
    }
  }
  last.set(v, now);
}
export const paintReveal = () => views().forEach((v) => paintView(v));
reveal.subscribe(paintReveal);
