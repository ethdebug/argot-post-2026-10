// A lens: one store per mount, its views laid out in its grid's areas
// (or in its frame, or, on the parity page, in the page's elements)
import { useState, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Project } from "../engine/project";
import { createStore } from "./store";
import { LensContext } from "./hooks";
import { viewKinds } from "./views";
import type { LensSpec, LensState, ViewKind } from "./types";

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

export function Lens(props: { spec: LensSpec; project: Project;
  hash?: boolean; kinds?: Kinds; mount?: Record<string, Element> }) {
  const { spec, project, mount } = props;
  const [store] = useState(() => createStore(initialState(spec, project)));
  const kinds: Kinds = { ...viewKinds, ...props.kinds };
  const areas: Record<string, ReactNode[]> = {};
  for (const v of spec.views) {
    const View = kinds[v.kind];
    if (!View) continue;
    (areas[v.area] ??= []).push(<View key={v.id} {...v} />);
  }
  const wrapped = Object.fromEntries(Object.entries(areas).map(([a, ns]) => {
    const Wrap = spec.wrap?.[a];
    return [a, Wrap ? <Wrap key={a}>{ns}</Wrap> : ns];
  }));
  const Frame = spec.frame;
  const body = mount
    ? Object.entries(wrapped).map(([a, n]) => mount[a]
      ? createPortal(n, mount[a], a) : null)
    : Frame ? <Frame areas={wrapped} />
      : <div className="lens" style={{ display: "grid",
        gridTemplateAreas: spec.grid }}>
        {Object.entries(wrapped).map(([a, n]) =>
          <div key={a} style={{ gridArea: a }}>{n}</div>)}
      </div>;
  return <LensContext.Provider value={{ spec, project, store }}>
    {body}
  </LensContext.Provider>;
}
