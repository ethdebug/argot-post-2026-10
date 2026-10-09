// The debugger's moves over a run's moments (addendum §3.1): a trace
// step on or back; the next or previous change of source range (the
// debugger demo's "changes"); a transaction's first trace step or its
// end; another transaction. No step into, over or out (§9 Q2).
import type { MomentSource } from "./source";

export type Move = "next" | "prev" | "next-range" | "prev-range"
  | "tx-first" | "tx-last" | { tx: number };

const key = (r?: { source: string; offset: number; length: number }) =>
  r ? `${r.source}:${r.offset}:${r.length}` : "";

// The moment a move goes to from moment `i` (itself where it cannot go)
export function move(src: MomentSource, i: number, how: Move): number {
  const ms = src.moments;
  const tx = ms[i].tx;
  const first = (t: number) => ms.findIndex((m) => m.tx === t);
  const last = (t: number) => {
    const k = first(t + 1);
    return k < 0 ? ms.length - 1 : k - 1;
  };
  if (how === "next") return Math.min(ms.length - 1, i + 1);
  if (how === "prev") return Math.max(0, i - 1);
  if (how === "tx-first") return first(tx);
  if (how === "tx-last") return last(tx);
  if (typeof how === "object") {
    const k = first(how.tx);
    return k < 0 ? i : k;
  }
  // (a range change: the next trace step in the transaction with a range
  // of its own other than the one that holds here)
  const here = key(src.last(i));
  const d = how === "next-range" ? 1 : -1;
  for (let j = i + d; j >= first(tx) && j <= last(tx); j += d) {
    const r = src.moment(j).range;
    if (r && key(r) !== here) {
      if (d > 0) return j;
      // (back: to where that range began)
      let k = j;
      while (k - 1 >= first(tx) && key(src.last(k - 1)) === key(r)) k--;
      return k;
    }
  }
  return i;
}
