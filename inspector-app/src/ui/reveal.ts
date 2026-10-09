// The annotated layer's reveal (the post's first before/after): its
// progress, 0 (the raw bytes) to 1 (every value explained). The host
// page's scroll sets it ({ type: "ethdebug:reveal", on, progress }:
// embed/main.tsx); standing alone, the toggle runs it 0 ↔ 1; the hash's
// reveal=1, at 1. Scroll-linked: each value's look is a pure function
// of the progress, written as CSS custom properties on the annotated
// panels (no React render, no layout): raw.css draws them.
import { useSyncExternalStore } from "react";
import { createStore } from "./store";

// The reveal's shape, in one place (to tune). Each panel takes its
// `share` of the progress, in reading order (storage, then the stack,
// then memory; the shares of the panels shown, scaled to 1). Its
// values come one after another within it, each over a `slice` of the
// progress (the last ending with the panel's share); within its slice,
// its bytes light over the first `fill` of it (each byte up to `sweep`
// later than the first, left to right) and its popover rises from
// `popFrom` on. The toggle runs the progress over `toggleMs`; a popover
// eases each change over `smoothMs` (raw.css reads --a-smooth; the
// bytes follow the scroll as it is). Reduced motion: each value at
// once, on or off, at the middle of its slice.
export const REVEAL = {
  share: { storage: 0.55, stack: 0.2, memory: 0.25 } as Record<string,
    number>,
  slice: 0.14, fill: 0.6, sweep: 0.35, popFrom: 0.15, toggleMs: 1500,
  smoothMs: 80 };

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
// value i of n, in a panel's window [a, a + w] of the progress, at
// progress p: its fill and its popover, 0 to 1
export function stage(i: number, n: number, p: number, a = 0, w = 1) {
  const slice = Math.min(REVEAL.slice, w);
  const start = a + (n > 1 ? i / (n - 1) : 0) * (w - slice);
  const t = clamp((p - start) / slice);
  if (still()) {
    const on = p >= start + slice / 2 ? 1 : 0;
    return { f: on, p: on };
  }
  return { f: clamp(t / REVEAL.fill),
    p: clamp((t - REVEAL.popFrom) / (1 - REVEAL.popFrom)) };
}

// each annotated panel's window of the progress, by its share
function windows(all: HTMLElement[]) {
  const share = (v: HTMLElement) => REVEAL.share[v.dataset.location ?? ""]
    ?? 0.2;
  const sum = all.reduce((m, v) => m + share(v), 0) || 1;
  let a = 0;
  return new Map(all.map((v) => {
    const w = share(v) / sum;
    const out = [a, w] as const;
    a += w;
    return [v, out];
  }));
}

// Write the progress on the annotated panels of the page: on each value's
// bytes (in its panel's reading order, in its panel's window) its --tf
// (fill), on its popover --tp; on the panel, --dim (the rest stepping
// back, as its first value begins). Only what changed since the last write (`force`: all
// of a panel, its elements new): a frame of scrolling restyles a value
// or two, never the figure.
const last = new WeakMap<HTMLElement, { f: string[]; p: string[];
  dim: string }>();
const views = () => typeof document === "undefined" ? []
  : [...document.querySelectorAll<HTMLElement>(".view.annot")];
export function paintView(v: HTMLElement, force = false) {
  const [a, w] = windows(views()).get(v) ?? [0, 1];
  const k = Number(v.dataset.units ?? 0);
  const p = reveal.get().progress;
  const was = force ? undefined : last.get(v);
  const now = { f: [] as string[], p: [] as string[],
    dim: stage(0, k, p, a, w).f.toFixed(3) };
  // (the figure's disclaimer: once the reveal is complete, as the host's
  // own line after it; the toggle's, at its run's end)
  (v.closest<HTMLElement>(".lens") ?? v).style.setProperty("--hand",
    p >= 1 ? "1" : "0");
  if (now.dim !== was?.dim) {
    v.style.setProperty("--dim", now.dim);
    v.style.setProperty("--a-smooth", `${REVEAL.smoothMs}ms`);
    v.style.setProperty("--a-sweep", String(REVEAL.sweep));
  }
  for (let r = 0; r < k; r++) {
    const g = stage(r, k, p, a, w);
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
