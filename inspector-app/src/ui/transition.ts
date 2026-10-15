// A change of which groups of rows exist, animated, as one motion (the
// one helper for every deliberate change of what the views show: the
// related view's toggle, a selection there or its clearing, a Reset,
// and a timeline's moments: `transition(change)`), with the browser's
// View Transitions. A walkthrough changes nothing of this: a reader's
// act during one animates as at any other time. The unit
// is a GROUP: in a dump, a run of adjacent rows between two "⋯" lines
// (a .run, named by its first row); in a tree, a variable's subtree (its
// li). A group that stays glides to its new place, its content cross-
// fading inside its box (never stretched); one that leaves folds away;
// one that enters unfolds; the "⋯" lines move with them. A subtree's
// rows are named too (they move inside it as its members are filtered:
// a cross-fade would show both layouts). The popovers are part of their
// row's group, so they travel with it. One duration, one easing for
// all. No API, or reduced motion: at once. Hover never changes the
// groups, so never animates; a walkthrough's steps by the switch below
// (STEPS_ANIMATE). Names are kept as
// data-vt (`vtName`), set as view-transition-name only during a
// transition, and only on what is wholly inside what clips it; a dump's
// run that is not gives its rows (data-vt-in) their own names instead.
import { flushSync } from "react-dom";
import type { Store } from "./store";
import type { LensState } from "./types";

type VT = { finished: Promise<void> };
type Doc = Document & { startViewTransition?: (f: () => void) => VT };

// A row's name, from its identity (the lens mount, the view, the
// address or path): a valid, page-unique ident
export function vtName(...parts: string[]): string {
  let h = 0x811c9dc5;
  for (const c of parts.join("|")) {
    h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  }
  return `vt-${h.toString(36)}-${parts.join("").length.toString(36)}`;
}

// whether `el` is wholly inside every box that clips it
function inView(el: HTMLElement): boolean {
  if (!el.offsetParent) return false;
  const r = el.getBoundingClientRect();
  for (let a = el.parentElement; a && a !== document.body;
    a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const b = a.getBoundingClientRect();
    if (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5 ||
      r.left < b.left - 0.5 || r.right > b.right + 0.5) return false;
  }
  return true;
}

// A group's members' ids (its rows', in a dump's run)
const members = (el: HTMLElement) => new Set([...el.querySelectorAll<
  HTMLElement>("[data-vt-in]")].map((m) => m.dataset.vtIn!));
// (the old state's groups: their names, by their members)
let before = new Map<string, Set<string>>();

// Set the names: `old`, the state about to be captured as old; `new`,
// the one captured as new (a group that holds a row of an old one takes
// that one's name: a run that gained or lost rows at its top is the
// same run); `off`, none
function names(phase: "old" | "new" | "off") {
  const on = phase !== "off";
  const seen = new Set<string>();
  const named = new Set<Element>();
  const name = (el: HTMLElement, n: string | undefined) => {
    const ok = !!n && on && !seen.has(n) && inView(el);
    if (ok) {
      seen.add(n!);
      named.add(el);
    }
    el.style.viewTransitionName = ok ? n! : "";
  };
  const groups = [...document.querySelectorAll<HTMLElement>("[data-vt]")];
  const own = new Set(groups.map((g) => g.dataset.vt!));
  const claimed = new Set<string>();
  const now = new Map<string, Set<string>>();
  for (const el of groups) {
    let n = el.dataset.vt!;
    const m = members(el);
    if (phase === "new" && !before.has(n) && m.size) {
      const was = [...before].find(([k, ms]) => !own.has(k) &&
        !claimed.has(k) && [...m].some((x) => ms.has(x)))?.[0];
      if (was) n = was;
    }
    claimed.add(n);
    if (m.size) now.set(n, m);
    name(el, n);
  }
  if (phase === "old") before = now;
  if (phase === "off") before = new Map();
  // (a group not named: its members, each its own)
  for (const el of document.querySelectorAll<HTMLElement>("[data-vt-in]")) {
    const g = el.parentElement?.closest<HTMLElement>("[data-vt]");
    name(el, g && !named.has(g) ? el.dataset.vtIn : undefined);
  }
}

// Run `change` (a state change React draws) as a view transition. A
// new one while one runs replaces it (the browser skips the old one,
// which then leaves the names and the class to the new one).
let running = 0;
// (the one animating now, past its capture: its end)
let animatingNow: Promise<void> | null = null;
// Run `f` now, or, while a transition animates, at its end
export function afterTransition(f: () => void): void {
  const a = animatingNow;
  if (!a) return f();
  a.then(() => afterTransition(f));
}
export function transition(change: () => void): void {
  const doc = document as Doc;
  if (!doc.startViewTransition ||
    matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return change();
  }
  const root = document.documentElement;
  const mine = ++running;
  const done = () => {
    if (mine !== running) return;
    names("off");
    root.classList.remove("vt-run");
  };
  root.classList.add("vt-run");
  names("old");
  try {
    // (after the commit, the overlays drawn for it, a microtask later:
    // Dump.tsx schedule; then the new state is captured)
    const t = doc.startViewTransition(async () => {
      flushSync(change);
      await new Promise<void>((r) => queueMicrotask(r));
      names("new");
    });
    // (from its capture to its end: the page under it is its new state,
    // live; nothing redraws it meanwhile, as Firefox ends a transition
    // whose named elements are replaced)
    const end = t.finished.then(() => {}, () => {});
    t.ready.then(() => {
      if (mine === running) animatingNow = end;
    }, () => {});
    end.then(() => {
      if (animatingNow === end) animatingNow = null;
    });
    t.finished.finally(done);
  } catch {
    done();
    change();
  }
}

// Whether a walkthrough's steps animate. Off: a step changes only what
// is lit, not which rows show; and steps come in quick runs (the arrow
// keys, ▶), each of which would wait on a motion. On, to try it: each
// step a transition, as any other change of rows.
export const STEPS_ANIMATE = false;

// Whether a change of a lens's state, a reader's act, changes which
// rows the views show: within a scene once shown (not its first
// showing, nor another scene: a figure of its own), the related view
// turned on or off; while it is on, a selection or its clearing, by a
// click or by the scene shown again (a Reset); and a walkthrough's step,
// by its switch. (A scene shown again with the related view off: its
// rows stay, so no motion.) Not during a move, a replay's play, nor on
// its arrival: the play is the motion, and its pages fold as it rests
// (lenses/stepper.tsx); a picture of the page over them would show both
const rowsChange = (a: LensState, b: LensState) =>
  a.scene === b.scene && !!a.shows && !a.playing && !b.playing &&
  a.toward === undefined && b.toward === undefined &&
  ((a.related === undefined) !== (b.related === undefined) ||
    Object.keys(b.links).some((k) => {
      const [x, y] = [a.links[k], b.links[k]];
      return (!!b.related && x?.selection !== y?.selection) ||
        (STEPS_ANIMATE && x?.walk?.step !== y?.walk?.step);
    }));

// A lens's store whose changes of the related view's rows animate. The
// change waits for the transition's callback (the old rows are captured
// first); meanwhile every other change composes onto it, so a click
// then is never lost, and lands with it.
// (`cut`: a change made at once, whatever it changes: a cut, as to
// another transaction, TimelineBar.tsx)
let cutting = false;
export function cut(change: () => void): void {
  cutting = true;
  try {
    change();
  } finally {
    cutting = false;
  }
}
// (`pages`: a lens whose dumps are pages, which move their own heights
// as their rows change (lenses/stepper.tsx): its change of rows is
// theirs, in their one time and easing, the rest with it; no picture of
// the page over them, moving on a clock of its own)
export function animated(store: Store<LensState>,
  o: { pages?: boolean } = {}): Store<LensState> {
  let pending: LensState | null = null;
  return { ...store, set(f) {
    const prev = pending ?? store.get();
    const next = f(prev);
    if (next === prev) return;
    if (pending) {
      pending = next;
      return;
    }
    if (cutting || o.pages || !rowsChange(prev, next)) {
      return store.set(() => next);
    }
    pending = next;
    transition(() => {
      const s = pending!;
      pending = null;
      store.set(() => s);
    });
  } };
}
