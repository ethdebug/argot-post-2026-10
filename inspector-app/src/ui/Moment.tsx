// The moment a point is, in one quiet line, part of a figure, in plain
// words for a cold reader: the lens's `text`, or the point's label
import { useLens, usePoint } from "./hooks";
import type { DataRef, ViewId } from "./types";

export function Moment(p: { id: ViewId; data: DataRef; text?: string;
  badge?: boolean }) {
  const lens = useLens();
  const at = usePoint(p.data);
  if (!at) return null;
  // (`badge`: the hand-written compilation's badge, as a tree's heading
  // has it)
  if (p.badge) {
    return <p className="moment-note" data-view={`${lens.key}:${p.id}`}>
      <span className="handmade">{p.text ?? at.label}</span></p>;
  }
  return <p className="moment" data-view={`${lens.key}:${p.id}`}>
    {p.text ?? at.label}</p>;
}
