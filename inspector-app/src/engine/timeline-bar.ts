// The timeline bar's geometry and words (addendum §5.1), pure: the
// run's transactions as equal segments (their trace step counts differ
// by 2x), a moment's place in them, labels cut, the line under the
// track
import type { Moment, MomentRef } from "./run/types";

// each transaction's segment of the track, 0..1, equal widths
export function segments(txs: { label: string; steps: number }[]):
  { x0: number; x1: number; label: string }[] {
  const n = txs.length;
  return txs.map((t, k) => ({ x0: k / n, x1: (k + 1) / n, label: t.label }));
}

// a moment's place on the track, 0..1: in its transaction's segment, by
// its trace step; "end", the segment's end
export function placeOf(ref: MomentRef, steps: number[]): number {
  const n = steps.length;
  const s = Math.max(1, steps[ref.tx] ?? 1);
  const f = ref.step === "end" ? 1 : Math.min(1, ref.step / s);
  return (ref.tx + f) / n;
}

// the index of the place nearest `x` (-1: none)
export function nearest(places: number[], x: number): number {
  let best = -1;
  places.forEach((p, k) => {
    if (best < 0 || Math.abs(p - x) < Math.abs(places[best] - x)) best = k;
  });
  return best;
}

// a label at most `max` characters: a call's string argument cut at its
// end, after a whole word if one fits (join("carol, …")), other text in
// its middle
export function cutMiddle(label: string, max: number): string {
  if (label.length <= max) return label;
  const call = label.match(/^(.*?\(")(.*)("\))$/);
  const keep = call ? max - call[1].length - call[3].length - 2 : 0;
  if (call && keep > 0) {
    const words = call[2].slice(0, keep + 1).split(" ").slice(0, -1)
      .join(" ");
    return `${call[1]}${words || call[2].slice(0, keep)} …${call[3]}`;
  }
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${label.slice(0, head)}…${label.slice(label.length - tail)}`;
}

const CUT = 16;
// the line under the track: the moment's label, or where it is
export function lineOf(m: Moment, tx: string): string {
  if (m.label) return m.label;
  const t = cutMiddle(tx, CUT);
  return m.step === "end" ? `${t} · after the transaction`
    : `${t} · trace step ${m.step}${m.op ? ` · ${m.op}` : ""}`;
}
