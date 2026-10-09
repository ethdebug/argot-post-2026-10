// The reveal's toggle, for a figure that stands alone (not in a host
// page's frame, whose scroll reveals it): "Raw | Annotated"
import { setRevealed, useRevealed } from "./reveal";
import { useLens } from "./hooks";
import type { ViewId } from "./types";

const alone = () => typeof window !== "undefined" && window.parent === window;

export function Reveal(p: { id: ViewId }) {
  const lens = useLens();
  const on = useRevealed();
  if (!alone()) return null;
  return <div className="reveal picker" role="radiogroup"
    aria-label="Show" data-view={`${lens.key}:${p.id}`}>
    {([false, true] as const).map((x) => <button key={String(x)}
      type="button" role="radio" aria-checked={on === x}
      onClick={() => setRevealed(x)}>{x ? "Annotated" : "Raw"}</button>)}
  </div>;
}
