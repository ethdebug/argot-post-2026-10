// The moment a point is, in one quiet line, part of a figure: what it is
// inside, and its step of the transaction's ("… · step 569 of 868")
import { useLens, usePoint } from "./hooks";
import type { DataRef, ViewId } from "./types";

export function Moment(p: { id: ViewId; data: DataRef }) {
  const lens = useLens();
  const at = usePoint(p.data);
  if (!at) return null;
  const step = at.paused ? ` · step ${at.paused.step} of ${at.paused.of}`
    : "";
  return <p className="moment" data-view={`${lens.key}:${p.id}`}>
    {at.label}{step}</p>;
}
