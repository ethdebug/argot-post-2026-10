// The hooks views use: their data, their link group's state, their own
// state, and what they light
import { createContext, useContext, useEffect, useMemo, useState,
  useSyncExternalStore } from "react";
import type { Project } from "../engine/project";
import type {
  Decoded, Decoding, Filter, Hex, Layout, Light, Snapshot, TimelinePoint,
} from "../engine/types";
import { decode } from "../engine/decode";
import { layout } from "../engine/layout";
import { forBytes, forPath, noLight } from "../engine/light";
import type { Store } from "./store";
import type {
  DataAt, DataRef, LensSpec, LensState, LinkState, ViewState, ViewSpec,
} from "./types";

export interface LensContextValue {
  spec: LensSpec; project: Project; store: Store<LensState>;
  // show a bookmark (its points, side and selection); false when its
  // data did not load (Lens.tsx)
  show(id: string, view?: { mode?: "before" | "after";
    sel?: string | null }): Promise<boolean>;
}
export const LensContext = createContext<LensContextValue | null>(null);

// A decoding by id: the lens's own first, then the project's
export function decodingOf(c: LensContextValue, id: string):
  Decoding | undefined {
  return c.spec.decodings.find((d): d is Decoding =>
    typeof d !== "string" && d.id === id) ?? c.project.decodings[id];
}

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
// point slot is the point it holds ("$side": the side shown; "$other":
// the other one of the pair)
export function resolveRef(ref: DataRef, s: LensState, p: Project):
  DataAt | undefined {
  const decoding = ref.decoding === "$bm"
    ? p.bookmarks.find((b) => b.id === s.bookmark)?.decoding
    : ref.decoding;
  const slot = typeof ref.point === "string" ? null : ref.point.slot;
  const point = slot === null ? ref.point as string
    : s.points[slot === "$side" ? (s.side === "before" ? "a" : "b")
      : slot === "$other" ? (s.side === "before" ? "b" : "a") : slot];
  return decoding && point ? { decoding, point } : undefined;
}

export function useDecoded(ref: DataRef | undefined): Decoded | undefined {
  const lens = useLens();
  const { project } = lens;
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, project);
    return at ? `${at.decoding}\n${at.point}` : "";
  });
  const [got, setGot] = useState<{ key: string; d: Decoded }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    const dc = decodingOf(lens, decoding);
    if (!dc) return console.error(`no decoding ${decoding}`);
    decode(project, dc, point).then((d) => {
      if (live) setGot({ key, d });
    }, (e) => console.error(e));
    return () => {
      live = false;
    };
  }, [lens, project, key]);
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

// A view's data and its layout (a dump's location; storage otherwise).
// `filter`: the lens's (Lens.tsx Present), else the view's own; rows
// "all" adds the slots the point's transaction read or wrote. A dump's
// `others` (decodings of its timeline) show their words, owned by none.
export function useLayout(id: string, filter?: Filter):
  { d?: Decoded; l?: Layout } {
  const v = useViewSpec(id);
  const lens = useLens();
  const data = "data" in v ? v.data : undefined;
  const d = useDecoded(data);
  const point = usePoint(data);
  const f = filter ?? ("filter" in v ? v.filter : undefined);
  const others = v.kind === "dump" ? v.others ?? [] : [];
  const timeline = d && decodingOf(lens, d.decoding)?.timeline;
  const mine = others.filter((o) =>
    decodingOf(lens, o.decoding)?.timeline === timeline);
  const o1 = useDecoded(mine[0] && d &&
    { decoding: mine[0].decoding, point: d.point });
  const location = v.kind === "dump" ? v.location : "storage";
  const l = useMemo(() => {
    if (!d || (mine[0] && !o1)) return undefined;
    const tx = point?.transaction;
    const rows = f?.rows === "all" && tx
      ? [...new Set<Hex>([...tx.reads, ...tx.writes])]
        .filter((s) => point!.snapshot.storage.has(s)) : f?.rows;
    return layout(d, location, { ...f, rows },
      o1 ? [{ d: o1, who: mine[0].who }] : []);
  }, [d, o1, point, location, f, mine[0]?.who]);
  return { d, l };
}

// What a view lights: its link's selection, or else what is pointed at
export function useLight(id: string, filter?: Filter): Light {
  const v = useViewSpec(id);
  const { d, l } = useLayout(id, filter);
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

// The timeline point a view shows (a dump's words, its transaction)
export function usePoint(ref: DataRef | undefined):
  TimelinePoint | undefined {
  const lens = useLens();
  const { project } = lens;
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, project);
    return at ? `${at.decoding}\n${at.point}` : "";
  });
  const [got, setGot] = useState<{ key: string; p: TimelinePoint }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    const dc = decodingOf(lens, decoding);
    if (!dc) return;
    project.timeline(dc.timeline).then((t) => {
      const at = t.points.find((x) => x.id === point);
      if (live && at) setGot({ key, p: at });
    }, (e) => console.error(e));
    return () => {
      live = false;
    };
  }, [lens, project, key]);
  return got?.key === key ? got.p : undefined;
}

export const useSnapshot = (ref: DataRef | undefined): Snapshot | undefined =>
  usePoint(ref)?.snapshot;
