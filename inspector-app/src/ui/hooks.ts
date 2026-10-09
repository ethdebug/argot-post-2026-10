// The hooks views use: their data, their link group's state, their own
// state, and what they light
import { createContext, useContext, useEffect, useMemo, useState,
  useSyncExternalStore } from "react";
import type { Project } from "../engine/project";
import type {
  Compilation, Decoded, Decoding, Filter, Hex, Layout, Light, Location,
  PointId, Snapshot, TimelinePoint,
} from "../engine/types";
import { decode } from "../engine/decode";
import { layout } from "../engine/layout";
import {
  forBytes, forPath, forRow, forStep, noLight,
} from "../engine/light";
import {
  walkthrough, type WalkInput, type Walkthrough,
} from "../engine/walkthrough/fold";
import {
  pointConsulted, related, relatedValues, withRelated,
} from "../engine/related";
import { locked } from "../engine/target";
import { byteKey } from "../engine/hex";
import { regionBytes } from "../engine/layout";
import type { Store } from "./store";
import type {
  DataAt, DataRef, LensSpec, LensState, LinkState, Moment, ViewState,
  ViewSpec,
} from "./types";

export interface LensContextValue {
  spec: LensSpec; project: Project; store: Store<LensState>;
  // this mount's key: its views carry data-view="<key>:<view id>"
  key: string;
  // show a scene (its moment and selection); false when its
  // data did not load (Lens.tsx)
  // (`walk`: a walkthrough to keep, of the selection kept: a move)
  show(id: string, view?: { moment?: number; sel?: string | null;
    walk?: LinkState["walk"] }):
    Promise<boolean>;
}
// The page's scenes of other lenses, for a lens inside it: the one shown
// in place of this lens's own bookmark (null: none), and a way to show
// one. With it, the lens's scene picker lists the page's scenes.
export const OtherScenes = createContext<{ scene: string | null;
  go(id: string | null): void } | null>(null);
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

// (a load that failed is the lens's to report, once, with Retry: Lens
// show; here it is left out, and anything else is logged)
const quiet = (e: unknown) => {
  if (!String((e as Error)?.message ?? e).startsWith("Could not load")) {
    console.error(e);
  }
};

export const NO_LINK: LinkState = { selection: null, hover: null,
  walk: null };
export const NO_VIEW: ViewState = { collapsed: new Set() };

// A moment of the scene shown, as its point: the one shown, the one
// before it (none at its first), or the n-th
export function momentOf(m: Moment, s: LensState, p: Project):
  PointId | undefined {
  const points = p.bookmarks.find((b) => b.id === s.scene)?.points;
  const k = m === "current" ? s.moment : m === "previous" ? s.moment - 1
    : m;
  return points?.[k];
}

// A DataRef in this lens's state: "$scene" is the scene's decoding

export function resolveRef(ref: DataRef, s: LensState, p: Project):
  DataAt | undefined {
  // ("$abi": the scene's call's calldata, when it names one; "$rule":
  // the other compiler's own reading of the scene's storage, if any)
  const own = p.bookmarks.find((b) => b.id === s.scene)?.decoding;
  const decoding = ref.decoding === "$scene" ? own
    : ref.decoding === "$rule" ? own && p.decodings[own]?.foreign?.rule
    : ref.decoding === "$abi" ? (p.decodings[`abi:${s.scene}`]
      ? `abi:${s.scene}` : undefined) : ref.decoding;
  const point = "moment" in ref ? momentOf(ref.moment, s, p) : ref.point;
  return decoding && point ? { decoding, point } : undefined;
}

export function useDecoded(ref: DataRef | undefined): Decoded | undefined {
  const lens = useLens();
  const { project } = lens;
  const key = useLensState((s) => {
    const at = ref && resolveRef(ref, s, project);
    return at ? `${at.decoding}\n${at.point}` : "";
  });
  // (fetched again once a load that failed loads: Retry)
  const failed = useLensState((s) => !!s.error);
  const [got, setGot] = useState<{ key: string; d: Decoded }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    const dc = decodingOf(lens, decoding);
    if (!dc) return console.error(`no decoding ${decoding}`);
    decode(project, dc, point).then((d) => {
      if (live) setGot({ key, d });
    }, quiet);
    return () => {
      live = false;
    };
  }, [lens, project, key, failed]);
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
  // (the "Related" view: the selection's related rows only)
  const only = useRelated(id, location, data, compare);
  const l = useMemo(() => {
    if (!d || (mine[0] && !o1)) return undefined;
    return layout(d, location, only ? { ...f, only } : f, { point,
      ...(cmp ? { compare: cmp } : {}),
      others: o1 ? [{ d: o1, who: mine[0].who }] : [] });
  }, [d, o1, point, location, f, mine[0]?.who, cmp, only]);
  return { d, l };
}

// The "Related" view's rows for a view (Filter.only): its link group's
// selection's related rows (engine/related.ts) at the view's point and
// at the point it compares with, so a pair's two sides keep one set of
// rows. None while the view is off, or nothing is selected. Hovering
// changes nothing: only a selection does. (Its inputs are loaded
// whether it is on or not: a switch draws its rows in the same commit,
// the one a view transition captures, not a load later.)
export function useRelated(id: string, location: Location,
  data?: DataRef, compare?: DataRef): Filter["only"] | undefined {
  const v = useViewSpec(id);
  const context = useLensState((s) => s.related?.context);
  const [link] = useLink(v.link);
  const on = context !== undefined && !!link.selection;
  const a = useWalkInput(data);
  const b = useWalkInput(compare);
  const { project } = useLens();
  const sel = link.selection;
  const key = useMemo(() => {
    if (!on || !sel) return "";
    const rows = new Set([a, b].flatMap((x) => x && x.d.byPath.has(sel)
      ? related(x.d, sel, walkOf(project, x, sel), location) : []));
    return [...rows].join(" ");
  }, [on, sel, a, b, project, location]);
  return useMemo(() => key ? { rows: key.split(" ") as Hex[], context }
    : undefined, [key, context]);
}

// The related view's values for a tree (Filter.roots): the selection
// and the values outside it its walkthrough reads (engine/related.ts);
// none while the view is off, or nothing is selected (its inputs loaded
// either way, as useRelated's)
export function useRelatedRoots(id: string): string[] | undefined {
  const v = useViewSpec(id);
  const on = useLensState((s) => s.related !== undefined);
  const [link] = useLink(v.link);
  const sel = on ? link.selection : null;
  const x = useWalkInput("data" in v ? v.data : undefined);
  const d = useDecoded("data" in v ? v.data : undefined);
  const { project } = useLens();
  const key = useMemo(() => !sel || !d?.byPath.has(sel) ? ""
    : relatedValues(d, sel, x ? walkOf(project, x, sel) : null).join("\n"),
  [sel, d, x, project]);
  return useMemo(() => key ? key.split("\n") : undefined, [key]);
}

// What a walkthrough is computed from, for a view's data (state
// variables, or locals: not a call's calldata by the ABI)
// (another compiler's storage read by this rule: that compiler's own
// reading of it, for the contrast; one side of a pair: the point's name)
function useWalkInput(data: DataRef | undefined): WalkInput | undefined {
  const lens = useLens();
  const d = useDecoded(data);
  const point = usePoint(data);
  const c = useCompilation(data);
  const foreign = d && decodingOf(lens, d.decoding)?.foreign;
  const cd = useDecoded(foreign && d ? { decoding: foreign.rule,
    point: d.point } : undefined);
  // (one moment of a scene's two, named: when the two moments' names
  // differ; the memory section's two trace steps share one)
  const pa = usePoint(data && { decoding: data.decoding, moment: 0 });
  const pb = usePoint(data && { decoding: data.decoding, moment: 1 });
  const pair = !!pb && pa?.label !== pb.label;
  return useMemo(() => {
    const dc = d && decodingOf(lens, d.decoding);
    if (!d || !point || !c || !dc || dc.variables === "abi") return;
    if (dc.foreign && !cd) return;
    return { d, c, snap: point.snapshot, keys: dc.keys,
      ...(pair ? { when: point.label } : {}),
      ...(dc.foreign && cd ? { contrast: { d: cd,
        language: dc.foreign.language } } : {}) };
  }, [d, point, c, lens, cd, pair]);
}

// A walkthrough, memoised per decoding, point, path and focus
function walkOf(project: Project, x: WalkInput, sel: string,
  focus?: string): Walkthrough | null {
  const k = `walk|${x.d.decoding}|${x.d.point}|${sel}|${focus ?? ""}|${
    x.when ?? ""}|${x.contrast ? "c" : ""}`;
  const memo = project.memo as Map<string, unknown>;
  if (!memo.has(k)) memo.set(k, walkthrough(x, sel, focus));
  return memo.get(k) as Walkthrough | null;
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
  const x = useWalkInput(data);
  const [link] = useLink(v.link);
  const sel = link.selection;
  const focus = link.walk?.focus;
  return useMemo(() => !x || !sel || !x.d.byPath.has(sel) ? null
    : walkOf(lens.project, x, sel, focus), [x, sel, focus, lens]);
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
    const o = { collapsed };
    const { selection, hover } = link;
    // (the last step, found: exactly the selection's resting view)
    const step = link.walk && w ? w.steps[Math.min(link.walk.step,
      w.steps.length - 1)] : null;
    // (with what it consulted: the resting view's related treatment)
    if (step?.phase === "found" && selection && d.byPath.has(selection)) {
      return { ...withRelated(forPath(d, l, selection, { ...o,
        selection: true }), d, l, selection, w),
      cap: new Set([selection]), rest: true };
    }
    if (link.walk && w) return forStep(d, l, w.steps, Math.min(link.walk.step,
      w.steps.length - 1), w);
    const sel = selection && d.byPath.has(selection) ? selection : null;
    // (a derivation's region step, pointed at: its bytes alone, over the
    // selection: vanilla mem.js forRegion)
    if (hover?.region) {
      // (the side lit: the view's (the earlier of two moments: before),
      // or, for the pair's other point (`at`), the other side: its
      // "only" rows)
      const own = v.kind === "dump" && "moment" in v.data && v.compare
        ? v.data.moment === "previous" ? "before" : "after" : null;
      const lit = own && at ? (own === "before" ? "after" : "before")
        : own;
      const other = !!hover.side && !!lit && lit !== hover.side;
      const bytes = new Set(regionBytes(hover.region).filter(() => !other &&
        hover.region!.location === l.location).map(([row, b]) =>
        byteKey(l.location, row, b)));
      return { ...noLight, bytes, muted: true };
    }
    if (sel) {
      // (and what it consulted: the related treatment)
      const base = withRelated(forPath(d, l, sel, { ...o,
        selection: true }), d, l, sel, w);
      const lk = locked(hover, sel, d.byPath);
      const k = lk?.path && lk.path !== sel
        ? base.colours.get(lk.path) : undefined;
      // (pointing at what it consulted: that one stands out)
      const out = lk ? base : pointConsulted(base, d, l, hover);
      return { ...out, cap: new Set([sel]),
        ...(k !== undefined && k !== 0 ? { focus: k } : {}) };
    }
    if (hover?.path && d.byPath.has(hover.path)) {
      // (a run of the value's own bytes: those bytes' owners only)
      const leaf = hover.bytes && l.cover.get(byteKey(hover.bytes.location,
        hover.bytes.row, hover.bytes.from))?.some((x) =>
        x.replace(/#[a-z]+$/, "") === hover.path);
      return leaf ? forBytes(d, l, hover.bytes!, o)
        : { ...forPath(d, l, hover.path, o),
          ...(hover.bytes ? { at: hover.bytes } : {}) };
    }
    // (bytes or a row of another location: nothing here; the rest
    // steps back)
    if (hover?.bytes) {
      return hover.bytes.location === l.location
        ? forBytes(d, l, hover.bytes, o) : { ...noLight, muted: true };
    }
    if (hover?.row) {
      return (hover.location ?? l.location) === l.location
        ? forRow(d, l, hover.row as Hex) : { ...noLight, muted: true };
    }
    if (hover) return { ...noLight, muted: true };
    return noLight;
  }, [d, l, link, collapsed, w, v, at]);
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
  const failed = useLensState((s) => !!s.error);
  const [got, setGot] = useState<Compilation>();
  useEffect(() => {
    if (!key) return;
    let live = true;
    lens.project.compilation(key).then((c) => live && setGot(c),
      quiet);
    return () => {
      live = false;
    };
  }, [lens, key, failed]);
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
  // (fetched again once a load that failed loads: Retry)
  const failed = useLensState((s) => !!s.error);
  const [got, setGot] = useState<{ key: string;
    at: { p: TimelinePoint; i: number } }>();
  useEffect(() => {
    if (!key) return;
    const [decoding, point] = key.split("\n");
    let live = true;
    const dc = decodingOf(lens, decoding);
    if (!dc) return;
    // (its place: in its scene's moments)
    const i = project.bookmarks.find((b) => b.points.includes(point))
      ?.points.indexOf(point) ?? -1;
    project.point(dc.timeline, point).then((p) => {
      if (live) setGot({ key, at: { p, i } });
    }, quiet);
    return () => {
      live = false;
    };
  }, [lens, project, key, failed]);
  return got?.key === key ? got.at : undefined;
}

export const useSnapshot = (ref: DataRef | undefined): Snapshot | undefined =>
  usePoint(ref)?.snapshot;

// Where the pointer is (the lens's listener keeps it)
export const pointer = { x: 0, y: 0 };
// A selection cleared from outside it (a click on what it does not
// light, on empty space; Escape): the page settles, no hover until the
// pointer moves (past 3px; the lens's listener ends the hush)
export function hush(store: LensContextValue["store"]) {
  store.set((s) => ({ ...s, hush: { ...pointer },
    links: Object.fromEntries(Object.entries(s.links).map(([k, l]) =>
      [k, l.hover ? { ...l, hover: null } : l])) }));
}

