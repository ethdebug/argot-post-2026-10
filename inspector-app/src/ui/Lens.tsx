// A lens: one store per mount, its views laid out in its grid's areas
// (or, on the parity page, in the page's elements). The lens decides
// what each view shows: its data, and for Phase 1's pair of dumps,
// which side is shown and what it is called.
import {
  useEffect, useId, useMemo, useState, type ComponentType,
  type CSSProperties, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { narrowAreas } from "./narrow";
import type { Project } from "../engine/project";
import { decode } from "../engine/decode";
import { fromHash, toHash } from "../engine/hash";
import { readHash, writeHash, type Pending } from "./hash";
import { createStore, type Store } from "./store";
import { animated } from "./transition";
import {
  decodingOf, LensContext, useLens, useLensState, resolveRef,
  type LensContextValue, hush, pointer,
} from "./hooks";
import { viewKinds } from "./views";
import type {
  DataRef, LensSpec, LensState, ViewKind, ViewSpec,
} from "./types";

type Kinds = Partial<Record<ViewKind, ComponentType<any>>>;

// (a scene's first moment shown: its initial one, else its last)
const firstMoment = (bm: { points: unknown[]; side?: string }) =>
  bm.side === "before" ? 0 : bm.points.length - 1;

export function initialState(spec: LensSpec, project: Project): LensState {
  const id = spec.initial?.scene ?? spec.bookmarks?.[0];
  const bm = project.bookmarks.find((b) => b.id === id);
  return {
    scene: bm?.id,
    moment: bm ? firstMoment(bm) : 0,
    links: Object.fromEntries(spec.links.map((l) =>
      [l, { selection: null, hover: null, walk: null }])),
    views: {},
    ...spec.initial,
  };
}

// Show a scene: its moment (its first, or `view.moment`), and its
// selection (or `view.sel`; one the tree does not have is none), in
// every link group. Waits for its data; a later call wins.
// (`onFail`: the page's report of a load that failed, with a retry)
function shower(store: Store<LensState>, spec: LensSpec, project: Project,
  onFail?: (e: unknown, again: () => void) => void) {
  let wanted = 0;
  const show: LensContextValue["show"] = async (id, view) => {
    const ticket = ++wanted;
    const bm = project.bookmarks.find((b) => b.id === id);
    if (!bm) return false;
    const asked = view?.moment;
    const moment = asked !== undefined && asked >= 0 &&
      asked < bm.points.length ? asked : firstMoment(bm);
    const dc = decodingOf({ spec, project } as LensContextValue,
      bm.decoding);
    let tree;
    try {
      tree = await decode(project, dc!, bm.points[moment]);
      // (and the moment before it: a scene of two shows both)
      if (moment > 0) await decode(project, dc!, bm.points[moment - 1]);
    } catch (e) {
      if (ticket !== wanted) return false;
      store.set((s) => ({ ...s, error: String((e as Error)?.message ?? e) }));
      if (onFail) onFail(e, () => void show(id, view));
      else console.error(e);
      return false;
    }
    if (ticket !== wanted) return true; // another was asked for since
    const want = view && "sel" in view ? view.sel : bm.select;
    const selection = want && tree.byPath.has(want) ? want : null;
    store.set((s) => ({ ...s, scene: id, moment, error: undefined,
      shows: (s.shows ?? 0) + 1,
      // (a link group of its own section starts with nothing selected:
      // the scene's selection is the others')
      links: Object.fromEntries(spec.links.map((l) => [l,
        { selection: Object.values(spec.scopes ?? {}).includes(l) ? null
          : selection, hover: null,
          walk: !selection ? null : view?.walk ? { ...view.walk,
            busy: undefined, exit: undefined }
            : bm.walk ? { ...bm.walk } : null }])) }));
    return true;
  };
  return show;
}

// A view, with what the lens decides for it: one whose data has no
// point (the moment before a scene's first) is idle, or with
// `idle: "hidden"` not drawn; a dump compared with another moment shows
// the rows its transaction touched too, and is titled by its moment (a
// scene of one moment: its own title)
function Present({ v, View }: { v: ViewSpec; View: ComponentType<any> }) {
  const { project } = useLens();
  const at = (r?: DataRef) => useLensState((s) => r ? resolveRef(r, s,
    project)?.point ?? "" : "");
  const here = at("data" in v ? v.data : undefined);
  const there = at("compare" in v ? v.compare : undefined);
  const label = useLensState((s) => {
    const bm = project.bookmarks.find((b) => b.id === s.scene);
    return bm && bm.points.length > 1 ? bm.points.indexOf(here) : -1;
  });
  const when = useWhen(v.kind === "dump" ? here : "");
  if (v.kind === "tree" || v.kind === "walkthrough") {
    return <View {...v} compare={there ? v.compare : undefined} />;
  }
  if (v.kind !== "dump") return <View {...v} />;
  if (v.idle === "hidden" && !here) return null;
  const title = v.title ?? "Storage";
  const two = label >= 0 && v.title2 !== undefined;
  return <View {...v} title={!two ? title : v.title2 === "moment"
    ? when ? `${title} ${when}` : title : v.title2} when={when}
    compare={there ? v.compare : undefined}
    filter={there ? { ...v.filter, rows: "touched" } : v.filter} />;
}

// a point's label: "in the middle of the game"
function useWhen(point: string): string | undefined {
  const { project } = useLens();
  const [label, setLabel] = useState<{ point: string; text: string }>();
  useEffect(() => {
    if (!point) return;
    let live = true;
    const tl = point.slice(0, point.lastIndexOf(":"));
    const id = project.bookmarks.find((b) => b.points.includes(point))
      ?.timeline ?? `scene:${tl}`;
    project.point(id, point).then((p) => {
      if (live) setLabel({ point, text: p.label });
    }, () => {});
    return () => {
      live = false;
    };
  }, [project, point]);
  return label?.point === point ? label.text : undefined;
}

export function Lens(props: { spec: LensSpec; project: Project;
  hash?: boolean; kinds?: Kinds; mount?: Record<string, Element>;
  // the page's handle on the lens (the parity page's window.select),
  // and when its first view is shown
  onReady?: (lens: LensContextValue, ready: Promise<boolean>) => void;
  onFail?: (e: unknown, again: () => void) => void;
  // (its part of the page: Escape after a press there, and a click on
  // empty space there, are its own; default: its views)
  within?: (el: Element) => boolean }) {
  const { spec, project, mount, onReady } = props;
  // (a change of the related view's rows animates: transition.ts)
  const [store] = useState(() => animated(createStore(initialState(spec,
    project))));
  const key = useId();
  const value = useMemo(() => ({ spec, project, store, key,
    show: shower(store, spec, project, props.onFail) }),
  [spec, project, store, key, props.onFail]);
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
    // (and focus leaving its views, to nothing or elsewhere: vanilla)
    const out = (e: FocusEvent) => {
      const to = e.relatedTarget as Element | null;
      if (to?.closest?.(`[data-view^="${key}:"]`)) return;
      over({ target: to ?? document.body } as unknown as Event);
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("focusout", out);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("focusout", out);
    };
  }, [key, store, spec]);
  // the first bookmark, with its defaults (unless the page shows one)
  // the view the URL hash asks for (`hash`), or the first bookmark with
  // its defaults; then (with `hash`) every change goes back into it
  const [pending] = useState<Pending>({});
  useEffect(() => {
    const { store: st, show } = value;
    const want = props.hash ? fromHash(spec, readHash(), project.bookmarks)
      : undefined;
    if (want) {
      st.set((s) => ({ ...s, related: want.related === undefined
        ? undefined : { context: want.related } }));
    }
    const id = want?.bookmark ?? st.get().scene;
    // (a hash that names no scene of the lens: the scene's own view)
    const at = spec.initial?.moment;
    const ready = id ? show(id, want?.bookmark ? { sel: want.selection }
      : at !== undefined ? { moment: at } : undefined)
      : Promise.resolve(true);
    let live = true;
    const unsub = props.hash ? (() => {
      let off = () => {};
      void ready.then(() => {
        if (!live) return;
        const write = () => {
          const s = st.get();
          writeHash(toHash(spec, { bookmark: s.scene,
            selection: s.links[spec.links[0]]?.selection ?? null,
            related: s.related?.context },
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
    const here0 = (el: Element | null) => !!el &&
      (props.within ? props.within(el) : mine(el));
    // (a link group of its own part of the page: Escape and a click on
    // empty space there clear it alone; elsewhere, the others)
    const scopeOf = (el: Element | null) => el?.closest?.(
      "[data-link-scope]")?.getAttribute("data-link-scope") ?? null;
    const scoped = new Set(Object.values(spec.scopes ?? {}));
    const ours = (scope: string | null) => (k: string) =>
      scope ? k === scope : !scoped.has(k);
    let pressed = false;
    let pressedScope: string | null = null;
    const down = (e: Event) => {
      pressed = here0(e.target as Element);
      pressedScope = scopeOf(e.target as Element);
    };
    // (a walkthrough with a panel to fold: the panel ends it)
    const panelled = (link: string) => spec.views.some((v) =>
      v.kind === "walkthrough" && v.link === link);
    // (a selection it ended: the hover waits for the pointer to move)
    const ends = (scope: string | null) => Object.entries(store.get().links)
      .some(([k, l]) => ours(scope)(k) && l.selection && !l.walk);
    const clear = (scope: string | null) => {
      const hushed = ends(scope);
      store.set((s) => ({ ...s,
        links: Object.fromEntries(Object.entries(s.links).map(([k, l]) =>
          [k, !ours(scope)(k) ? l : l.walk
            ? { ...l, walk: panelled(k) ? { ...l.walk, exit: true } : null }
            : l.selection ? { ...l, selection: null } : l])) }));
      if (hushed) hush(store);
    };
    const keyed = (e: KeyboardEvent) => {
      const f = document.activeElement;
      const here = !f || f === document.body ? pressed : here0(f);
      if (!here) return;
      if (e.key === "Escape") {
        return clear(!f || f === document.body ? pressedScope : scopeOf(f));
      }
      // in a walkthrough: ← → Home End step, from anywhere in the lens
      // but a text field (or the debugger's moves, focused: theirs)
      const moves: Record<string, (k: number, n: number) => number> = {
        ArrowLeft: (k) => k - 1, ArrowRight: (k) => k + 1,
        Home: () => 0, End: (_, n) => n - 1 };
      const move = moves[e.key];
      if (!move || (e.target as Element).closest?.(
        "input, textarea, select, .moves")
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
        (props.within && !props.within(t))) {
        return;
      }
      if (t.closest?.("#picker, .rbar, .dwrap, .addr, .tray, a, " +
        "button, summary, details, input, label, .shellbar, .how, " +
        ".details")) return;
      if (String(window.getSelection?.() ?? "")) return;
      const scope = scopeOf(t);
      const hushed = ends(scope);
      store.set((s) => ({ ...s, links: Object.fromEntries(Object.entries(
        s.links).map(([k, l]) => [k, ours(scope)(k) && l.selection &&
          !l.walk ? { ...l, selection: null } : l])) }));
      if (hushed) hush(store);
    };
    // (where the pointer is; a hush ends once it moves past 3px)
    const moved = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      const h = store.get().hush;
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 3) {
        store.set((s) => ({ ...s, hush: undefined }));
      }
    };
    document.addEventListener("pointermove", moved, true);
    document.addEventListener("pointerdown", moved, true);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", keyed);
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", moved, true);
      document.removeEventListener("pointerdown", moved, true);
      document.removeEventListener("keydown", keyed);
      document.removeEventListener("click", click);
    };
  }, [key, store, spec, props.within]);
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
    : <div className={["lens", spec.layout].filter(Boolean).join(" ")}
      style={spec.grid ? { display: "grid", gridTemplateAreas: spec.grid,
        "--narrow-areas": narrowAreas(spec.grid, spec.areas) } as
        CSSProperties : undefined}>
      {Object.entries(wrapped).map(([a, n]) =>
        <div key={a} className={spec.areas?.[a]} data-area={a}
          data-link-scope={spec.scopes?.[a]}
          style={{ gridArea: a }}>{n}</div>)}
    </div>;
  return <LensContext.Provider value={value}>{body}</LensContext.Provider>;
}
