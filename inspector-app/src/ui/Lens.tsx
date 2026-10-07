// A lens: one store per mount, its views laid out in its grid's areas
// (or, on the parity page, in the page's elements). The lens decides
// what each view shows: its data, and for Phase 1's pair of dumps,
// which side is shown and what it is called.
import { useMemo, useState, type ComponentType, type ReactNode } from
  "react";
import { createPortal } from "react-dom";
import type { Project } from "../engine/project";
import { createStore } from "./store";
import { LensContext, useLensState } from "./hooks";
import { viewKinds } from "./views";
import type { LensSpec, LensState, ViewKind, ViewSpec } from "./types";

type Kinds = Partial<Record<ViewKind, ComponentType<any>>>;

export function initialState(spec: LensSpec, project: Project): LensState {
  const id = spec.initial?.bookmark ?? spec.bookmarks?.[0];
  const bm = project.bookmarks.find((b) => b.id === id);
  return {
    bookmark: bm?.id,
    points: bm ? { a: bm.points[0], b: bm.points[1] ?? bm.points[0] } : {},
    side: bm?.side ?? "after",
    insets: true,
    links: Object.fromEntries(spec.links.map((l) =>
      [l, { selection: null, hover: null, walk: null }])),
    views: {},
    ...spec.initial,
  };
}

const WHEN = { before: "before the transaction",
  after: "after the transaction" };

// A view, with what the lens decides for it: a dump that is one side of
// the pair is shown when the lens shows that side, and is titled Before
// or After (Storage at one point); any other dump is shown, titled
function Present({ v, View }: { v: ViewSpec; View: ComponentType<any> }) {
  const shown = useLensState((s) => s.side ?? "after");
  const single = useLensState((s) => s.points.a === s.points.b);
  if (v.kind !== "dump") return <View {...v} />;
  const side = v.side;
  const title = !side ? v.title ?? "Storage" : single ? "Storage"
    : side === "before" ? "Before" : "After";
  return <View {...v} hidden={!!side && shown !== side} title={title}
    when={side ? WHEN[side] : undefined} />;
}

export function Lens(props: { spec: LensSpec; project: Project;
  hash?: boolean; kinds?: Kinds; mount?: Record<string, Element> }) {
  const { spec, project, mount } = props;
  const [store] = useState(() => createStore(initialState(spec, project)));
  const value = useMemo(() => ({ spec, project, store }),
    [spec, project, store]);
  const kinds: Kinds = { ...viewKinds, ...props.kinds };
  const areas: Record<string, ReactNode[]> = {};
  for (const v of spec.views) {
    const View = kinds[v.kind];
    if (!View) continue;
    (areas[v.area] ??= []).push(<Present key={v.id} v={v} View={View} />);
  }
  const wrapped = Object.fromEntries(Object.entries(areas).map(([a, ns]) => {
    const Wrap = spec.wrap?.[a];
    return [a, Wrap ? <Wrap key={a}>{ns}</Wrap> : ns];
  }));
  const body = mount
    ? Object.entries(wrapped).map(([a, n]) => mount[a]
      ? createPortal(n, mount[a], a) : null)
    : <div className="lens" style={{ display: "grid",
      gridTemplateAreas: spec.grid }}>
      {Object.entries(wrapped).map(([a, n]) =>
        <div key={a} className={spec.areas?.[a]} data-area={a}
          style={{ gridArea: a }}>{n}</div>)}
    </div>;
  return <LensContext.Provider value={value}>{body}</LensContext.Provider>;
}
