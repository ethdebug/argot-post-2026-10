// A moment as the engine's point (addendum §6): the state there, the
// locals its context lists (what a Variables tree decodes) and its
// source range (what the code panel marks); a trace step with no range
// of its own shows the last one before it, muted. Its input is a
// moment's data, from a run or from a MomentSource: an annotated moment
// (run/annotate.ts) and the state at it.
import type {
  PointId, Snapshot, SourceRange, TimelinePoint, TxFacts,
} from "./types";
import type { Build, Moment, MomentRef, Run } from "./run/types";
import { annotate, locals } from "./run/annotate";

// `build`: its state variables are not locals; `steps`: the
// transaction's trace step count; `last`: the last range at or before
// the moment (lastRange), shown when it has none of its own
export function momentPoint(id: PointId, m: Moment, snapshot: Snapshot,
  o: { build?: Build; steps?: number; last?: SourceRange;
    transaction?: TxFacts } = {}): TimelinePoint {
  const range = m.range ?? o.last;
  return {
    id, label: m.label ?? "", at: { tx: m.tx, step: m.step }, snapshot,
    ...(o.transaction ? { transaction: o.transaction } : {}),
    locals: m.context ? locals(m.context, o.build) : [],
    ...(m.step === "end" ? {} : { paused: { step: m.step, op: m.op ?? "",
      ...(o.steps !== undefined ? { of: o.steps } : {}),
      ...(range ? { range } : {}),
      ...(!m.range && range ? { last: true as const } : {}) } }),
  };
}

// The range at a moment, or the nearest one before it in its
// transaction (none: no trace step so far has one)
export function lastRange(run: Run, build: Build, ref: MomentRef):
  SourceRange | undefined {
  if (ref.step === "end") return undefined;
  for (let i = ref.step; i >= 0; i--) {
    const r = annotate(run, build, { tx: ref.tx, step: i }).range;
    if (r) return r;
  }
  return undefined;
}
