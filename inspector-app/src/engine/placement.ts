// Where the annotated figure's popovers go (and the room each keeps
// under its value: roomUnder) (pure; the DOM gives the
// geometry, ui/notes.ts). Free placement, for this figure only: a
// popover (the inspector's card and arrow) may point at the centre of
// any run of its value's bytes, from above or below, and slide along
// its arrow's row; of all these places it takes the one that hides
// the least (another value's digits the worst, its own digits less,
// another value's zeros some, its own zeros and unlit bytes little), keeps its arrow nearest the card's
// middle, is under its run rather than over it, at its first run
// rather than a later one, and never touches another popover or leaves `bounds`. Its
// shapes (several lines, or one) are tried alike, the first cheaper.
// Narrow (a phone): each under a run of its value (its first, if it
// can), one line, stacking. The same input, the same places.

export interface Rect { l: number; r: number; t: number; b: number }
// a byte cell: its box, its unit (null: no value's), zero or not
export interface Cell extends Rect { unit: number | null; zero: boolean }
// where an arrow may point: a run's centre (x), its top and bottom (and
// its right edge, `r`, for a card beside it)
export interface Target { x: number; t: number; b: number; r?: number }
// (a shape's `cost`: what it lost to fit, its names cut)
// (`side` "right": a card beside its target, its arrow pointing left at
// the target's middle: a stack item's)
export interface Ask { units: number[]; side?: "right";
  shapes: { w: number; h: number; cost?: number }[];
  targets: Target[] }
export interface Spot { shape: number; target: number;
  way: "over" | "under" | "right"; box: Rect; ax: number }

// (the arrow's reach between a card and its row)
export const REACH = 8;
const over = (a: Rect, b: Rect) => a.l < b.r - 0.5 && b.l < a.r - 0.5 &&
  a.t < b.b - 0.5 && b.t < a.b - 0.5;
const within = (a: Rect, b: Rect) => a.l >= b.l - 0.5 &&
  a.r <= b.r + 0.5 && a.t >= b.t - 0.5 && a.b <= b.b + 0.5;

// (`reach`: the arrow's, between a card and its row; default REACH)
// (`forbid`: what a card never covers: the rows' address labels)
export function place(asks: Ask[], cells: Cell[], bounds: Rect,
  o: { narrow?: boolean; reach?: number; forbid?: Rect[] } = {}):
  (Spot | null)[] {
  const reach = o.reach ?? REACH;
  // (a cell hidden: covered more than a sliver of it)
  const hides = (a: Rect, x: Rect) => Math.min(a.r, x.r) -
    Math.max(a.l, x.l) > 3 && Math.min(a.b, x.b) - Math.max(a.t, x.t) > 3;
  const taken: Rect[] = [];
  return asks.map(one);
  // (narrow: in bounds if it can be; else anywhere it does not touch
  // another card)
  function one(a: Ask): Spot | null {
    return best(a, true) ?? (o.narrow ? best(a, false) : null);
  }
  function best(a: Ask, strict: boolean): Spot | null {
    let best: Spot | null = null;
    let cost = Infinity;
    const shapes = o.narrow ? [a.shapes.length - 1] : a.shapes.map((_, i) => i);
    const targets = a.targets.map((_, i) => i);
    for (const s of shapes) {
      const { w, h } = a.shapes[s];
      for (const t of targets) {
        const g = a.targets[t];
        if (!g) continue;
        if (a.side === "right") {
          const mid = (g.t + g.b) / 2;
          const box = { l: (g.r ?? g.x) + reach, r: (g.r ?? g.x) + reach + w,
            t: mid - h / 2, b: mid + h / 2 };
          if (strict && !within(box, bounds)) continue;
          if (taken.some((x) => over(box, x))) continue;
          if (cells.some((x) => x.unit !== null && hides(box, x)) ||
            o.forbid?.some((x) => hides(box, x))) continue;
          const c = s * 15 + t * 10;
          if (c < cost) {
            cost = c;
            best = { shape: s, target: t, way: "right", box, ax: h / 2 };
          }
          continue;
        }
        for (const way of o.narrow ? ["under" as const]
          : ["over" as const, "under" as const]) {
          const top = way === "over" ? g.t - reach - h : g.b + reach;
          // (centred on its arrow; or slid along it, the arrow anywhere
          // but its ends)
          const lefts = [g.x - w / 2,
            ...Array.from({ length: Math.max(0, Math.floor((w - 48) / 24))
              + 1 }, (_, k) => g.x - 24 - 24 * k)];
          for (const l0 of lefts) {
            const l = Math.max(bounds.l, Math.min(l0, bounds.r - w));
            const box = { l, r: l + w, t: top, b: top + h };
            if (strict && !within(box, bounds)) continue;
            if (taken.some((x) => over(box, x))) continue;
            // (never over a value's bytes, its own or another's, nor an
            // address: what it explains stays in view)
            if (cells.some((x) => x.unit !== null && hides(box, x)) ||
              o.forbid?.some((x) => hides(box, x))) continue;
            const ax = g.x - l;
            if (ax < 10 || ax > w - 10) continue;
            // (under its run, as the inspector's popovers are, is read
            // first as its run's: over costs a little; a later run too)
            let c = s * 15 + (a.shapes[s].cost ?? 0) +
              Math.abs(ax - w / 2) * 0.05 +
              (way === "over" ? 25 : 0) + t * 10;
            // (unlit bytes: zeros a little, others much)
            for (const x of cells) {
              if (hides(box, x)) c += x.zero ? 1 : 1000;
            }
            if (c < cost - 1e-9) {
              cost = c;
              best = { shape: s, target: t, way, box, ax };
            }
          }
        }
      }
    }
    if (best) taken.push(best.box);
    return best;
  }
}

// The room a card needs under a run (its last line's bottom at `b`):
// the space down to the next line with a value's bytes in it (or none:
// `lines` holds the lines after the run, top to bottom, each lit or
// not), less what the card and its arrow take; what is missing, to
// keep under the run (0: it fits)
export function roomUnder(b: number, h: number,
  lines: { t: number; b: number; lit: boolean }[], reach = REACH): number {
  const next = lines.find((x) => x.lit && x.t >= b - 0.5);
  const free = next ? next.t - b : lines.length ? Math.max(b,
    ...lines.map((x) => x.b)) - b : 0;
  return Math.max(0, Math.ceil(reach + h + 2 - free));
}
