// The hooks views use: their data, their link group's state, their own
// state, and what they light
import { createContext, useContext, useEffect, useMemo, useState,
  useSyncExternalStore } from "react";
import type { Project } from "../engine/project";
import type { Decoded, Layout, Light, Snapshot } from "../engine/types";
import { decode } from "../engine/decode";
import { layout } from "../engine/layout";
import { forBytes, forPath, noLight } from "../engine/light";
import type { Store } from "./store";
import type {
  DataAt, DataRef, LensSpec, LensState, LinkState, ViewState, ViewSpec,
} from "./types";

export interface LensContextValue {
  spec: LensSpec; project: Project; store: Store<LensState>;
}
export const LensContext = createContext<LensContextValue | null>(null);

export function useLens(): LensContextValue {
  const c = useContext(LensContext);
  if (!c) throw new Error("a view is used outside a Lens");
  return c;
}

export function useLensState<T>(pick: (s: LensState) => T): T {
  const { store } = useLens();
  return useSyncExternalStore(store.subscribe, () => pick(store.get()));
}

export const NO_LINK: LinkState = { selection: null, hover: null,
  walk: null };
export const NO_VIEW: ViewState = { collapsed: new Set() };

// A DataRef in this lens's state: "$bm" is the bookmark's decoding; a
// point slot is the point it holds ("$side": the side shown)
export function resolveRef(ref: DataRef, s: LensState, p: Project):
  DataAt | undefined {
  const decoding = ref.decoding === "$bm"
    ? p.bookmarks.find((b) => b.id === s.bookmark)?.decoding
    : ref.decoding;
  const slot = typeof ref.point === "string" ? null : ref.point.slot;
  const point = slot === null ? ref.point as string
    : s.points[slot === "$side" ? (s.side === "before" ? "a" : "b") : slot];
  return decoding && point ? { decoding, point } : undefined;
}

export function useDecoded(ref: DataRef | undefined): Decoded | undefined {
  const { project } = useLens();
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, project);
    return at ? `${at.decoding}\n${at.point}` : "";
  });
  const [got, setGot] = useState<{ key: string; d: Decoded }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    decode(project, project.decodings[decoding], point).then((d) => {
      if (live) setGot({ key, d });
    }, (e) => console.error(e));
    return () => {
      live = false;
    };
  }, [project, key]);
  return got?.key === key ? got.d : undefined;
}

export function useLink(id: string | undefined): [LinkState,
  (f: (s: LinkState) => LinkState) => void] {
  const { store } = useLens();
  const s = useLensState((x) => (id && x.links[id]) || NO_LINK);
  const set = useMemo(() => (f: (s: LinkState) => LinkState) => {
    if (!id) return;
    store.set((x) => {
      const now = x.links[id] ?? NO_LINK;
      const next = f(now);
      return next === now ? x : { ...x, links: { ...x.links, [id]: next } };
    });
  }, [store, id]);
  return [s, set];
}

export function useView(id: string): [ViewState,
  (f: (s: ViewState) => ViewState) => void] {
  const { store } = useLens();
  const s = useLensState((x) => x.views[id] ?? NO_VIEW);
  const set = useMemo(() => (f: (s: ViewState) => ViewState) =>
    store.set((x) => {
      const now = x.views[id] ?? NO_VIEW;
      const next = f(now);
      return next === now ? x : { ...x, views: { ...x.views, [id]: next } };
    }), [store, id]);
  return [s, set];
}

export function useViewSpec(id: string): ViewSpec {
  const v = useLens().spec.views.find((x) => x.id === id);
  if (!v) throw new Error(`no view ${id}`);
  return v;
}

// A view's data and its layout (a dump's location; storage otherwise)
export function useLayout(id: string): { d?: Decoded; l?: Layout } {
  const v = useViewSpec(id);
  const d = useDecoded(v.data);
  const location = v.kind === "dump" ? v.location : "storage";
  const l = useMemo(() => d && layout(d, location, v.filter),
    [d, location, v.filter]);
  return { d, l };
}

// What a view lights: its link's selection, or else what is pointed at
export function useLight(id: string): Light {
  const v = useViewSpec(id);
  const { d, l } = useLayout(id);
  const [link] = useLink(v.link);
  const [view] = useView(id);
  return useMemo(() => {
    if (!d || !l) return noLight;
    const o = { collapsed: view.collapsed };
    const { selection: sel, hover } = link;
    if (sel) return { ...forPath(d, l, sel, o), cap: new Set([sel]) };
    if (hover?.path) return forPath(d, l, hover.path, o);
    if (hover?.bytes) return forBytes(d, l, hover.bytes);
    return noLight;
  }, [d, l, link, view.collapsed]);
}

// The snapshot at a view's timeline point (a dump's words)
export function useSnapshot(ref: DataRef | undefined): Snapshot | undefined {
  const { project } = useLens();
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, project);
    return at ? `${at.decoding}\n${at.point}` : "";
  });
  const [got, setGot] = useState<{ key: string; s: Snapshot }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    project.timeline(project.decodings[decoding].timeline).then((t) => {
      const at = t.points.find((x) => x.id === point);
      if (live && at) setGot({ key, s: at.snapshot });
    }, (e) => console.error(e));
    return () => {
      live = false;
    };
  }, [project, key]);
  return got?.key === key ? got.s : undefined;
}
