// A picker (vanilla #picker): the lens's scenes; radio buttons, the one
// shown aria-checked. Or the rows shown: All | Related (the related
// view, LensState.related), and how many rows around each related one.
import { useContext } from "react";
import { OtherScenes, useLens, useLensState, useLink } from "./hooks";
import type { ViewId } from "./types";

export function Picker(p: { id: ViewId;
  of: "bookmarks" | "points" | "level" | "related";
  domId?: string; link?: string }) {
  const lens = useLens();
  const { spec, project, store } = lens;
  const other = useContext(OtherScenes);
  if (p.of === "related") return <Related {...p} />;
  const current = useLensState((s) => s.scene);
  const moment = useLensState((s) => s.moment);
  const sel = useLensState((s) => s.links[spec.links[0]]?.selection ??
    null);
  // (the memory section's: scenes "O<level>/<pause>"; a level keeps the
  // pause, its moment and the selection; a pause takes its defaults)
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
          void lens.show(id, p.of === "level" ? { moment, sel } : {});
        }}>{title(k)}</button>)}
    </div>;
  }
  if (p.of === "bookmarks") {
    const bms = (spec.bookmarks ?? []).map((id) =>
      project.bookmarks.find((b) => b.id === id)!).filter(Boolean);
    // (on a page with scenes of other lenses: the page's scenes, in its
    // order; another lens's scene shows in place of this one)
    const order = other ? project.page.filter((s) => s.lens !== "inspector"
      || bms.some((b) => b.id === s.id)) : bms.map((b) => ({ id: b.id,
      title: b.title, lens: "inspector" }));
    const shown = other?.scene ?? current;
    return <div id={p.domId} className="picker" role="radiogroup"
      aria-label="Scene" data-view={`${lens.key}:${p.id}`}>
      {order.map((s) => {
        const b = bms.find((x) => x.id === s.id);
        return <button key={s.id} role="radio" data-id={s.id}
          data-snapshot={b?.id}
          data-lens={b ? undefined : s.lens}
          data-single={b && b.points.length === 1 ? "" : undefined}
          aria-checked={s.id === shown ? "true" : "false"}
          onClick={() => {
            if (!b) return other?.go(s.id);
            other?.go(null);
            void lens.show(b.id);
          }}>{s.title}</button>;
      })}
    </div>;
  }
  return null;
}

// All | Related, and "± 1 row" (a related row's neighbours too). Every
// part keeps its place: the context box is there, muted, with All; the
// hint is there, hidden, while something is selected.
function Related(p: { id: ViewId; domId?: string; link?: string }) {
  const lens = useLens();
  const { store } = lens;
  const related = useLensState((s) => s.related);
  const [link] = useLink(p.link);
  const set = (r: { context: number } | undefined) => store.set((s) =>
    s.related?.context === r?.context ? s : { ...s, related: r });
  const on = related !== undefined;
  return <div id={p.domId} className="moderow relrow"
    data-view={`${lens.key}:${p.id}`}>
    <span className="modelabel" id={`${p.domId ?? p.id}-l`}>Rows</span>
    <div className="picker mode" role="radiogroup"
      aria-labelledby={`${p.domId ?? p.id}-l`}>
      {([["all", "All"], ["related", "Related"]] as const).map(([k, t]) =>
        <button key={k} role="radio" data-rows={k}
          aria-checked={(k === "related") === on ? "true" : "false"}
          onClick={() => set(k === "all" ? undefined
            : { context: related?.context ?? 0 })}>{t}</button>)}
    </div>
    <label className={`chipcheck${on ? "" : " off"}`}>
      <input type="checkbox" data-context checked={!!related?.context}
        disabled={!on}
        onChange={(e) => set({ context: e.target.checked ? 1 : 0 })} />
      ± 1 row</label>
    <span className="muted small relhint" aria-live="polite"
      style={{ visibility: on && !link.selection ? "visible" : "hidden" }}>
      select a value</span>
  </div>;
}
