// A lens: one store per mount, its views laid out in its grid's areas
// (or, on the parity page, in the page's elements). The lens decides
// what each view shows: its data, and for Phase 1's pair of dumps,
// which side is shown and what it is called.
import {
  useEffect, useMemo, useState, type ComponentType, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Project } from "../engine/project";
import { decode } from "../engine/decode";
import { createStore, type Store } from "./store";
import {
  decodingOf, LensContext, useLensState, type LensContextValue,
} from "./hooks";
import { viewKinds } from "./views";
import type {
  DataRef, LensSpec, LensState, ViewKind, ViewSpec,
} from "./types";

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

// Show a bookmark: its points, the side it opens with (or `view.mode`),
// and its selection (or `view.sel`; one the tree does not have is none),
// in every link group. Waits for its data; a later call wins.
function shower(store: Store<LensState>, spec: LensSpec, project: Project) {
  let wanted = 0;
  const show: LensContextValue["show"] = async (id, view) => {
    const ticket = ++wanted;
    const bm = project.bookmarks.find((b) => b.id === id);
    if (!bm) return false;
    const single = bm.points.length === 1;
    const side = single ? "after" : view?.mode ?? bm.side ?? "after";
    const point = bm.points[side === "before" ? 0 : bm.points.length - 1];
    const dc = decodingOf({ spec, project } as LensContextValue,
      bm.decoding);
    let tree;
    try {
      tree = await decode(project, dc!, point);
      await Promise.all(bm.points.map((p) => decode(project, dc!, p)));
    } catch (e) {
      console.error(e);
      return false;
    }
    if (ticket !== wanted) return true; // another was asked for since
    const want = view && "sel" in view ? view.sel : bm.select;
    const selection = want && tree.byPath.has(want) ? want : null;
    store.set((s) => ({ ...s, bookmark: id,
      points: { a: bm.points[0], b: bm.points[1] ?? bm.points[0] }, side,
      links: Object.fromEntries(spec.links.map((l) => [l,
        { selection, hover: null, walk: null }])) }));
    return true;
  };
  return show;
}

// A view, with what the lens decides for it: a dump that is one side of
// the pair is shown when the lens shows that side, and is titled Before
// or After (Storage at one point); any other dump is shown, titled
// (the pair's views also compare with the other side: a dump's changed
// bytes and its slots' facts, a tree's changed values; two points show
// the slots the transaction read or wrote too)
function Present({ v, View }: { v: ViewSpec; View: ComponentType<any> }) {
  const shown = useLensState((s) => s.side ?? "after");
  const single = useLensState((s) => s.points.a === s.points.b);
  const other: DataRef | undefined = !single && "data" in v &&
    typeof v.data.point !== "string"
    ? { ...v.data, point: { slot: v.data.point.slot === "a" ? "b"
      : v.data.point.slot === "b" ? "a" : "$other" } } : undefined;
  if (v.kind === "tree") return <View {...v} compare={other} />;
  if (v.kind !== "dump") return <View {...v} />;
  const side = v.side;
  const title = !side ? v.title ?? "Storage" : single ? "Storage"
    : side === "before" ? "Before" : "After";
  return <View {...v} hidden={!!side && shown !== side} title={title}
    when={side ? WHEN[side] : undefined}
    compare={side ? other : undefined}
    filter={side && !single ? { ...v.filter, rows: "all" } : v.filter} />;
}

export function Lens(props: { spec: LensSpec; project: Project;
  hash?: boolean; kinds?: Kinds; mount?: Record<string, Element>;
  // the page's handle on the lens (the parity page's window.select)
  onReady?: (lens: LensContextValue) => void }) {
  const { spec, project, mount, onReady } = props;
  const [store] = useState(() => createStore(initialState(spec, project)));
  const value = useMemo(() => ({ spec, project, store,
    show: shower(store, spec, project) }), [spec, project, store]);
  // the first bookmark, with its defaults (unless the page shows one)
  useEffect(() => {
    if (onReady) onReady(value);
    else {
      const id = value.store.get().bookmark;
      if (id) void value.show(id);
    }
  }, [value, onReady]);
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
