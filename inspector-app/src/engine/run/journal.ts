// Storage (or transient storage) at a trace step, from a transaction's
// journal of writes (addendum §2.3)
import type { Hex } from "../types";
import type { Frame, Journal } from "./types";

// The trace step from which each frame's writes are undone: its own
// revert, or an enclosing frame's (a frame's parent: the last frame
// entered before it, one level up, whose steps contain its first)
function undoneFrom(frames: Frame[]): number[] {
  const out: number[] = [];
  frames.forEach((f, i) => {
    let at = f.reverted ? f.last + 1 : Infinity;
    for (let p = i - 1; p >= 0; p--) {
      const g = frames[p];
      const inside = g.first <= f.first && f.first <= g.last;
      if (g.depth === f.depth - 1 && inside) {
        at = Math.min(at, out[p]);
        break;
      }
    }
    out.push(at);
  });
  return out;
}

// `before` with the journal's writes before trace step `step` applied
// (in step order), except those of frames reverted by then. (`step` =
// the trace step count: the transaction's end.)
export function storageAt(j: Journal, frames: Frame[], step: number,
  before: ReadonlyMap<Hex, Hex>): Map<Hex, Hex> {
  const undone = undoneFrom(frames);
  const out = new Map(before);
  for (const w of j) {
    if (w.step >= step) break;
    if (step < undone[w.frame]) out.set(w.slot, w.value);
  }
  return out;
}
