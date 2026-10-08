// A change of which rows exist, animated (the related view: its toggle,
// and a deliberate selection that changes its rows), with the browser's
// View Transitions: the rows that stay move to their new places, the
// others fade, about 220 ms. No API, or reduced motion: at once.
// Hover and a walkthrough's steps never change the rows, so never
// animate. The rows carry their names as data-vt (`vtName`); they are
// set as view-transition-name only during a transition (a name makes
// its element a stacking context, which the popovers must not meet),
// and only on rows wholly inside what clips them (a row half out of the
// tree's box would show past it). The popovers hide meanwhile.
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

function names(on: boolean) {
  const seen = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-vt]")) {
    const n = el.dataset.vt!;
    const ok = on && !seen.has(n) && inView(el);
    if (ok) seen.add(n);
    el.style.viewTransitionName = ok ? n : "";
  }
}

// Run `change` (a state change React draws) as a view transition
export function transition(change: () => void): void {
  const doc = document as Doc;
  if (!doc.startViewTransition ||
    matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return change();
  }
  const root = document.documentElement;
  root.classList.add("vt-run");
  names(true);
  try {
    const t = doc.startViewTransition(() => {
      flushSync(change);
      names(true);
    });
    t.finished.finally(() => {
      names(false);
      root.classList.remove("vt-run");
    });
  } catch {
    names(false);
    root.classList.remove("vt-run");
    change();
  }
}

// Whether a change of a lens's state changes which rows the related
// view shows, deliberately: the view turned on or off, or (while it is
// on, with no walkthrough, in the same bookmark's showing) a selection
const rowsChange = (a: LensState, b: LensState) =>
  a.bookmark === b.bookmark && a.shows === b.shows &&
  ((a.related === undefined) !== (b.related === undefined) ||
    (!!b.related && Object.keys(b.links).some((k) => {
      const [x, y] = [a.links[k], b.links[k]];
      return x?.selection !== y?.selection && !x?.walk && !y?.walk;
    })));

// A lens's store whose changes of the related view's rows animate
export function animated(store: Store<LensState>): Store<LensState> {
  return { ...store, set(f) {
    const prev = store.get();
    const next = f(prev);
    if (next === prev) return;
    if (rowsChange(prev, next)) transition(() => store.set(f));
    else store.set(() => next);
  } };
}
