// Which row each of the annotated layer's popovers points at (pure; the
// DOM gives the geometry, ui/notes.ts; the popovers are the inspector's
// own, placed by its rules under or over a row). A popover may go
// under its value's run of rows, or over it, at any run of its value;
// of these, the one that hides the fewest bytes, and never a byte that
// is not zero when another place hides none; never over another popover
// nor out of `bounds`; the first such place on a tie. The same input,
// the same places.

export interface Rect { l: number; r: number; t: number; b: number }
// a byte cell: its box, its unit (null: no value's), zero or not
export interface Cell extends Rect { unit: number | null; zero: boolean }
// a popover's places (`units`: what it is about), in the order tried
export interface Ask { units: number[]; places: Rect[] }

const over = (a: Rect, b: Rect) => a.l < b.r - 0.5 && b.l < a.r - 0.5 &&
  a.t < b.b - 0.5 && b.t < a.b - 0.5;
const within = (a: Rect, b: Rect) => a.l >= b.l - 0.5 &&
  a.r <= b.r + 0.5 && a.t >= b.t - 0.5 && a.b <= b.b + 0.5;

// The place each popover takes (an index into its places), or -1: none
// fits (every place over another popover, or out of bounds)
export function choose(asks: Ask[], cells: Cell[], bounds?: Rect):
  number[] {
  const taken: Rect[] = [];
  return asks.map((a) => {
    let best = -1;
    let cost = Infinity;
    a.places.forEach((p, k) => {
      if (bounds && !within(p, bounds)) return;
      if (taken.some((t) => over(p, t))) return;
      // (a byte that is not zero hides a value: the worst; a zero, a
      // little; the popover's own row it points from, not at all)
      const c = cells.filter((x) => over(p, x)).reduce((n, x) =>
        n + (x.zero ? 1 : 1000), 0);
      if (c < cost) {
        cost = c;
        best = k;
      }
    });
    if (best >= 0) taken.push(a.places[best]);
    return best;
  });
}
