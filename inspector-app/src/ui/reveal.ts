// The annotated layer's reveal (the post's first before/after): its
// progress, 0 (the raw bytes) to 1 (every value explained). The host
// page's scroll sets it ({ type: "ethdebug:reveal", on, progress }:
// embed/main.tsx); standing alone, the toggle runs it 0 ↔ 1; the hash's
// reveal=1, at 1. Scroll-linked: each value's look is a pure function
// of the progress, written as CSS custom properties on the annotated
// panels (no React render, no layout): raw.css draws them.
import { useSyncExternalStore } from "react";
import { createStore } from "./store";

// The reveal's shape, in one place (to tune): the overture. One voice
// alone, then another, then more and faster, mostly top to bottom: the
// theme (slot 2, two values in one word), playerList (the keys every
// record is found by), then the records: bob's, carol's (answered by
// memory's keccak input, key carol, with alice's), motd, and the tutti
// (the stack's four in a cascade, memory's last under them). `score`:
// by panel, each value's entrance in reading order (the panel's ranks,
// ui/Dump.tsx), [start, length] in the progress; a rank past its
// panel's list enters with the list's last; a panel not scored, its
// values evenly over `rest`. Within its entrance, its bytes light over
// all of it, eased in and out (each byte up to `sweep` later than the
// first, left to right), and its popover rises from `popFrom` of it over
// `popFor` of it, eased out. The toggle runs the progress over
// `toggleMs`; a popover eases each change over `smoothMs` (raw.css reads
// --a-smooth; the bytes follow the scroll as it is). Reduced motion:
// each value at once, on or off, at the middle of its entrance. The
// disclaimer: from `afterAt` of the host's hold after the reveal (its
// `after`), or `afterMs` after the progress reaches 1 (a host with no
// `after`, the toggle). (private/reveal-score.md: the score, in words)
export const REVEAL = {
  score: {
    // (playerList, motd, slot 2's two, carol, bob, alice)
    storage: [[0.24, 0.12], [0.64, 0.08], [0, 0.18], [0, 0.18],
      [0.47, 0.09], [0.38, 0.1], [0.54, 0.08]],
    memory: [[0.53, 0.09], [0.53, 0.09], [0.8, 0.08]],
    stack: [[0.7, 0.06], [0.73, 0.06], [0.76, 0.06], [0.79, 0.06]],
  } as Record<string, [number, number][]>,
  rest: [0.3, 0.9] as [number, number],
  popFrom: 0.35, popFor: 0.65, sweep: 0.35, toggleMs: 1500,
  afterAt: 0.5, afterMs: 600,
  smoothMs: 80 };

// (`after`: the host's hold after the reveal, 0 to 1 (its next beat at
// 0); the figure's disclaimer shows from `afterAt` on. A host that
// sends none, and the toggle: `afterMs` after the progress reaches 1)
const opened = new URLSearchParams(globalThis.location?.hash.slice(1) ??
  "").get("reveal") === "1" ? 1 : 0;
export const reveal = createStore({ progress: opened, after: opened });
// (on: any of it shown)
export const useRevealed = () => useSyncExternalStore(reveal.subscribe,
  () => reveal.get().progress > 0);

let anim = 0;
let hold: ReturnType<typeof setTimeout> | undefined;
// the progress, 0 to 1, and the hold after it, if the host says
export function setProgress(p: number, after?: number) {
  cancelAnimationFrame(anim);
  at(p, after);
}
function at(p: number, after?: number) {
  const progress = Math.max(0, Math.min(1, p));
  clearTimeout(hold);
  hold = undefined;
  let a = after ?? (progress >= 1 ? reveal.get().after : 0);
  if (after === undefined && progress >= 1 && !a) {
    hold = setTimeout(() => reveal.set((s) => s.progress >= 1
      ? { ...s, after: 1 } : s), REVEAL.afterMs);
  }
  if (progress < 1 && after === undefined) a = 0;
  reveal.set((s) => s.progress === progress && s.after === a ? s
    : { progress, after: a });
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
    at(from + (to - from) * e);
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const inOut = (x: number) => x * x * (3 - 2 * x);
const out = (x: number) => 1 - (1 - x) ** 3;
// value r (its rank) of n in its panel (`loc`), at progress p: its
// entrance, [start, length]
export function entrance(loc: string, r: number, n: number) {
  const mine = REVEAL.score[loc];
  if (mine?.length) return mine[Math.min(r, mine.length - 1)];
  const [a, b] = REVEAL.rest;
  const len = Math.min(0.1, b - a);
  return [a + (n > 1 ? r / (n - 1) : 0) * (b - a - len), len];
}
// ... and its fill and its popover, 0 to 1
export function stage(loc: string, r: number, n: number, p: number) {
  const [start, len] = entrance(loc, r, n);
  const t = clamp((p - start) / len);
  if (still()) {
    const on = p >= start + len / 2 ? 1 : 0;
    return { f: on, p: on };
  }
  return { f: inOut(t),
    p: out(clamp((t - REVEAL.popFrom) / REVEAL.popFor)) };
}

// Write the progress on the annotated panels of the page: on each value's
// bytes (by its rank, in its panel's score) its --tf
// (fill), on its popover --tp; on the panel, --dim (the rest stepping
// back, as its first value begins). Only what changed since the last write (`force`: all
// of a panel, its elements new): a frame of scrolling restyles a value
// or two, never the figure.
const last = new WeakMap<HTMLElement, { f: string[]; p: string[];
  dim: string }>();
const views = () => typeof document === "undefined" ? []
  : [...document.querySelectorAll<HTMLElement>(".view.annot")];
export function paintView(v: HTMLElement, force = false) {
  const loc = v.dataset.location ?? "";
  const k = Number(v.dataset.units ?? 0);
  const p = reveal.get().progress;
  const was = force ? undefined : last.get(v);
  // (--dim: as the panel's first value to enter fills)
  const now = { f: [] as string[], p: [] as string[],
    dim: Math.max(0, ...Array.from({ length: k }, (_, r) =>
      stage(loc, r, k, p).f)).toFixed(3) };
  // (the figure's disclaimer: in the host's hold after the reveal, from
  // REVEAL.afterAt; the toggle's, REVEAL.afterMs after its run)
  (v.closest<HTMLElement>(".lens") ?? v).style.setProperty("--hand",
    p >= 1 && reveal.get().after >= REVEAL.afterAt ? "1" : "0");
  if (now.dim !== was?.dim) {
    v.style.setProperty("--dim", now.dim);
    v.style.setProperty("--a-smooth", `${REVEAL.smoothMs}ms`);
    v.style.setProperty("--a-sweep", String(REVEAL.sweep));
  }
  for (let r = 0; r < k; r++) {
    const g = stage(loc, r, k, p);
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
