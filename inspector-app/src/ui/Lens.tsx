// A lens: one store per mount, its views laid out in its grid's areas
// (or, on the parity page, in the page's elements). The lens decides
// what each view shows: its data, and for Phase 1's pair of dumps,
// which side is shown and what it is called.
import {
  useEffect, useId, useMemo, useState, type ComponentType, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Project } from "../engine/project";
import { decode } from "../engine/decode";
import { fromHash, toHash } from "../engine/hash";
import { readHash, writeHash, type Pending } from "./hash";
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
  const insets = useLensState((s) => s.insets);
  const pair: DataRef | undefined = !single && "data" in v &&
    typeof v.data.point !== "string"
    ? { ...v.data, point: { slot: v.data.point.slot === "a" ? "b"
      : v.data.point.slot === "b" ? "a" : "$other" } } : undefined;
  const other = ("compare" in v ? v.compare : undefined) ?? pair;
  if (v.kind === "tree" || v.kind === "walkthrough") {
    return <View {...v} compare={other} />;
  }
  if (v.kind !== "dump") return <View {...v} />;
  const side = v.side;
  const title = !side ? v.title ?? "Storage" : single ? "Storage"
    : side === "before" ? "Before" : "After";
  return <View {...v} hidden={!!side && shown !== side} title={title}
    when={side ? WHEN[side] : undefined}
    compare={side || v.compare ? other : undefined}
    filter={side && !single ? { ...v.filter, rows: "touched" } : v.filter}
    cards={!!side && !single && insets} />;
}

export function Lens(props: { spec: LensSpec; project: Project;
  hash?: boolean; kinds?: Kinds; mount?: Record<string, Element>;
  // the page's handle on the lens (the parity page's window.select),
  // and when its first view is shown
  onReady?: (lens: LensContextValue, ready: Promise<boolean>) => void }) {
  const { spec, project, mount, onReady } = props;
  const [store] = useState(() => createStore(initialState(spec, project)));
  const key = useId();
  const value = useMemo(() => ({ spec, project, store, key,
    show: shower(store, spec, project) }), [spec, project, store, key]);
  // pointing anywhere but at this lens's views (or a tree's edge button,
  // which is for what is lit) ends its hovers (vanilla onOver)
  useEffect(() => {
    const over = (e: Event) => {
      const t = e.target as Element;
      const v = t.closest?.("[data-view]")?.getAttribute("data-view");
      if (v?.startsWith(key + ":") || t.closest?.(".tedge, .tray")) return;
      store.set((s) => Object.values(s.links).some((l) => l.hover)
        ? { ...s, links: Object.fromEntries(Object.entries(s.links)
          .map(([k, l]) => [k, l.hover ? { ...l, hover: null } : l])) }
        : s);
    };
    document.addEventListener("pointerover", over);
    return () => document.removeEventListener("pointerover", over);
  }, [key, store, spec]);
  // the first bookmark, with its defaults (unless the page shows one)
  // the view the URL hash asks for (`hash`), or the first bookmark with
  // its defaults; then (with `hash`) every change goes back into it
  const [pending] = useState<Pending>({});
  useEffect(() => {
    const { store: st, show } = value;
    const want = props.hash ? fromHash(spec, readHash(), project.bookmarks)
      : undefined;
    if (want) st.set((s) => ({ ...s, insets: want.insets }));
    const id = want?.bookmark ?? st.get().bookmark;
    const ready = id ? show(id, want && { mode: want.side,
      sel: want.selection }) : Promise.resolve(true);
    let live = true;
    const unsub = props.hash ? (() => {
      let off = () => {};
      void ready.then(() => {
        if (!live) return;
        const write = () => {
          const s = st.get();
          writeHash(toHash(spec, { bookmark: s.bookmark,
            side: s.side ?? "after", insets: s.insets,
            selection: s.links[spec.links[0]]?.selection ?? null },
          project.bookmarks), pending);
        };
        write();
        off = st.subscribe(write);
      });
      return () => off();
    })() : () => {};
    onReady?.(value, ready);
    return () => {
      live = false;
      unsub();
    };
  }, [value, onReady, props.hash, spec, project, pending]);

  // Escape (in this lens: the focus is in it, or, with nothing focused,
  // the pointer was last pressed in it): exits a walkthrough first, then
  // clears the selection. A click on empty space clears it too (not on
  // controls, text being selected, or another lens).
  useEffect(() => {
    const mine = (el: Element | null) => !!el?.closest?.(
      `[data-view^="${key}:"]`);
    const other = (el: Element | null) => !!el?.closest?.("[data-view]") &&
      !mine(el);
    let pressed = false;
    const down = (e: Event) => {
      pressed = mine(e.target as Element);
    };
    // (a walkthrough with a panel to fold: the panel ends it)
    const panelled = (link: string) => spec.views.some((v) =>
      v.kind === "walkthrough" && v.link === link);
    const clear = () => store.set((s) => ({ ...s, links: Object.fromEntries(
      Object.entries(s.links).map(([k, l]) => [k, l.walk
        ? { ...l, walk: panelled(k) ? { ...l.walk, exit: true } : null }
        : l.selection ? { ...l, selection: null } : l])) }));
    const keyed = (e: KeyboardEvent) => {
      const f = document.activeElement;
      const here = !f || f === document.body ? pressed : mine(f);
      if (!here) return;
      // (a view with a selection of its own keeps its Escape)
      if (e.key === "Escape" && !(e.target as Element).closest?.(
        "[data-scoped]")) return clear();
      // in a walkthrough: ← → Home End step, from anywhere in the lens
      // but a text field
      const moves: Record<string, (k: number, n: number) => number> = {
        ArrowLeft: (k) => k - 1, ArrowRight: (k) => k + 1,
        Home: () => 0, End: (_, n) => n - 1 };
      const move = moves[e.key];
      if (!move || (e.target as Element).closest?.("input, textarea, select")
        || !Object.values(store.get().links).some((l) => l.walk)) return;
      e.preventDefault();
      if (Object.values(store.get().links).some((l) => l.walk?.busy)) return;
      store.set((s) => ({ ...s, links: Object.fromEntries(Object.entries(
        s.links).map(([k, l]) => [k, l.walk ? { ...l, walk: { ...l.walk,
          step: Math.max(0, Math.min((l.walk.n ?? 1) - 1, move(l.walk.step,
            l.walk.n ?? 1))) } } : l])) }));
    };
    const click = (e: MouseEvent) => {
      const t = e.target as Element;
      if ((e as MouseEvent & { acted?: boolean }).acted || other(t) ||
        t.closest?.("[data-scoped]")) return;
      if (t.closest?.("#picker, #details, #dwrap, .addr, .tray, a, " +
        "button, summary, details, input, label, .shellbar")) return;
      if (String(window.getSelection?.() ?? "")) return;
      store.set((s) => ({ ...s, links: Object.fromEntries(Object.entries(
        s.links).map(([k, l]) => [k, l.selection && !l.walk
          ? { ...l, selection: null } : l])) }));
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", keyed);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", keyed);
      document.removeEventListener("click", click);
    };
  }, [key, store, spec]);
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
