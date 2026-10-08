// A picker (vanilla #picker, #mode): the lens's bookmarks (scenes), or
// the side of a pair shown (Before | After). Radio buttons; the one
// shown is aria-checked.
import { useLens, useLensState } from "./hooks";
import type { ViewId } from "./types";

export function Picker(p: { id: ViewId;
  of: "bookmarks" | "points" | "side" | "level"; domId?: string;
  row?: string; link?: string }) {
  const lens = useLens();
  const { spec, project, store } = lens;
  const current = useLensState((s) => s.bookmark);
  const side = useLensState((s) => s.side ?? "after");
  const single = useLensState((s) => s.points.a === s.points.b);
  const sel = useLensState((s) => s.links[spec.links[0]]?.selection ??
    null);
  // (the memory section's: bookmarks "O<level>/<pause>"; a level keeps
  // the pause, the side and the selection; a pause takes its defaults
  // and keeps the side: vanilla mem.js)
  if (p.of === "level" || p.of === "points") {
    const ids = spec.bookmarks ?? [];
    const [o, pt] = (current ?? "").split("/");
    const keys = [...new Set(ids.map((i) => i.split("/")[p.of === "level"
      ? 0 : 1]))];
    const title = (k: string) => p.of === "level" ? k
      : project.bookmarks.find((b) => b.id === `${o}/${k}`)?.title ?? k;
    return <div id={p.domId} className="picker mpick" role="radiogroup"
      aria-label={p.of === "level" ? "Optimization level" : "Pause point"}
      data-view={`${lens.key}:${p.id}`}>
      {keys.map((k) => <button key={k} role="radio"
        {...(p.of === "level" ? { "data-opt": k.slice(1) }
          : { "data-id": k })}
        aria-checked={(p.of === "level" ? o : pt) === k ? "true" : "false"}
        onClick={() => {
          if ((p.of === "level" ? o : pt) === k) return;
          const id = p.of === "level" ? `${k}/${pt}` : `${o}/${k}`;
          void lens.show(id, p.of === "level" ? { mode: side, sel }
            : { mode: side });
        }}>{title(k)}</button>)}
    </div>;
  }
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
    const picker = <div id={p.domId} className="picker mode"
      role="radiogroup" aria-labelledby={`${p.domId ?? "mode"}-l`}
      aria-label="Show" data-view={`${lens.key}:${p.id}`}>
      {(["before", "after"] as const).map((m) => <button key={m}
        role="radio" data-mode={m}
        aria-checked={m === side ? "true" : "false"}
        onClick={() => store.set((s) => s.side === m ? s
          : { ...s, side: m })}>
        {m === "before" ? "Before" : "After"}</button>)}
    </div>;
    return p.row ? <div className="moderow" id={p.row} hidden={single}>
      <span className="modelabel" id={`${p.domId}-l`}>Show</span>{picker}
    </div> : picker;
  }
  return null;
}
