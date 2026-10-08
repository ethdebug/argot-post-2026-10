// The hooks views use: their data, their link group's state, their own
// state, and what they light
import { createContext, useContext, useEffect, useMemo, useState,
  useSyncExternalStore } from "react";
import type { Project } from "../engine/project";
import type {
  Compilation, Decoded, Decoding, Filter, Hex, Layout, Light, Snapshot,
  TimelinePoint,
} from "../engine/types";
import { decode } from "../engine/decode";
import { layout } from "../engine/layout";
import {
  forBytes, forPath, forRow, forStep, noLight,
} from "../engine/light";
import { walkthrough, type Walkthrough } from "../engine/walkthrough/fold";
import { locked } from "../engine/target";
import { byteKey } from "../engine/hex";
import { regionBytes } from "../engine/layout";
import type { Store } from "./store";
import type {
  DataAt, DataRef, LensSpec, LensState, LinkState, ViewState, ViewSpec,
} from "./types";

export interface LensContextValue {
  spec: LensSpec; project: Project; store: Store<LensState>;
  // this mount's key: its views carry data-view="<key>:<view id>"
  key: string;
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
// "touched" adds the slots the point's transaction read or wrote. A dump's
// `others` (decodings of its timeline) show their words, owned by none.
// (`at`: another point or decoding than the view's own: what it
// compares with)
export function useLayout(id: string, filter?: Filter, at?: DataRef,
  compare?: DataRef): { d?: Decoded; l?: Layout } {
  const v = useViewSpec(id);
  const lens = useLens();
  const data = at ?? ("data" in v ? v.data : undefined);
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
  const cmp = useDecoded(compare);
  const l = useMemo(() => {
    if (!d || (mine[0] && !o1)) return undefined;
    return layout(d, location, f, { point, ...(cmp ? { compare: cmp } : {}),
      others: o1 ? [{ d: o1, who: mine[0].who }] : [] });
  }, [d, o1, point, location, f, mine[0]?.who, cmp]);
  return { d, l };
}

// The groups collapsed in a link group's trees (a collapse recolours
// what every linked view lights: vanilla legend)
export function useCollapsed(link: string | undefined): ReadonlySet<string> {
  const { spec } = useLens();
  const trees = spec.views.filter((v) => v.kind === "tree" &&
    v.link === link).map((v) => v.id);
  const key = useLensState((s) => trees.map((t) =>
    [...(s.views[t]?.collapsed ?? [])].join("\n")).join("\t"));
  return useMemo(() => new Set(key.split(/[\t\n]/).filter(Boolean)),
    [key]);
}

// The walkthrough of a view's link group's selection, in the view's
// decoding at its point (memoised per decoding, point, path and focus)
export function useWalkthrough(id: string, at?: DataRef):
  Walkthrough | null {
  const v = useViewSpec(id);
  const lens = useLens();
  const data = at ?? ("data" in v ? v.data : undefined);
  const d = useDecoded(data);
  const point = usePoint(data);
  const c = useCompilation(data);
  const [link] = useLink(v.link);
  const sel = link.selection;
  const focus = link.walk?.focus;
  return useMemo(() => {
    if (!d || !point || !c || !sel || !d.byPath.has(sel)) return null;
    const dc = decodingOf(lens, d.decoding);
    if (!dc) return null;
    const k = `walk|${d.decoding}|${d.point}|${sel}|${focus ?? ""}`;
    const memo = lens.project.memo as Map<string, unknown>;
    if (!memo.has(k)) {
      memo.set(k, walkthrough({ d, c, snap: point.snapshot,
        keys: dc.keys }, sel, focus));
    }
    return memo.get(k) as Walkthrough | null;
  }, [d, point, c, sel, focus, lens]);
}

// What a view lights (vanilla main.js show, panel.js locked): with a
// selection (one this view's tree has), the selection, with the part
// pointed at in focus (a hover elsewhere is ignored); else what is
// pointed at: a value (a run of its own bytes: only that owner's
// bytes), bytes no value owns, or a row's address
export function useLight(id: string, filter?: Filter, at?: DataRef,
  compare?: DataRef): Light {
  const v = useViewSpec(id);
  const { d, l } = useLayout(id, filter, at, compare);
  const [link] = useLink(v.link);
  const collapsed = useCollapsed(v.link);
  const w = useWalkthrough(id, at);
  return useMemo(() => {
    if (!d || !l) return noLight;
    // a walkthrough shows its step, whatever the pointer is on
    if (link.walk && w) return forStep(d, l, w.steps, Math.min(link.walk.step,
      w.steps.length - 1));
    const o = { collapsed };
    const { selection, hover } = link;
    const sel = selection && d.byPath.has(selection) ? selection : null;
    if (sel) {
      const base = forPath(d, l, sel, { ...o, selection: true });
      const lk = locked(hover, sel, d.byPath);
      const k = lk?.path && lk.path !== sel
        ? base.colours.get(lk.path) : undefined;
      return { ...base, cap: new Set([sel]),
        ...(k !== undefined && k !== 0 ? { focus: k } : {}) };
    }
    if (hover?.path && d.byPath.has(hover.path)) {
      // (a run of the value's own bytes: those bytes' owners only)
      const leaf = hover.bytes && l.cover.get(byteKey(hover.bytes.location,
        hover.bytes.row, hover.bytes.from))?.some((x) =>
        x.replace(/#length$/, "") === hover.path);
      return leaf ? forBytes(d, l, hover.bytes!, o)
        : { ...forPath(d, l, hover.path, o),
          ...(hover.bytes ? { at: hover.bytes } : {}) };
    }
    if (hover?.bytes) return forBytes(d, l, hover.bytes, o);
    if (hover?.region) {
      const bytes = new Set(regionBytes(hover.region).map(([row, b]) =>
        byteKey(l.location, row, b)));
      return { ...noLight, bytes, muted: true };
    }
    if (hover?.row) return forRow(d, l, hover.row as Hex);
    if (hover) return { ...noLight, muted: true };
    return noLight;
  }, [d, l, link, collapsed, w]);
}
// The compilation a view's decoding reads with (its provenance: a
// hand-written one is badged)
export function useCompilation(ref: DataRef | undefined):
  Compilation | undefined {
  const lens = useLens();
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, lens.project);
    return at ? decodingOf(lens, at.decoding)?.compilation ?? "" : "";
  });
  const [got, setGot] = useState<Compilation>();
  useEffect(() => {
    if (!key) return;
    let live = true;
    lens.project.compilation(key).then((c) => live && setGot(c),
      (e) => console.error(e));
    return () => {
      live = false;
    };
  }, [lens, key]);
  return got?.id === key ? got : undefined;
}

// The timeline point a view shows (a dump's words, its transaction)
export const usePoint = (ref: DataRef | undefined) => usePointAt(ref)?.p;

// … and its place in its timeline
export function usePointAt(ref: DataRef | undefined):
  { p: TimelinePoint; i: number } | undefined {
  const lens = useLens();
  const { project } = lens;
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, project);
    return at ? `${at.decoding}\n${at.point}` : "";
  });
  const [got, setGot] = useState<{ key: string;
    at: { p: TimelinePoint; i: number } }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    const dc = decodingOf(lens, decoding);
    if (!dc) return;
    project.timeline(dc.timeline).then((t) => {
      const i = t.points.findIndex((x) => x.id === point);
      if (live && i >= 0) setGot({ key, at: { p: t.points[i], i } });
    }, (e) => console.error(e));
    return () => {
      live = false;
    };
  }, [lens, project, key]);
  return got?.key === key ? got.at : undefined;
}

export const useSnapshot = (ref: DataRef | undefined): Snapshot | undefined =>
  usePoint(ref)?.snapshot;
