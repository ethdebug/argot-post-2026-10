// A picker (vanilla #picker, #mode): the lens's bookmarks (scenes), or
// the side of a pair shown (Before | After). Radio buttons; the one
// shown is aria-checked.
import { useLens, useLensState } from "./hooks";
import type { ViewId } from "./types";

export function Picker(p: { id: ViewId;
  of: "bookmarks" | "points" | "side" | "level"; domId?: string }) {
  const lens = useLens();
  const { spec, project, store } = lens;
  const current = useLensState((s) => s.bookmark);
  const side = useLensState((s) => s.side ?? "after");
  if (p.of === "bookmarks") {
    const bms = (spec.bookmarks ?? []).map((id) =>
      project.bookmarks.find((b) => b.id === id)!).filter(Boolean);
    return <div id={p.domId} className="picker" role="radiogroup"
      aria-label="Scene" data-view={`${lens.key}:${p.id}`}>
      {bms.map((b) => <button key={b.id} role="radio" data-id={b.id}
        data-fixture={b.timeline}
        data-single={b.points.length === 1 ? "" : undefined}
        aria-checked={b.id === current ? "true" : "false"}
        onClick={() => void lens.show(b.id)}>{b.title}</button>)}
    </div>;
  }
  if (p.of === "side") {
    return <div id={p.domId} className="picker mode" role="radiogroup"
      aria-labelledby="mode-l" aria-label="Show"
      data-view={`${lens.key}:${p.id}`}>
      {(["before", "after"] as const).map((m) => <button key={m}
        role="radio" data-mode={m}
        aria-checked={m === side ? "true" : "false"}
        onClick={() => store.set((s) => s.side === m ? s
          : { ...s, side: m })}>
        {m === "before" ? "Before" : "After"}</button>)}
    </div>;
  }
  return null;
}
